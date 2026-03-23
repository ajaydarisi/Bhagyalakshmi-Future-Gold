interface SearchPriceProduct {
  price: number;
  discount_price: number | null;
  is_sale: boolean;
  is_rental: boolean;
  rental_price: number | null;
  rental_discount_price: number | null;
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
