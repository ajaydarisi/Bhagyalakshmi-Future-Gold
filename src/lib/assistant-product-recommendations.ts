import { ASSISTANT_PRODUCT_RECOMMENDATION_LIMIT } from "@/lib/assistant-config";
import type {
  AssistantPageContext,
  AssistantProductMatch,
  AssistantReply,
  RetrievedContextItem,
} from "@/types/search";

function hasProductCitation(reply: AssistantReply) {
  return reply.citations.some((citation) => citation.sourceType === "product");
}

export function isPolicyOrStoreInfoRequest(query: string) {
  return /\b(return|refund|exchange|policy|policies|shipping|delivery|store info|store information|hours|timings|location|address|contact|phone|whatsapp|payment|cod|cash on delivery|privacy|terms|faq|warranty|cancel|cancellation)\b/i.test(
    query
  ) || /(రిటర్న్|రిఫండ్|ఎక్స్చేంజ్|పాలసీ|పాలసీలు|షిప్పింగ్|డెలివరీ|స్టోర్ సమాచారం|స్టోర్|సమయాలు|చిరునామా|కాంటాక్ట్|ఫోన్|వాట్సాప్|చెల్లింపు|ప్రైవసీ|నిబంధనలు|క్యాన్సిల్)/.test(
    query
  );
}

export function isProductSeekingAssistantRequest(query: string) {
  return /\b(show|recommend|suggest|find|looking for|search|browse|discover|buy|shop|rent|rental|compare|similar|alternative|under|budget|cheaper|affordable|bridal|wedding|necklace|earring|earrings|ring|rings|bangle|bangles|bracelet|bracelets|set|sets|chain|chains|jewellery|jewelry|available|have|collection|designs?)\b/i.test(
    query
  ) || /(చూపించు|చూపించండి|సూచించు|సిఫారసు|వెతుకు|వెతకండి|కొన|కొనాలి|షాప్|అద్దె|అద్దెకు|పోల్చు|ఇలాంటివి|బడ్జెట్|లోపు|వివాహం|పెళ్లి|హారం|చెవి రింగులు|ఉంగరం|గాజులు|సెట్|సెట్లు|జ్యువెలరీ|అందుబాటులో)/.test(
    query
  );
}

function shouldRecommendProducts(args: {
  latestUserMessage: string;
  pageContext?: AssistantPageContext | null;
  reply: AssistantReply;
}) {
  if (args.reply.fallbackReason || !hasProductCitation(args.reply)) {
    return false;
  }

  const normalizedQuery = args.latestUserMessage.trim();
  if (!normalizedQuery) {
    return false;
  }

  if (isPolicyOrStoreInfoRequest(normalizedQuery)) {
    return false;
  }

  if (args.pageContext?.product?.slug?.trim()) {
    return true;
  }

  return isProductSeekingAssistantRequest(normalizedQuery);
}

function buildAssistantProductMatch(
  item: RetrievedContextItem
): AssistantProductMatch | null {
  if (item.sourceType !== "product" || !item.hit) {
    return null;
  }

  const hit = item.hit;
  const saleOriginalPrice =
    hit.is_sale &&
    hit.discount_price != null &&
    hit.discount_price < hit.price
      ? hit.price
      : null;
  const rentalBasePrice = hit.rental_price ?? null;
  const rentalOriginalPrice =
    hit.is_rental &&
    hit.rental_discount_price != null &&
    rentalBasePrice != null &&
    hit.rental_discount_price < rentalBasePrice
      ? rentalBasePrice
      : null;

  return {
    id: hit.id,
    slug: hit.slug,
    sourceKey: item.sourceKey,
    name: hit.name,
    name_telugu: hit.name_telugu,
    primaryImage: hit.images[0] ?? null,
    categoryName: hit.category?.name ?? null,
    categoryNameTelugu: hit.category?.name_telugu ?? null,
    isSale: hit.is_sale,
    isRental: hit.is_rental,
    salePrice: hit.is_sale ? hit.discount_price ?? hit.price : null,
    saleOriginalPrice,
    rentalPrice: hit.is_rental ? hit.rental_discount_price ?? rentalBasePrice : null,
    rentalOriginalPrice,
    setNumber: hit.set_number ? String(hit.set_number) : null,
  };
}

export function selectAssistantRecommendedProducts(args: {
  latestUserMessage: string;
  reply: AssistantReply;
  retrievedContext: RetrievedContextItem[];
  pageContext?: AssistantPageContext | null;
  limit?: number;
}) {
  if (
    !shouldRecommendProducts({
      latestUserMessage: args.latestUserMessage,
      pageContext: args.pageContext,
      reply: args.reply,
    })
  ) {
    return [] as AssistantProductMatch[];
  }

  const candidates = args.retrievedContext.reduce<
    Array<{
      sourceKey: string;
      slug: string;
      product: AssistantProductMatch;
    }>
  >((items, item) => {
    const product = buildAssistantProductMatch(item);
    if (!product) {
      return items;
    }

    const alreadyIncluded = items.some(
      (candidate) => candidate.product.id === product.id
    );
    if (alreadyIncluded) {
      return items;
    }

    items.push({
      sourceKey: item.sourceKey,
      slug: product.slug,
      product,
    });

    return items;
  }, []);

  if (candidates.length === 0) {
    return [];
  }

  const ordered: AssistantProductMatch[] = [];
  const addedIds = new Set<string>();
  const currentProductSlug = args.pageContext?.product?.slug?.trim().toLowerCase();

  if (currentProductSlug) {
    const currentProduct = candidates.find(
      (candidate) => candidate.slug.trim().toLowerCase() === currentProductSlug
    );

    if (currentProduct) {
      ordered.push(currentProduct.product);
      addedIds.add(currentProduct.product.id);
    }
  }

  for (const citation of args.reply.citations) {
    if (citation.sourceType !== "product") {
      continue;
    }

    const candidate = candidates.find(
      (item) => item.sourceKey === citation.sourceKey
    );
    if (!candidate || addedIds.has(candidate.product.id)) {
      continue;
    }

    ordered.push(candidate.product);
    addedIds.add(candidate.product.id);
  }

  for (const candidate of candidates) {
    if (addedIds.has(candidate.product.id)) {
      continue;
    }

    ordered.push(candidate.product);
    addedIds.add(candidate.product.id);
  }

  return ordered.slice(
    0,
    args.limit ?? ASSISTANT_PRODUCT_RECOMMENDATION_LIMIT
  );
}

export function attachAssistantRecommendedProducts(args: {
  latestUserMessage: string;
  reply: AssistantReply;
  retrievedContext: RetrievedContextItem[];
  pageContext?: AssistantPageContext | null;
  limit?: number;
}) {
  const recommendedProducts = selectAssistantRecommendedProducts(args);
  if (recommendedProducts.length === 0) {
    return args.reply;
  }

  return {
    ...args.reply,
    recommendedProducts,
  } satisfies AssistantReply;
}
