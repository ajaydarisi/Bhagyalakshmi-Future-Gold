"use client";

import * as React from "react";

interface QuantityStepperProps {
  value?: number;
  defaultValue?: number;
  min?: number;
  max?: number;
  onChange?: (value: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  decreaseLabel?: string;
  increaseLabel?: string;
}

/**
 * BFG QuantityStepper — −/value/+ pill control for cart quantities.
 * Controlled (value + onChange) or uncontrolled (defaultValue), with min/max
 * clamping. Ported from bfg-design-system/components/forms/QuantityStepper.jsx.
 */
export function QuantityStepper({
  value,
  defaultValue = 1,
  min = 1,
  max = 99,
  onChange,
  size = "md",
  disabled = false,
  className,
  style,
  decreaseLabel = "Decrease quantity",
  increaseLabel = "Increase quantity",
}: QuantityStepperProps) {
  const [internal, setInternal] = React.useState(defaultValue);
  const val = value != null ? value : internal;
  const dim = size === "sm" ? 32 : 40;

  const set = (next: number) => {
    const clamped = Math.max(min, Math.min(max, next));
    if (value == null) setInternal(clamped);
    onChange?.(clamped);
  };

  const stepButton = (content: string, onClick: () => void, isDisabled: boolean, label: string) => (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={isDisabled || disabled}
      style={{
        width: dim,
        height: dim,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        background: "transparent",
        color: isDisabled || disabled ? "var(--text-muted)" : "var(--text-primary)",
        cursor: isDisabled || disabled ? "not-allowed" : "pointer",
        fontSize: "1.1rem",
        lineHeight: 1,
        transition: "background var(--dur-fast) var(--ease-out)",
      }}
      onMouseEnter={(e) => !(isDisabled || disabled) && (e.currentTarget.style.background = "rgb(var(--gold-deep-rgb) / 0.07)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {content}
    </button>
  );

  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        border: "1px solid var(--border-strong)",
        borderRadius: "var(--radius-pill)",
        background: "var(--surface-card)",
        overflow: "hidden",
        opacity: disabled ? 0.6 : 1,
        ...style,
      }}
    >
      {stepButton("−", () => set(val - 1), val <= min, decreaseLabel)}
      <span
        style={{
          minWidth: dim,
          textAlign: "center",
          font: "var(--type-label)",
          color: "var(--text-primary)",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {val}
      </span>
      {stepButton("+", () => set(val + 1), val >= max, increaseLabel)}
    </div>
  );
}
