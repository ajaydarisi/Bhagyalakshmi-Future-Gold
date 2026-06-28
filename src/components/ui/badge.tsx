import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        // BFG product tones — uppercase, fine tracking reads best on these
        gold: "[background:var(--bfg-grad-gold)] text-foreground",
        maroon: "text-white [background:oklch(0.4_0.1_15)]",
        // "New in" — soft champagne chip with antique-gold text
        new: "border-[oklch(0.64_0.1_80/0.45)] bg-[oklch(0.945_0.035_85)] text-[oklch(0.46_0.08_75)]",
        // Discount / sale — bridal maroon wash
        sale: "border-[oklch(0.52_0.16_28/0.25)] bg-[oklch(0.95_0.03_28)] text-[oklch(0.45_0.16_28)]",
        // Rental — info-blue wash
        rental: "border-[oklch(0.5_0.08_255/0.25)] bg-[oklch(0.94_0.02_255)] text-[oklch(0.42_0.09_255)]",
        success: "border-[oklch(0.55_0.1_150/0.25)] bg-[oklch(0.95_0.04_150)] text-[oklch(0.4_0.1_150)]",
        info: "border-[oklch(0.5_0.08_255/0.25)] bg-[oklch(0.94_0.02_255)] text-[oklch(0.42_0.09_255)]",
        warning: "border-[oklch(0.7_0.1_75/0.3)] bg-[oklch(0.95_0.05_85)] text-[oklch(0.45_0.09_70)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants }
