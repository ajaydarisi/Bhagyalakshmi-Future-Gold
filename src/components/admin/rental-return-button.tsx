"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Loader2, PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { markRentalReturned } from "@/app/admin/actions";

interface RentalReturnButtonProps {
  orderId: string;
}

export function RentalReturnButton({ orderId }: RentalReturnButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      const result = await markRentalReturned(orderId);
      if (result.error) {
        toast.error(result.error);
      } else {
        toast.success("Rental marked as returned");
        router.refresh();
      }
    });
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      disabled={isPending}
    >
      {isPending ? (
        <Loader2 className="mr-2 size-4 animate-spin" />
      ) : (
        <PackageCheck className="mr-2 size-4" />
      )}
      Mark Returned
    </Button>
  );
}
