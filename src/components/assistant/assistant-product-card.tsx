"use client";

import Image from "next/image";
import { Link } from "@/i18n/routing";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/lib/constants";
import { formatPrice } from "@/lib/formatters";
import { getCategoryName, getProductName } from "@/lib/i18n-helpers";
import type { AssistantProductMatch } from "@/types/search";
import { useTranslations } from "next-intl";

interface AssistantProductCardProps {
  locale: string;
  product: AssistantProductMatch;
  onClick?: () => void;
}

function PriceLine(args: {
  label: string;
  amount: number;
  originalAmount?: number | null;
  suffix?: string;
}) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
      <span className="font-medium text-foreground/80">{args.label}</span>
      <span className="font-semibold text-foreground">
        {formatPrice(args.amount)}
        {args.suffix ? (
          <span className="ml-0.5 font-normal text-muted-foreground">
            {args.suffix}
          </span>
        ) : null}
      </span>
      {args.originalAmount ? (
        <span className="text-[11px] text-muted-foreground line-through">
          {formatPrice(args.originalAmount)}
        </span>
      ) : null}
    </div>
  );
}

export function AssistantProductCard({
  locale,
  product,
  onClick,
}: AssistantProductCardProps) {
  const t = useTranslations("products.card");
  const td = useTranslations("products.detail");
  const displayName = getProductName(product, locale);
  const categoryName = product.categoryName
    ? getCategoryName(
        {
          name: product.categoryName,
          name_telugu: product.categoryNameTelugu,
        },
        locale
      )
    : null;

  return (
    <Link
      href={ROUTES.product(product.slug)}
      onClick={onClick}
      className="group flex w-full min-w-0 items-start gap-3 overflow-hidden rounded-xl border bg-background/80 p-3 transition-colors hover:border-[var(--border-gold)] hover:bg-accent/30"
      data-assistant-product-card
      data-assistant-product-slug={product.slug}
    >
      <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
        {product.primaryImage ? (
          <Image
            src={product.primaryImage}
            alt={displayName}
            fill
            sizes="64px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-2 text-center text-[10px] text-muted-foreground">
            {t("noImage")}
          </div>
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-1.5">
            {categoryName ? (
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {categoryName}
              </p>
            ) : null}
            {product.isSale ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {td("forSale")}
              </Badge>
            ) : null}
            {product.isRental ? (
              <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                {td("forRent")}
              </Badge>
            ) : null}
          </div>
          <p className="line-clamp-2 text-sm font-medium leading-snug transition-colors group-hover:text-text-gold">
            {displayName}
          </p>
          {product.setNumber ? (
            <p className="text-xs text-muted-foreground">
              {td("setNumber", { number: product.setNumber })}
            </p>
          ) : null}
        </div>

        <div className="space-y-1">
          {product.salePrice != null ? (
            <PriceLine
              label={td("forSale")}
              amount={product.salePrice}
              originalAmount={product.saleOriginalPrice}
            />
          ) : null}
          {product.rentalPrice != null ? (
            <PriceLine
              label={td("forRent")}
              amount={product.rentalPrice}
              originalAmount={product.rentalOriginalPrice}
              suffix={td("perDay")}
            />
          ) : null}
        </div>
      </div>
    </Link>
  );
}
