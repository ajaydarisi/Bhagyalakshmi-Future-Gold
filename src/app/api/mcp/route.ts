import { NextResponse } from "next/server";
import {
  AGENT_NAVIGATION_PROTOCOL_VERSIONS,
  getAgentNavigationMcpTools,
  getAgentNavigationSiteUrl,
  getPublicAgentRoutes,
  resolvePublicAgentRoute,
} from "@/lib/agent-navigation-surface";

const MAX_MCP_BODY_BYTES = 12 * 1024;
const MCP_RATE_LIMIT_MAX_REQUESTS = 60;
const MCP_RATE_LIMIT_WINDOW_MS = 60_000;
const MCP_PROTOCOL_VERSION = AGENT_NAVIGATION_PROTOCOL_VERSIONS[0];

type JsonRpcId = string | number | null;
type McpRateLimitEntry = {
  count: number;
  resetAt: number;
};

declare global {
  var __agentNavigationMcpRateLimitStore:
    | Map<string, McpRateLimitEntry>
    | undefined;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasValidJsonRpcId(value: unknown): value is JsonRpcId {
  return value === null || typeof value === "string" || typeof value === "number";
}

function getMcpRateLimitStore() {
  if (!globalThis.__agentNavigationMcpRateLimitStore) {
    globalThis.__agentNavigationMcpRateLimitStore = new Map();
  }

  return globalThis.__agentNavigationMcpRateLimitStore;
}

function getClientIdentifier(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return (
    request.headers.get("cf-connecting-ip") ??
    request.headers.get("x-real-ip") ??
    forwardedFor?.split(",")[0]?.trim() ??
    "anonymous"
  );
}

function isRateLimited(request: Request) {
  const now = Date.now();
  const store = getMcpRateLimitStore();
  const clientIdentifier = getClientIdentifier(request);
  const current = store.get(clientIdentifier);

  if (!current || current.resetAt <= now) {
    store.set(clientIdentifier, {
      count: 1,
      resetAt: now + MCP_RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  return current.count > MCP_RATE_LIMIT_MAX_REQUESTS;
}

function isAllowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    const requestOrigin = new URL(request.url).origin;
    const canonicalOrigin = new URL(getAgentNavigationSiteUrl()).origin;
    return origin === requestOrigin || origin === canonicalOrigin;
  } catch {
    return false;
  }
}

function responseHeaders() {
  return {
    "Cache-Control": "no-store",
    Vary: "Accept, Origin",
  };
}

function jsonRpcResult(id: JsonRpcId, result: Record<string, unknown>) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, result },
    { headers: responseHeaders() },
  );
}

function jsonRpcError(
  id: JsonRpcId,
  code: number,
  message: string,
  status = 200,
  data?: Record<string, unknown>,
) {
  return NextResponse.json(
    {
      jsonrpc: "2.0",
      id,
      error: {
        code,
        message,
        ...(data ? { data } : {}),
      },
    },
    { status, headers: responseHeaders() },
  );
}

function toolResult(
  structuredContent: Record<string, unknown>,
  isError = false,
) {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(structuredContent),
      },
    ],
    structuredContent,
    isError,
  };
}

function validateTransportRequest(request: Request) {
  if (!isAllowedOrigin(request)) {
    return jsonRpcError(null, -32003, "Forbidden origin", 403);
  }

  const accept = request.headers.get("accept") ?? "";
  if (
    !accept.includes("application/json") ||
    !accept.includes("text/event-stream")
  ) {
    return jsonRpcError(
      null,
      -32000,
      "MCP clients must accept application/json and text/event-stream",
      406,
    );
  }

  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return jsonRpcError(null, -32600, "Content-Type must be application/json", 415);
  }

  const protocolVersion = request.headers.get("mcp-protocol-version");
  if (
    protocolVersion &&
    !AGENT_NAVIGATION_PROTOCOL_VERSIONS.includes(
      protocolVersion as (typeof AGENT_NAVIGATION_PROTOCOL_VERSIONS)[number],
    )
  ) {
    return jsonRpcError(
      null,
      -32600,
      "Unsupported MCP protocol version",
      400,
      { supported: AGENT_NAVIGATION_PROTOCOL_VERSIONS },
    );
  }

  if (isRateLimited(request)) {
    return jsonRpcError(null, -32029, "Rate limit exceeded", 429);
  }

  return null;
}

function parseToolArguments(value: unknown) {
  return value === undefined || isPlainRecord(value) ? value ?? {} : null;
}

