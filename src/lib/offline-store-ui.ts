import { addDays, format } from "date-fns";
import { IS_ONLINE } from "@/lib/constants";

type OnlineOnlyLink = {
  onlineOnly?: boolean;
};

export function getVisibleStoreLinks<T extends OnlineOnlyLink>(
  links: readonly T[],
  isOnline: boolean = IS_ONLINE
) {
  return links.filter((link) => !link.onlineOnly || isOnline);
}

export function shouldShowSoldOutOverlay(
  stock: number,
  isOnline: boolean = IS_ONLINE
) {
  return isOnline && stock === 0;
}

export function getProductDetailDisplayState(
  isOnline: boolean = IS_ONLINE
) {
  return {
    showCartAction: isOnline,
    showAvailabilityAction: !isOnline,
    showStockAvailability: isOnline,
  };
}

export function getWishlistPrimaryActionMode(
  isOnline: boolean = IS_ONLINE
) {
  return isOnline ? "move-to-cart" : "check-availability";
}

function formatDateForMessage(date: Date) {
  return format(date, "dd MMM yyyy");
}

function normalizeStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

export function buildAvailabilityMessage(args: {
  productName: string;
  productSlug: string;
  origin: string;
  intro: string;
}) {
  const previewUrl = `${args.origin}/preview/${args.productSlug}`;
  return `${args.intro}\n\n*${args.productName}*\n${previewUrl}`;
}

export function buildRentalAvailabilityMessage(args: {
  productName: string;
  productSlug: string;
  origin: string;
  intro: string;
  fromLabel: string;
  toLabel: string;
  startDate: Date;
  endDate: Date;
}) {
  const previewUrl = `${args.origin}/preview/${args.productSlug}`;
  return `${args.intro}\n\n*${args.productName}*\n${args.fromLabel}: ${formatDateForMessage(args.startDate)}\n${args.toLabel}: ${formatDateForMessage(args.endDate)}\n\n${previewUrl}`;
}

export function getRentalDateConstraints(args: {
  startDate?: Date;
  maxRentalDays?: number | null;
  today?: Date;
}) {
  const today = normalizeStartOfDay(args.today ?? new Date());
  return {
    endDateMin: args.startDate ?? today,
    endDateMax:
      // maxRentalDays is an inclusive day count (getRentalDays counts the start
      // day), so the last valid end date is start + (maxRentalDays - 1).
      // Using maxRentalDays here would let the picker offer a period the
      // checkout server then rejects with "can be rented for at most N days".
      args.startDate && args.maxRentalDays
        ? addDays(args.startDate, args.maxRentalDays - 1)
        : undefined,
  };
}
