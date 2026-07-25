import { GET as getAgentNavigationManifest } from "@/app/.well-known/agent-navigation.json/route";
import { GET as getMcp, POST as postMcp } from "@/app/api/mcp/route";
import { GET as getLlms } from "@/app/llms.txt/route";
import {
  getPublicAgentRoutes,
  resolvePublicAgentRoute,
} from "@/lib/agent-navigation-surface";
import { describe, expect, it } from "vitest";

function mcpRequest(payload: unknown, options?: { origin?: string }) {
  return new Request("https://bfg.darisi.in/api/mcp", {
    method: "POST",
    headers: {
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
      ...(options?.origin ? { Origin: options.origin } : {}),
    },
    body: JSON.stringify(payload),
  });
}

describe("public agent navigation surface", () => {
  it("publishes only public, non-entity customer routes", () => {
    const routeIds = getPublicAgentRoutes().map((route) => route.id);

    expect(routeIds).toContain("products");
    expect(routeIds).toContain("terms");
    expect(routeIds).not.toEqual(
      expect.arrayContaining([
        "cart",
        "checkout",
        "wishlist",
        "account",
        "orders",
        "addresses",
        "login",
        "signup",
        "forgot_password",
        "product_detail",
        "order_detail",
        "checkout_confirmation",
      ]),
    );
  });

  it("serializes only a manifest-approved public href", () => {
    expect(
      resolvePublicAgentRoute({
        routeId: "products",
        params: { type: "sale", q: "earrings" },
      }),
    ).toEqual({
      kind: "product_filters",
      destination: "products",
      href: "/products?type=sale&q=earrings",
    });
    expect(resolvePublicAgentRoute({ routeId: "checkout" })).toBeNull();
    expect(
      resolvePublicAgentRoute({
        routeId: "products",
        params: { q: "earrings", untrusted: "value" },
      }),
    ).toBeNull();
  });

  it("serves llms.txt and the JSON manifest from the same route source", async () => {
    const [llmsResponse, manifestResponse] = await Promise.all([
      getLlms(),
      getAgentNavigationManifest(),
    ]);
    const [llms, manifest] = await Promise.all([
      llmsResponse.text(),
      manifestResponse.json() as Promise<{ routes: Array<{ id: string }> }>,
    ]);

    expect(llmsResponse.headers.get("content-type")).toContain("text/plain");
    expect(llms).toContain("# Bhagyalakshmi Future Gold");
    expect(llms).toContain("/.well-known/agent-navigation.json");
    expect(llms).not.toContain("/checkout");
    expect(manifest.routes.map((route) => route.id)).toEqual(
      getPublicAgentRoutes().map((route) => route.id),
    );
  });
});

describe("read-only MCP navigation endpoint", () => {
  it("negotiates, lists tools, and resolves a safe public route", async () => {
    const initialize = await postMcp(
      mcpRequest({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: { protocolVersion: "2025-11-25", capabilities: {}, clientInfo: {} },
      }),
    );
    expect(initialize.status).toBe(200);
    expect((await initialize.json()).result.protocolVersion).toBe("2025-11-25");

    const list = await postMcp(
      mcpRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" }),
    );
    const listBody = (await list.json()) as {
      result: { tools: Array<{ name: string }> };
    };
    expect(listBody.result.tools.map((tool) => tool.name)).toEqual([
      "list_store_routes",
      "resolve_store_route",
    ]);

    const resolve = await postMcp(
      mcpRequest({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "resolve_store_route",
          arguments: { routeId: "products", params: { tag: "Trending" } },
        },
      }),
    );
    const resolveBody = (await resolve.json()) as {
      result: { isError: boolean; structuredContent: { href: string } };
    };
    expect(resolveBody.result.isError).toBe(false);
    expect(resolveBody.result.structuredContent.href).toBe("/products?tag=Trending");
  });

  it("returns an MCP tool error instead of exposing a private route", async () => {
    const response = await postMcp(
      mcpRequest({
        jsonrpc: "2.0",
        id: 4,
        method: "tools/call",
        params: {
          name: "resolve_store_route",
          arguments: { routeId: "checkout" },
        },
      }),
    );
    const body = (await response.json()) as {
      result: { isError: boolean; structuredContent: { error: string } };
    };

    expect(response.status).toBe(200);
    expect(body.result.isError).toBe(true);
    expect(body.result.structuredContent.error).toContain("public");
  });

  it("rejects a cross-origin browser call and declines standalone SSE", async () => {
    const crossOrigin = await postMcp(
      mcpRequest(
        { jsonrpc: "2.0", id: 5, method: "tools/list" },
        { origin: "https://attacker.example" },
      ),
    );
    expect(crossOrigin.status).toBe(403);

    const getResponse = await getMcp(
      new Request("https://bfg.darisi.in/api/mcp", {
        headers: { Accept: "text/event-stream" },
      }),
    );
    expect(getResponse.status).toBe(405);
    expect(getResponse.headers.get("allow")).toBe("POST");
  });
});