function handleToolCall(id: JsonRpcId, params: unknown) {
  if (!isPlainRecord(params) || typeof params.name !== "string") {
    return jsonRpcError(id, -32602, "Invalid tool call parameters");
  }

  const argumentsValue = parseToolArguments(params.arguments);
  if (!argumentsValue) {
    return jsonRpcError(id, -32602, "Tool arguments must be an object");
  }

  if (params.name === "list_store_routes") {
    return jsonRpcResult(
      id,
      toolResult({ routes: getPublicAgentRoutes() }),
    );
  }

  if (params.name !== "resolve_store_route") {
    return jsonRpcError(id, -32602, `Unknown tool: ${params.name}`);
  }

  const navigation = resolvePublicAgentRoute({
    routeId: argumentsValue.routeId,
    params: argumentsValue.params,
    storeMode: argumentsValue.storeMode,
  });
  if (!navigation) {
    return jsonRpcResult(
      id,
      toolResult(
        {
          error:
            "The route ID or parameters are not available through the public, validated storefront manifest.",
        },
        true,
      ),
    );
  }

  return jsonRpcResult(
    id,
    toolResult({
      routeId: argumentsValue.routeId as string,
      href: navigation.href,
      destination: navigation.destination,
      kind: navigation.kind,
    }),
  );
}

function handleMcpRequest(value: unknown) {
  if (!isPlainRecord(value) || value.jsonrpc !== "2.0" || typeof value.method !== "string") {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request", 400);
  }

  const hasId = Object.hasOwn(value, "id");
  if (hasId && !hasValidJsonRpcId(value.id)) {
    return jsonRpcError(null, -32600, "Invalid JSON-RPC request ID", 400);
  }

  if (!hasId) {
    // The stateless endpoint has no server-to-client notifications to emit.
    // It still accepts the lifecycle notification required after initialization.
    return new Response(null, { status: 202, headers: responseHeaders() });
  }

  const id = value.id as JsonRpcId;
  if (value.method === "initialize") {
    const params = isPlainRecord(value.params) ? value.params : null;
    const requestedVersion = params?.protocolVersion;
    if (typeof requestedVersion !== "string") {
      return jsonRpcError(id, -32602, "initialize requires protocolVersion");
    }

    const negotiatedVersion = AGENT_NAVIGATION_PROTOCOL_VERSIONS.includes(
      requestedVersion as (typeof AGENT_NAVIGATION_PROTOCOL_VERSIONS)[number],
    )
      ? requestedVersion
      : MCP_PROTOCOL_VERSION;

    return jsonRpcResult(id, {
      protocolVersion: negotiatedVersion,
      capabilities: { tools: { listChanged: false } },
      serverInfo: {
        name: "bhagyalakshmi-future-gold-navigation",
        title: "Bhagyalakshmi Future Gold navigation",
        version: "1.0.0",
        description:
          "Read-only, manifest-grounded navigation for the public Bhagyalakshmi Future Gold storefront.",
        websiteUrl: getAgentNavigationSiteUrl(),
      },
      instructions:
        "Call list_store_routes before resolve_store_route. Only use returned href values; this endpoint has no authenticated or write actions.",
    });
  }

  if (value.method === "ping") {
    return jsonRpcResult(id, {});
  }

  if (value.method === "tools/list") {
    return jsonRpcResult(id, { tools: getAgentNavigationMcpTools() });
  }

  if (value.method === "tools/call") {
    return handleToolCall(id, value.params);
  }

  return jsonRpcError(id, -32601, `Method not found: ${value.method}`);
}

export async function POST(request: Request) {
  const transportError = validateTransportRequest(request);
  if (transportError) return transportError;

  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_MCP_BODY_BYTES) {
    return jsonRpcError(null, -32600, "MCP request body is too large", 413);
  }

  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return jsonRpcError(null, -32700, "Could not read JSON-RPC body", 400);
  }

  if (new TextEncoder().encode(rawBody).byteLength > MAX_MCP_BODY_BYTES) {
    return jsonRpcError(null, -32600, "MCP request body is too large", 413);
  }

  try {
    return handleMcpRequest(JSON.parse(rawBody));
  } catch {
    return jsonRpcError(null, -32700, "Parse error", 400);
  }
}

export async function GET(request: Request) {
  if (!isAllowedOrigin(request)) {
    return jsonRpcError(null, -32003, "Forbidden origin", 403);
  }

  // This endpoint is intentionally stateless and does not offer a standalone
  // SSE stream. Streamable HTTP permits a 405 response for that capability.
  return new Response(null, {
    status: 405,
    headers: { Allow: "POST", ...responseHeaders() },
  });
}
