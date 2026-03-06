"use client";

import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Browser } from "@capacitor/browser";
import { addDays, format } from "date-fns";
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
import { BUSINESS_INFO } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CalendarIcon, MessageCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { trackEvent } from "@/lib/gtag";

interface CheckAvailabilityButtonProps {
  productName: string;
  productSlug: string;
  size?: "default" | "sm";
  isRental?: boolean;
  maxRentalDays?: number | null;
}

function formatDateForMessage(date: Date) {
  return format(date, "dd MMM yyyy");
}

export function CheckAvailabilityButton({
  productName,
  productSlug,
  size = "default",
  isRental,
  maxRentalDays,
}: CheckAvailabilityButtonProps) {
  const t = useTranslations("products");
  const tw = useTranslations("wishlist");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [startPopoverOpen, setStartPopoverOpen] = useState(false);
  const [endPopoverOpen, setEndPopoverOpen] = useState(false);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  function openWhatsApp(message: string) {
    trackEvent("contact_whatsapp", { item_name: productName });
    const encoded = encodeURIComponent(message);
    const url = `https://wa.me/91${BUSINESS_INFO.whatsapp}?text=${encoded}`;

    if (Capacitor.isNativePlatform()) {
      Browser.open({ url });
    } else {
      window.open(url, "_blank", "noopener,noreferrer");
    }
  }

  function handleClick() {
    if (isRental) {
      setDialogOpen(true);
      return;
    }

    const previewUrl = `${window.location.origin}/preview/${productSlug}`;
    const message = `${t("whatsappMessage")}\n\n*${productName}*\n${previewUrl}`;
    openWhatsApp(message);
  }

  function handleRentalSubmit() {
    if (!startDate || !endDate) return;
    const previewUrl = `${window.location.origin}/preview/${productSlug}`;
    const message = `${t("whatsappRentalMessage")}\n\n*${productName}*\n${t("fromDate")}: ${formatDateForMessage(startDate)}\n${t("toDate")}: ${formatDateForMessage(endDate)}\n\n${previewUrl}`;
    openWhatsApp(message);
    setDialogOpen(false);
    setStartDate(undefined);
    setEndDate(undefined);
  }

  const endDateMin = startDate ?? today;
  const endDateMax =
    startDate && maxRentalDays
      ? addDays(startDate, maxRentalDays)
      : undefined;

  return (
    <>
      <Button
        className="flex-1 bg-[#006d28] hover:bg-[#1da851] text-white font-semibold"
        size={size === "sm" ? "sm" : "lg"}
        onClick={handleClick}
      >
        <MessageCircle className={size === "sm" ? "mr-1 h-3 w-3" : "mr-2 h-4 w-4"} />
        {tw("checkAvailability")}
      </Button>

      {isRental && (
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
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
                      disabled={{ before: today }}
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
                      ]}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <DialogFooter>
              <Button
                className="w-full bg-[#006d28] hover:bg-[#1da851] text-white font-semibold"
                onClick={handleRentalSubmit}
                disabled={!startDate || !endDate}
              >
                <MessageCircle className="mr-2 h-4 w-4" />
                {t("sendOnWhatsapp")}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
