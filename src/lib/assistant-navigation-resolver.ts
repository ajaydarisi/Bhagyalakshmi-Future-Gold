import { buildAssistantProductSearchQuery } from "@/lib/assistant";
import {
  resolveAssistantDynamicNavigationIntent,
  type AssistantDynamicNavigationIntent,
} from "@/lib/assistant-navigation";
import {
  serializeAssistantRoute,
  type AssistantRouteId,
} from "@/lib/assistant-route-manifest";
import { retrieveCatalogContext } from "@/lib/retrieval/catalog";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient, getAuthUser } from "@/lib/supabase/server";
import type {
  AssistantNavigation,
  AssistantNavigationOption,
} from "@/types/search";

const MAX_NAVIGATION_OPTIONS = 3;
const ORDER_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type NavigationProduct = {
  id: string;
  slug: string;
  name: string;
  name_telugu: string | null;
  set_number: number | null;
};

export type NavigationOrder = {
  id: string;
  order_number: string;
  created_at: string;
};

export type AssistantDynamicNavigationResolution =
  | {
      type: "navigation";
      navigation: AssistantNavigation;
      noMatchingOrder?: boolean;
    }
  | {
      type: "options";
      optionType: "product" | "order";
      options: AssistantNavigationOption[];
    }
  | null;

export interface AssistantDynamicNavigationDependencies {
  findExactProductMatches?: (query: string) => Promise<NavigationProduct[]>;
  findProductCandidates?: (args: {
    query: string;
    locale: string;
  }) => Promise<NavigationProduct[]>;
  getAuthenticatedUser?: () => Promise<{ id: string } | null>;
  findOwnedOrder?: (args: {
    userId: string;
    orderReference: string;
  }) => Promise<NavigationOrder | null>;
  findRecentOwnedOrders?: (userId: string) => Promise<NavigationOrder[]>;
}

function uniqueById<T extends { id: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

function manifestNavigation(routeId: AssistantRouteId, params: unknown): AssistantNavigation {
  const navigation = serializeAssistantRoute(routeId, params);
  if (!navigation) {
    throw new Error(`Invalid assistant manifest navigation: ${routeId}`);
  }

  return navigation;
}

function productNavigation(slug: string): AssistantNavigation {
  return manifestNavigation("product_detail", { slug });
}

function ordersNavigation(): AssistantNavigation {
  return manifestNavigation("orders", {});
}

function orderNavigation(id: string): AssistantNavigation {
  return manifestNavigation("order_detail", { id });
}

function confirmationNavigation(id: string): AssistantNavigation {
  return manifestNavigation("checkout_confirmation", { orderId: id });
}

function productOptions(products: NavigationProduct[], locale: string) {
  return products.slice(0, MAX_NAVIGATION_OPTIONS).map((product) => ({
    id: `product:${product.id}`,
    label:
      locale === "te" && product.name_telugu
        ? product.name_telugu
        : product.name,
    description:
      product.set_number !== null
        ? locale === "te"
          ? `సెట్ నంబర్ ${product.set_number}`
          : `Set number ${product.set_number}`
        : null,
    navigation: productNavigation(product.slug),
  } satisfies AssistantNavigationOption));
}

function orderOptions(orders: NavigationOrder[], locale: string) {
  const formatter = new Intl.DateTimeFormat(locale === "te" ? "te-IN" : "en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return orders.slice(0, MAX_NAVIGATION_OPTIONS).map((order) => ({
    id: `order:${order.id}`,
    label: locale === "te" ? `ఆర్డర్ ${order.order_number}` : `Order ${order.order_number}`,
    description: formatter.format(new Date(order.created_at)),
    navigation: orderNavigation(order.id),
  } satisfies AssistantNavigationOption));
}

