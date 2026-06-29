import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Slot } from "radix-ui"
import { Loader2 } from "lucide-react"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost:
          "hover:bg-accent hover:text-accent-foreground dark:hover:bg-accent/50",
        link: "text-primary underline-offset-4 hover:underline",

        // ---- BFG design-system variants (pill, uppercase, warm) ----
        gold:
          "rounded-full uppercase tracking-[0.04em] font-semibold bg-gold-500 text-[var(--text-on-gold)] shadow-[var(--shadow-gold)] hover:bg-gold-600 hover:-translate-y-0.5 active:scale-[0.97]",
        maroon:
          "rounded-full uppercase tracking-[0.04em] font-semibold bg-maroon-500 text-[var(--ivory-50)] hover:bg-maroon-600 hover:-translate-y-0.5 active:scale-[0.97]",
        dark:
          "rounded-full uppercase tracking-[0.04em] font-semibold bg-ink-900 text-[var(--text-on-dark)] hover:bg-[#3a3228] hover:-translate-y-0.5 active:scale-[0.97]",
        "gold-outline":
          "rounded-full uppercase tracking-[0.04em] font-semibold border bg-transparent text-text-gold border-[var(--border-gold)] hover:border-gold-500 hover:bg-[rgb(var(--gold-rgb)/0.08)] active:scale-[0.97]",
        "gold-ghost":
          "rounded-full uppercase tracking-[0.04em] font-semibold text-text-primary bg-transparent hover:bg-[rgb(var(--gold-deep-rgb)/0.06)] active:scale-[0.97]",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>svg]:px-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        icon: "size-9",
        "icon-xs": "size-6 rounded-md [&_svg:not([class*='size-'])]:size-3",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
        // ---- BFG control sizes (touch-safe pills) ----
        "bfg-sm": "h-9 px-4 text-sm",
        "bfg-md": "h-11 px-6 text-sm",
        "bfg-lg": "h-13 px-7 text-base",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  asChild = false,
  iconLeft,
  iconRight,
  loading = false,
  disabled,
  children,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
    iconLeft?: React.ReactNode
    iconRight?: React.ReactNode
    loading?: boolean
  }) {
  const Comp = asChild ? Slot.Root : "button"

  // When composing via Slot, children must stay a single element — skip icon/loading wrapping.
  const content = asChild ? (
    children
  ) : (
    <>
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {!loading && iconLeft}
      {children}
      {!loading && iconRight}
    </>
  )

  return (
    <Comp
      data-slot="button"
      data-variant={variant}
      data-size={size}
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={Comp === "button" ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      {...props}
    >
      {content}
    </Comp>
  )
}

export { Button, buttonVariants }
