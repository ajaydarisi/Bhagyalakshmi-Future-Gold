"use client";

import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";
import { Check } from "lucide-react";

interface CheckoutStepsProps {
  currentStep: number;
}

export function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  const t = useTranslations("cart.checkout.steps");
  const steps = [t("review"), t("address"), t("payment")];
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
              index < currentStep
                ? "border-gold-500 bg-gold-500 text-[var(--text-on-gold)]"
                : index === currentStep
                  ? "border-gold-500 text-text-gold"
                  : "border-[var(--border-strong)] text-text-muted"
            )}
          >
            {index < currentStep ? (
              <Check className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          <span
            className={cn(
              "hidden sm:inline text-sm font-medium",
              index <= currentStep
                ? "text-text-primary"
                : "text-text-secondary"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-8 sm:w-12",
                index < currentStep ? "bg-gold-500" : "bg-[var(--border-strong)]"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
