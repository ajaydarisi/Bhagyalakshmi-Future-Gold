import { Badge } from "@/components/ui/badge";
import { ORDER_STATUSES } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface OrderStatusBadgeProps {
  status: string;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  const statusConfig = ORDER_STATUSES.find((s) => s.value === status);

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", statusConfig?.color)}
    >
      {statusConfig?.label || status}
    </Badge>
  );
}
