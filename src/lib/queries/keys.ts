export const queryKeys = {
  products: {
    all: ["products"] as const,
    list: (params: Record<string, unknown>) =>
      ["products", "list", params] as const,
    detail: (slug: string) => ["products", "detail", slug] as const,
    featured: ["products", "featured"] as const,
    new: ["products", "new"] as const,
    related: (categoryId: string, excludeId: string) =>
      ["products", "related", categoryId, excludeId] as const,
  },
  wishlist: {
    all: ["wishlist"] as const,
    products: (userId: string) => ["wishlist", "products", userId] as const,
  },
  categories: {
    all: ["categories"] as const,
  },
};
