interface SearchPriceProduct {
  price: number;
  discount_price: number | null;
  is_sale: boolean;
  is_rental: boolean;
  rental_price: number | null;
  rental_discount_price: number | null;
}

export function isRentalOnlyProduct(product: {
  is_sale: boolean;
  is_rental: boolean;
}) {
  return product.is_rental && !product.is_sale;
}

/** Inclusive rental duration in days for ISO yyyy-MM-dd dates (same day = 1). */
export function getRentalDays(rentalStart: string, rentalEnd: string) {
  const start = new Date(rentalStart);
  const end = new Date(rentalEnd);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000);
  return Math.max(1, diff + 1);
}

/**
 * Unit price of a cart/order line. Sale products use discount_price ?? price.
 * Rental-only products use the per-day rental price × rental days, so the
 * stored unit_price is the price of the whole rental period for one set.
 */
export function getCartLineUnitPrice(
  product: SearchPriceProduct,
  rentalStart?: string | null,
  rentalEnd?: string | null
) {
  if (isRentalOnlyProduct(product)) {
    const perDay =
      product.rental_discount_price ?? product.rental_price ?? product.price;
    const days =
      rentalStart && rentalEnd ? getRentalDays(rentalStart, rentalEnd) : 1;
    return perDay * days;
  }
  // Only honour discount_price when it's actually lower than the list price;
  // matches getProductSearchPriceDisplay and avoids overcharging on bad data.
  return product.discount_price != null && product.discount_price < product.price
    ? product.discount_price
    : product.price;
}

export interface ProductSearchPriceDisplay {
  amount: number;
  originalAmount: number | null;
  isRentalOnly: boolean;
  showPerDay: boolean;
}

export function getProductSearchPriceDisplay(
  product: SearchPriceProduct
): ProductSearchPriceDisplay {
  const isRentalOnly = product.is_rental && !product.is_sale;

  if (isRentalOnly) {
    const rentalBasePrice = product.rental_price ?? product.price;
    const rentalDiscountPrice =
      product.rental_discount_price != null &&
      product.rental_discount_price < rentalBasePrice
        ? product.rental_discount_price
        : null;

    return {
      amount: rentalDiscountPrice ?? rentalBasePrice,
      originalAmount: rentalDiscountPrice ? rentalBasePrice : null,
      isRentalOnly: true,
      showPerDay: true,
    };
  }

  const saleBasePrice = product.price;
  const saleDiscountPrice =
    product.discount_price != null && product.discount_price < saleBasePrice
      ? product.discount_price
      : null;

  return {
    amount: saleDiscountPrice ?? saleBasePrice,
    originalAmount: saleDiscountPrice ? saleBasePrice : null,
    isRentalOnly: false,
    showPerDay: false,
  };
}
