import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface CheckoutStepsProps {
  currentStep: number;
}

const steps = ["Address", "Review", "Payment"];

export function CheckoutSteps({ currentStep }: CheckoutStepsProps) {
  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2">
          <div
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium",
              index < currentStep
                ? "border-primary bg-primary text-primary-foreground"
                : index === currentStep
                  ? "border-primary text-primary"
                  : "border-muted-foreground/30 text-muted-foreground"
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
              "text-sm font-medium",
              index <= currentStep
                ? "text-foreground"
                : "text-muted-foreground"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 && (
            <div
              className={cn(
                "h-px w-12",
                index < currentStep ? "bg-primary" : "bg-muted-foreground/30"
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
