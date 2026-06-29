import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import { Fragment } from "react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[];
  homeLabel?: string;
}

export function Breadcrumbs({ items, homeLabel = "Home" }: BreadcrumbsProps) {
  return (
    <nav className="flex items-center gap-1 text-sm text-text-secondary">
      <Link href="/" className="transition-colors hover:text-text-gold">
        {homeLabel}
      </Link>
      {items.map((item, index) => (
        <Fragment key={index}>
          <ChevronRight className="h-3 w-3 text-text-muted" />
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-text-gold">
              {item.label}
            </Link>
          ) : (
            <span className="text-text-primary">{item.label}</span>
          )}
        </Fragment>
      ))}
    </nav>
  );
}