function extractSetNumber(value: string) {
  const match = value.match(/(?:\bset(?:\s+(?:number|no\.?))?\b|సెట్)\s*#?\s*(\d{1,8})/i);
  if (!match) return null;
  const setNumber = Number(match[1]);
  return Number.isSafeInteger(setNumber) && setNumber > 0 ? setNumber : null;
}

function escapeIlikeExactValue(value: string) {
  return value.replace(/[\\%_]/g, "\\$&");
}

async function findExactProductMatches(query: string) {
  const admin = createAdminClient();
  const setNumber = extractSetNumber(query);
  const exactQuery = escapeIlikeExactValue(query);
  const select = "id, slug, name, name_telugu, set_number";
  const lookups = [
    admin
      .from("products")
      .select(select)
      .eq("is_active", true)
      .eq("slug", query.toLowerCase())
      .limit(MAX_NAVIGATION_OPTIONS),
    admin
      .from("products")
      .select(select)
      .eq("is_active", true)
      .ilike("name", exactQuery)
      .limit(MAX_NAVIGATION_OPTIONS),
    admin
      .from("products")
      .select(select)
      .eq("is_active", true)
      .ilike("name_telugu", exactQuery)
      .limit(MAX_NAVIGATION_OPTIONS),
  ];
  if (setNumber !== null) {
    lookups.push(
      admin
        .from("products")
        .select(select)
        .eq("is_active", true)
        .eq("set_number", setNumber)
        .limit(MAX_NAVIGATION_OPTIONS),
    );
  }

  const results = await Promise.all(lookups);
  return uniqueById(
    results.flatMap((result) => (result.data ?? []) as NavigationProduct[]),
  );
}

async function findProductCandidates(args: {
  query: string;
  locale: string;
}) {
  const catalogQuery = buildAssistantProductSearchQuery({
    latestUserMessage: args.query,
  });
  const context = await retrieveCatalogContext({
    query: catalogQuery,
    locale: args.locale,
    sourceTypes: ["product"],
    limit: MAX_NAVIGATION_OPTIONS,
    mode: "keyword",
  });

  return uniqueById(
    context.items.flatMap((item) => {
      if (!item.hit || !item.slug) return [];
      return [
        {
          id: item.hit.id,
          slug: item.slug,
          name: item.hit.name,
          name_telugu: item.hit.name_telugu,
          set_number: item.hit.set_number,
        } satisfies NavigationProduct,
      ];
    }),
  );
}

async function resolveProductNavigation(args: {
  query: string;
  locale: string;
}, dependencies: AssistantDynamicNavigationDependencies): Promise<AssistantDynamicNavigationResolution> {
  const exactMatches = await (dependencies.findExactProductMatches ?? findExactProductMatches)(
    args.query,
  );
  if (exactMatches.length === 1) {
    return { type: "navigation", navigation: productNavigation(exactMatches[0].slug) };
  }
  if (exactMatches.length > 1) {
    return {
      type: "options",
      optionType: "product",
      options: productOptions(exactMatches, args.locale),
    };
  }

  const candidates = await (dependencies.findProductCandidates ?? findProductCandidates)(args);

  if (candidates.length > 0) {
    return {
      type: "options",
      optionType: "product",
      options: productOptions(candidates, args.locale),
    };
  }

  return {
    type: "navigation",
    navigation: manifestNavigation("products", { q: args.query }),
  };
}

async function findOwnedOrder(args: {
  userId: string;
  orderReference: string;
}) {
  const supabase = await createClient();
  let query = supabase
    .from("orders")
    .select("id, order_number, created_at")
    .eq("user_id", args.userId);

  if (args.orderReference === "latest") {
    const { data } = await query.order("created_at", { ascending: false }).limit(1);
    return (data?.[0] as NavigationOrder | undefined) ?? null;
  }

  query = ORDER_UUID_PATTERN.test(args.orderReference)
    ? query.eq("id", args.orderReference)
    : query.eq("order_number", args.orderReference);
  const { data } = await query.maybeSingle();
  return (data as NavigationOrder | null) ?? null;
}

async function findRecentOwnedOrders(userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("id, order_number, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(MAX_NAVIGATION_OPTIONS);
  return (data ?? []) as NavigationOrder[];
}

async function getAuthenticatedNavigationUser() {
  const supabase = await createClient();
  return getAuthUser(supabase);
}

async function resolveOrderNavigation(
  intent: Extract<AssistantDynamicNavigationIntent, { type: "order" | "confirmation" }>,
  locale: string,
  dependencies: AssistantDynamicNavigationDependencies,
): Promise<AssistantDynamicNavigationResolution> {
  const user = await (dependencies.getAuthenticatedUser ?? getAuthenticatedNavigationUser)();
  if (!user) {
    return { type: "navigation", navigation: ordersNavigation() };
  }

  if (intent.orderReference) {
    const order = await (dependencies.findOwnedOrder ?? findOwnedOrder)({
      userId: user.id,
      orderReference: intent.orderReference,
    });
    if (order) {
      return {
        type: "navigation",
        navigation:
          intent.type === "confirmation"
            ? confirmationNavigation(order.id)
            : orderNavigation(order.id),
      };
    }

    return {
      type: "navigation",
      navigation: ordersNavigation(),
      noMatchingOrder: true,
    };
  }

  if (intent.type === "confirmation") {
    return { type: "navigation", navigation: ordersNavigation() };
  }

  const orders = await (dependencies.findRecentOwnedOrders ?? findRecentOwnedOrders)(user.id);
  if (orders.length > 0) {
    return {
      type: "options",
      optionType: "order",
      options: orderOptions(orders, locale),
    };
  }

  return {
    type: "navigation",
    navigation: ordersNavigation(),
    noMatchingOrder: true,
  };
}

/** Resolve dynamic product and customer-owned order targets on the server. */
export async function resolveAssistantDynamicNavigation(args: {
  query: string;
  locale: string;
}, dependencies: AssistantDynamicNavigationDependencies = {}): Promise<AssistantDynamicNavigationResolution> {
  const intent = resolveAssistantDynamicNavigationIntent(args.query);
  if (!intent) return null;

  try {
    if (intent.type === "product") {
      return await resolveProductNavigation(
        { query: intent.query, locale: args.locale },
        dependencies,
      );
    }

    return await resolveOrderNavigation(intent, args.locale, dependencies);
  } catch (error) {
    console.error("[assistant.navigation] Failed to resolve dynamic target", error);
    return null;
  }
}
