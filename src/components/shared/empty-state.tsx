import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  actionLabel?: string;
  actionHref?: string;
}

/**
 * Editorial empty state — gold-gradient icon disc, serif title, gold CTA.
 * Reskinned to the BFG design system (ui_kits empty-state pattern).
 */
export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div
        className="mb-5 grid size-20 place-items-center rounded-full text-text-gold"
        style={{ background: "var(--grad-gold-soft)", boxShadow: "var(--shadow-sm)" }}
      >
        {icon || <PackageOpen className="size-8" strokeWidth={1.7} />}
      </div>
      <h3 className="font-display text-3xl text-text-primary">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-text-secondary">{description}</p>
      )}
      {actionLabel && actionHref && (
        <Button asChild variant="gold" size="bfg-md" className="mt-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  );
}
