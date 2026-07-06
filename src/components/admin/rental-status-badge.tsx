import { Badge } from "@/components/ui/badge";
import { RENTAL_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface RentalStatusBadgeProps {
  rentalStatus: string | null;
  isOverdue?: boolean;
}

export function RentalStatusBadge({
  rentalStatus,
  isOverdue,
}: RentalStatusBadgeProps) {
  const effective = isOverdue ? "overdue" : rentalStatus;
  if (!effective) return null;

  const config = RENTAL_STATUSES.find((s) => s.value === effective);

  return (
    <Badge variant="outline" className={cn("capitalize", config?.color)}>
      {config?.label || effective}
    </Badge>
  );
}
