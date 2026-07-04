"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getRentalDateConstraints } from "@/lib/offline-store-ui";
import { cn } from "@/lib/utils";
import { CalendarIcon } from "lucide-react";
import { useTranslations } from "next-intl";

interface RentalDatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  maxRentalDays?: number | null;
  /** When set, booked dates are fetched and disabled in the calendars. */
  productId?: string;
  confirmLabel: string;
  confirmIcon?: React.ReactNode;
  /** Extra classes for the confirm button (e.g. WhatsApp green). */
  confirmClassName?: string;
  onConfirm: (startDate: Date, endDate: Date) => void;
}

interface RentalAvailability {
  capacity: number;
  bookedRanges: { start: string; end: string; quantity: number }[];
}

function normalizeStartOfDay(date: Date) {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

/**
 * Rental period picker shared by the WhatsApp availability flow and the
 * online rent-to-cart flow. Start date >= today; end date bounded by
 * maxRentalDays via getRentalDateConstraints.
 */
export function RentalDatesDialog({
  open,
  onOpenChange,
  maxRentalDays,
  productId,
  confirmLabel,
  confirmIcon,
  confirmClassName,
  onConfirm,
}: RentalDatesDialogProps) {
  const t = useTranslations("products");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);
  const [availability, setAvailability] = useState<RentalAvailability | null>(null);

  // Booked dates for this product — advisory only; checkout re-validates.
  useEffect(() => {
    if (!open || !productId) return;
    fetch(`/api/rentals/availability?productId=${productId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then(setAvailability)
      .catch(() => setAvailability(null));
  }, [open, productId]);

  const today = normalizeStartOfDay(new Date());
  const { endDateMin, endDateMax } = getRentalDateConstraints({
    startDate,
    maxRentalDays,
    today,
  });

  function bookedUnitsOn(day: string) {
    if (!availability) return 0;
    return availability.bookedRanges.reduce(
      (sum, r) => (r.start <= day && r.end >= day ? sum + r.quantity : sum),
      0
    );
  }

  function isDateFullyBooked(date: Date) {
    if (!availability) return false;
    return bookedUnitsOn(format(date, "yyyy-MM-dd")) >= availability.capacity;
  }

  function handleConfirm() {
    if (!startDate || !endDate) return;
    // The calendars disable fully booked days, but a range can still span one
    // (start before, end after). Scan the whole period before confirming.
    if (availability) {
      const cursor = new Date(startDate);
      while (cursor <= endDate) {
        if (isDateFullyBooked(cursor)) {
          toast.error(t("rentalUnavailable"));
          return;
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    onConfirm(startDate, endDate);
    onOpenChange(false);
    setStartDate(undefined);
    setEndDate(undefined);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("rentalDateTitle")}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label>{t("rentalStartDate")}</Label>
            <Popover open={startPopoverOpen} onOpenChange={setStartPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "dd MMM yyyy") : t("rentalStartDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={(date) => {
                    setStartDate(date);
                    if (date && endDate && date > endDate) {
                      setEndDate(undefined);
                    }
                    setStartPopoverOpen(false);
                  }}
                  disabled={[{ before: today }, isDateFullyBooked]}
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid gap-2">
            <Label>{t("rentalEndDate")}</Label>
            <Popover open={endPopoverOpen} onOpenChange={setEndPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !endDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {endDate ? format(endDate, "dd MMM yyyy") : t("rentalEndDate")}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={endDate}
                  onSelect={(date) => {
                    setEndDate(date);
                    setEndPopoverOpen(false);
                  }}
                  disabled={[
                    { before: endDateMin },
                    ...(endDateMax ? [{ after: endDateMax }] : []),
                    isDateFullyBooked,
                  ]}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>
        <DialogFooter>
          <Button
            className={cn("w-full font-semibold", confirmClassName)}
            variant={confirmClassName ? "default" : "gold"}
            onClick={handleConfirm}
            disabled={!startDate || !endDate}
          >
            {confirmIcon}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
