import { cn } from "@/lib/utils";

interface SectionHeadingProps {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  align?: "center" | "left";
  ornament?: boolean;
  titleAs?: "h1" | "h2" | "h3";
  className?: string;
  style?: React.CSSProperties;
}

/**
 * BFG SectionHeading — gold ornament + Marcellus eyebrow, a Cormorant serif
 * title, and an optional subtitle. Presentational; entrance motion is handled
 * by a parent `.bfg-animate`. Ported from bfg-design-system SectionHeading.jsx.
 */
export function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = "center",
  ornament = true,
  titleAs: TitleTag = "h2",
  className,
  style,
}: SectionHeadingProps) {
  const center = align === "center";
  return (
    <div
      className={cn(className)}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: center ? "center" : "flex-start",
        textAlign: center ? "center" : "left",
        gap: "var(--space-3)",
        ...style,
      }}
    >
      {eyebrow && (
        <span className={ornament ? "bfg-ornament" : undefined} style={{ color: "var(--text-gold)" }}>
          <span
            style={{
              fontFamily: "var(--font-brand)",
              fontSize: "var(--text-xs)",
              letterSpacing: "var(--ls-wider)",
              textTransform: "uppercase",
              color: "var(--text-gold)",
            }}
          >
            {eyebrow}
          </span>
        </span>
      )}
      <TitleTag style={{ font: "var(--type-h2)", color: "var(--text-primary)", maxWidth: "20ch" }}>
        {title}
      </TitleTag>
      {subtitle && (
        <p style={{ font: "var(--type-body-lg)", color: "var(--text-secondary)", maxWidth: "52ch" }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
