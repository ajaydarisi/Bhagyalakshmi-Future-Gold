"use client";

import * as React from "react";

type IconButtonVariant = "ghost" | "soft" | "gold" | "outline";
type IconButtonSize = "sm" | "md" | "lg";

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Required — used as aria-label and tooltip. */
  label: string;
  variant?: IconButtonVariant;
  size?: IconButtonSize;
  /** Count bubble (maroon); hidden when 0/undefined. */
  badge?: number | string;
}

const VARIANTS: Record<IconButtonVariant, { color: string; background: string; border: string }> = {
  ghost: { color: "var(--text-primary)", background: "transparent", border: "transparent" },
  soft: { color: "var(--stone-700)", background: "var(--sand-200)", border: "transparent" },
  gold: { color: "var(--ivory-50)", background: "var(--gold-500)", border: "transparent" },
  outline: { color: "var(--text-primary)", background: "var(--surface-card)", border: "var(--border-sand)" },
};

const SIZES: Record<IconButtonSize, number> = { sm: 36, md: 44, lg: 52 };

/**
 * BFG IconButton — square/circular control wrapping a single icon, with an
 * optional count badge. For header actions, carousel arrows, close, etc.
 * Ported from bfg-design-system/components/core/IconButton.jsx.
 */
export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { children, label, variant = "ghost", size = "md", badge, style, ...rest },
  ref
) {
  const px = SIZES[size] ?? 44;
  const v = VARIANTS[variant] ?? VARIANTS.ghost;

  const onHover = (e: React.MouseEvent<HTMLButtonElement>, on: boolean) => {
    const el = e.currentTarget;
    if (variant === "ghost") el.style.background = on ? "rgb(var(--gold-deep-rgb) / 0.07)" : "transparent";
    else if (variant === "soft") el.style.background = on ? "var(--sand-300)" : "var(--sand-200)";
    else if (variant === "gold") el.style.background = on ? "var(--gold-600)" : "var(--gold-500)";
    else if (variant === "outline") el.style.borderColor = on ? "var(--gold-500)" : "var(--border-sand)";
  };

  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      title={label}
      style={{
        position: "relative",
        width: px,
        height: px,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        color: v.color,
        background: v.background,
        border: `1px solid ${v.border}`,
        borderRadius: "var(--radius-pill)",
        cursor: "pointer",
        transition:
          "background var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out), transform var(--dur-fast) var(--ease-out)",
        ...style,
      }}
      onMouseEnter={(e) => onHover(e, true)}
      onMouseLeave={(e) => onHover(e, false)}
      onMouseDown={(e) => (e.currentTarget.style.transform = "scale(var(--press-scale))")}
      onMouseUp={(e) => (e.currentTarget.style.transform = "")}
      {...rest}
    >
      {children}
      {badge != null && badge !== 0 && (
        <span
          style={{
            position: "absolute",
            top: 2,
            right: 2,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            font: "var(--type-caption)",
            fontSize: "var(--text-2xs)",
            color: "var(--ivory-50)",
            background: "var(--maroon-500)",
            borderRadius: "var(--radius-pill)",
            border: "2px solid var(--surface-card)",
          }}
        >
          {badge}
        </span>
      )}
    </button>
  );
});
