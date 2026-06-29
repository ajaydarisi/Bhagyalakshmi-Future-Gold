import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

interface StatsCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  description?: string;
}

export function StatsCard({ label, value, icon: Icon, description }: StatsCardProps) {
  return (
    <Card className="transition-colors hover:border-[var(--border-gold)]">
      <CardContent className="flex items-center gap-4">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-lg text-gold-700"
          style={{ background: "var(--grad-gold-soft)" }}
        >
          <Icon className="size-6" strokeWidth={1.7} />
        </div>
        <div className="min-w-0">
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="font-display text-3xl tracking-tight text-text-primary">{value}</p>
          {description && (
            <p className="text-xs text-text-secondary">{description}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
