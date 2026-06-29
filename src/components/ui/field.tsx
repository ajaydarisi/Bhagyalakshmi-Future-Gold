"use client";

import * as React from "react";

interface FieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size"> {
  label?: React.ReactNode;
  hint?: React.ReactNode;
  error?: React.ReactNode;
  iconLeft?: React.ReactNode;
  /** Trailing element/text, e.g. "₹" or a unit. */
  adornment?: React.ReactNode;
  fieldSize?: "md" | "lg";
  /** Class on the outer wrapper. */
  className?: string;
  wrapperStyle?: React.CSSProperties;
}

/**
 * BFG Field — labelled text input with optional leading icon, trailing
 * adornment, and hint/error. Calm cream field, gold focus ring. Forwards the
 * ref to the inner <input> so it works with react-hook-form `register`.
 * Ported from bfg-design-system/components/forms/Input.jsx.
 */
export const Field = React.forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, hint, error, iconLeft, adornment, fieldSize = "md", id, className, wrapperStyle, required, onFocus, onBlur, ...rest },
  ref
) {
  const reactId = React.useId();
  const inputId = id || reactId;
  const [focused, setFocused] = React.useState(false);
  const height = fieldSize === "lg" ? "var(--control-lg)" : "var(--control-md)";
  const hasError = Boolean(error);

  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...wrapperStyle }}>
      {label && (
        <label htmlFor={inputId} style={{ font: "var(--type-label)", color: "var(--text-secondary)" }}>
          {label}
          {required && <span style={{ color: "var(--maroon-500)", marginLeft: 3 }}>*</span>}
        </label>
      )}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          height,
          padding: "0 var(--space-4)",
          background: "var(--surface-card)",
          border: `1px solid ${hasError ? "var(--bfg-error)" : focused ? "var(--gold-500)" : "var(--border-strong)"}`,
          borderRadius: "var(--radius-bfg-md)",
          boxShadow: focused && !hasError ? "var(--ring-focus)" : "none",
          transition: "border-color var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out)",
        }}
      >
        {iconLeft && <span style={{ color: "var(--text-muted)", display: "inline-flex" }}>{iconLeft}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={hasError || undefined}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={{
            flex: 1,
            minWidth: 0,
            height: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            font: "var(--type-body)",
            color: "var(--text-primary)",
          }}
        />
        {adornment && <span style={{ color: "var(--text-secondary)", font: "var(--type-body-sm)" }}>{adornment}</span>}
      </div>
      {(error || hint) && (
        <span style={{ font: "var(--type-caption)", color: hasError ? "var(--bfg-error)" : "var(--text-muted)" }}>
          {error || hint}
        </span>
      )}
    </div>
  );
});
