import { cn } from "@/lib/utils";

type LogoLayout = "stacked" | "horizontal" | "monogram" | "wordmark";
type LogoSize = "sm" | "md" | "lg";

/** Real ornate gilt "BFG" monogram (transparent, trimmed) — works on any bg. */
const DEFAULT_MARK = "/images/brand/logo-bfg-mark.png";

interface LogoProps {
  layout?: LogoLayout;
  /** Ornate gilt logo image used for the monogram. Defaults to the real art;
      pass `null` to fall back to the typographic foil "BFG". */
  imageSrc?: string | null;
  /** Show the "Chirala" ornament (stacked layout only). */
  tagline?: boolean;
  /** Lighten colours for dark backgrounds. */
  onDark?: boolean;
  size?: LogoSize;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * BFG Logo — typographic brand lockup (gilt "BFG" monogram + Marcellus name).
 * Pass `imageSrc` to use the real ornate logo art instead of the type monogram.
 * Ported from bfg-design-system/components/brand/Logo.jsx.
 */
export function Logo({
  layout = "stacked",
  imageSrc = DEFAULT_MARK,
  tagline = false,
  onDark = false,
  size = "md",
  className,
  style,
}: LogoProps) {
  const scale = { sm: 0.8, md: 1, lg: 1.35 }[size] ?? 1;
  const nameColor = onDark ? "var(--text-on-dark)" : "var(--text-primary)";

  const monogram = () =>
    imageSrc ? (
      // eslint-disable-next-line @next/next/no-img-element -- small fixed logo, height-driven sizing
      <img
        src={imageSrc}
        alt="Bhagyalakshmi Future Gold"
        style={{ height: `${2 * scale}rem`, width: "auto", display: "block" }}
      />
    ) : (
      <span
        className="bfg-foil"
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: "var(--fw-bold)",
          fontSize: `${2.6 * scale}rem`,
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      >
        BFG
      </span>
    );

  const fullName = (small?: boolean) => (
    <span
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: layout === "horizontal" ? "flex-start" : "center",
        lineHeight: 1.05,
      }}
    >
      <span
        style={{
          fontFamily: "var(--font-brand)",
          fontSize: `${(small ? 1.06 : 1.32) * scale}rem`,
          letterSpacing: "0.04em",
          color: nameColor,
        }}
      >
        Bhagyalakshmi
      </span>
      <span
        style={{
          fontFamily: "var(--font-brand)",
          fontSize: `${(small ? 0.72 : 0.82) * scale}rem`,
          letterSpacing: "var(--ls-wider)",
          textTransform: "uppercase",
          color: onDark ? "var(--gold-300)" : "var(--text-gold)",
          marginTop: 2,
        }}
      >
        Future Gold
      </span>
    </span>
  );

  if (layout === "monogram")
    return (
      <span className={className} style={style}>
        {monogram()}
      </span>
    );

  if (layout === "wordmark")
    return (
      <span className={className} style={style}>
        {fullName()}
      </span>
    );

  if (layout === "horizontal")
    return (
      <span
        className={className}
        style={{ display: "inline-flex", alignItems: "center", gap: "var(--space-3)", ...style }}
      >
        {monogram()}
        <span style={{ width: 1, height: 34 * scale, background: "var(--border-gold)" }} />
        {fullName(true)}
      </span>
    );

  // stacked
  return (
    <span
      className={cn(className)}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 6, ...style }}
    >
      {monogram()}
      {fullName()}
      {tagline && (
        <span className="bfg-ornament" style={{ marginTop: 4 }}>
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontSize: `${0.6 * scale}rem`,
              letterSpacing: "var(--ls-wide)",
              textTransform: "uppercase",
              color: onDark ? "var(--gold-300)" : "var(--text-secondary)",
            }}
          >
            Chirala
          </span>
        </span>
      )}
    </span>
  );
}
