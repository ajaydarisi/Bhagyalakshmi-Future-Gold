import {
  getAssistantRouteManifestPublicEntries,
  serializeAssistantRoute,
} from "@/lib/assistant-route-manifest";
import { sanitizeAssistantNavigation } from "@/lib/assistant-navigation";
import { APP_DESCRIPTION, APP_NAME } from "@/lib/constants";
import type { AssistantNavigation } from "@/types/search";

export const AGENT_NAVIGATION_MANIFEST_PATH = "/.well-known/agent-navigation.json";
export const AGENT_NAVIGATION_MCP_PATH = "/api/mcp";
export const AGENT_NAVIGATION_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
] as const;

const MAX_ROUTE_PARAMS_BYTES = 6_000;
const EXTERNAL_ROUTE_IDS_TO_EXCLUDE = new Set([
  "login",
  "signup",
  "forgot_password",
]);

export type PublicAgentRoute = ReturnType<
  typeof getAssistantRouteManifestPublicEntries
>[number];

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedJson(value: unknown) {
  try {
    return JSON.stringify(value).length <= MAX_ROUTE_PARAMS_BYTES;
  } catch {
    return false;
  }
}

export function getAgentNavigationSiteUrl() {
  return (process.env.NEXT_PUBLIC_SITE_URL || "https://bfg.darisi.in").replace(
    /\/+$/,
    "",
  );
}

/**
 * The external surface intentionally contains only routes an unauthenticated
 * agent can safely hand to a shopper. Account, order, checkout, and admin
 * destinations remain behind the authenticated first-party experience.
 */
export function getPublicAgentRoutes(): PublicAgentRoute[] {
  return getAssistantRouteManifestPublicEntries().filter(
    (route) =>
      route.auth === "public" &&
      route.entityResolution === "none" &&
      !EXTERNAL_ROUTE_IDS_TO_EXCLUDE.has(route.id),
  );
}

export function resolvePublicAgentRoute(args: {
  routeId: unknown;
  params?: unknown;
  storeMode?: unknown;
}): AssistantNavigation | null {
  if (typeof args.routeId !== "string" || args.routeId.length === 0) {
    return null;
  }

  const route = getPublicAgentRoutes().find((candidate) => candidate.id === args.routeId);
  if (!route) {
    return null;
  }

  const params = args.params ?? {};
  if (!isPlainRecord(params) || !isBoundedJson(params)) {
    return null;
  }

  const storeMode =
    args.storeMode === "ONLINE" || args.storeMode === "OFFLINE"
      ? args.storeMode
      : undefined;
  const navigation = serializeAssistantRoute(route.id, params, { storeMode });

  // Do not treat the manifest serializer as a transport boundary. A second,
  // shared sanitizer keeps this endpoint aligned with the first-party assistant.
  return sanitizeAssistantNavigation(navigation);
}

export function buildAgentNavigationManifest(siteUrl = getAgentNavigationSiteUrl()) {
  return {
    schemaVersion: "2026-07-19",
    name: APP_NAME,
    description: APP_DESCRIPTION,
    website: siteUrl,
    llms: `${siteUrl}/llms.txt`,
    mcp: {
      endpoint: `${siteUrl}${AGENT_NAVIGATION_MCP_PATH}`,
      transport: "streamable-http",
      protocolVersions: AGENT_NAVIGATION_PROTOCOL_VERSIONS,
      readOnly: true,
    },
    constraints: [
      "Only public storefront routes are exposed.",
      "Use resolve_store_route or the first-party app to serialize a route; never invent a URL.",
      "No account, order, checkout, payment, admin, or write capability is available.",
    ],
    routes: getPublicAgentRoutes(),
  };
}

export function buildLlmsText(siteUrl = getAgentNavigationSiteUrl()) {
  const routeLines = getPublicAgentRoutes().flatMap((route) => {
    const examples = route.copy.en.examples
      .slice(0, 2)
      .map((example) => ` Example: “${example}”.`)
      .join("");
    const navigation = resolvePublicAgentRoute({ routeId: route.id });
    if (!navigation) return [];

    return [
      `- [${route.id}](${siteUrl}${navigation.href}): ${route.copy.en.description}.${examples}`,
    ];
  });

  return [
    `# ${APP_NAME}`,
    `> ${APP_DESCRIPTION}`,
    "",
    "## Storefront navigation",
    ...routeLines,
    "",
    "## Agent integration",
    `- [Route manifest](${siteUrl}${AGENT_NAVIGATION_MANIFEST_PATH}): bilingual public routes, parameter schemas, availability, and safety constraints.`,
    `- [Read-only MCP endpoint](${siteUrl}${AGENT_NAVIGATION_MCP_PATH}): call \`list_store_routes\` before \`resolve_store_route\`; it returns only manifest-validated internal hrefs.`,
    "",
    "## Boundaries",
    "- Keep the shopper in control and use the normal storefront links when a route is not a confident match.",
    "- Do not attempt checkout, account, order, payment, admin, or other authenticated actions through this public surface.",
    "- Product-specific entities are resolved by the storefront’s own catalog search, not by guessing slugs.",
    "",
  ].join("\n");
}

export function getAgentNavigationMcpTools() {
  const routeIds = getPublicAgentRoutes().map((route) => route.id);

  return [
    {
      name: "list_store_routes",
      title: "List public storefront routes",
      description:
        "Lists the public Bhagyalakshmi Future Gold customer routes, bilingual examples, parameter schemas, and store-mode availability.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    {
      name: "resolve_store_route",
      title: "Resolve a public storefront route",
      description:
        "Serializes a public route ID and validated parameters into a safe internal storefront href. It cannot navigate to account, order, checkout, payment, admin, or arbitrary external URLs.",
      inputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          routeId: {
            type: "string",
            enum: routeIds,
            description: "A public route ID returned by list_store_routes.",
          },
          params: {
            type: "object",
            description:
              "Route parameters validated against the route’s manifest schema. Omit for parameterless routes.",
            additionalProperties: true,
          },
          storeMode: {
            type: "string",
            enum: ["ONLINE", "OFFLINE"],
            description:
              "Optional storefront mode used to reject routes unavailable in that mode.",
          },
        },
        required: ["routeId"],
      },
      outputSchema: {
        type: "object",
        additionalProperties: false,
        properties: {
          routeId: { type: "string" },
          href: { type: "string", pattern: "^/" },
          destination: { type: "string" },
          kind: { type: "string" },
        },
        required: ["routeId", "href", "destination", "kind"],
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
  ] as const;
}
