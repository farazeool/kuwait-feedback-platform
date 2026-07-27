import type { EmailRenderConfig } from "../schema";

const STAR_FILLED = "★";
const STAR_EMPTY = "☆";

function Stars({ count, total = 5 }: { count: number; total?: number }) {
  return (
    <span style={{ letterSpacing: 2, fontSize: 20 }}>
      {Array.from({ length: total }, (_, i) =>
        i < count ? STAR_FILLED : STAR_EMPTY,
      ).join("")}
    </span>
  );
}

export interface BadgeProps {
  config: Partial<EmailRenderConfig>;
  /** Pre-selected rating (1–5) for the active state; omit for placeholder */
  rating?: number;
  width?: number;
  height?: number;
}

/** Returns the JSX element tree for @vercel/og ImageResponse */
export function buildSignatureBadge({ config, rating, width = 480, height = 120 }: BadgeProps) {
  const brand = config.brandColor ?? "#2563eb";
  const heading = config.headingEn ?? "How was your experience?";
  const isPlaceholder = rating === undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "flex-start",
        width,
        height,
        padding: "16px 24px",
        background: "#ffffff",
        borderLeft: `4px solid ${brand}`,
        fontFamily: "Inter, sans-serif",
        gap: 8,
      }}
    >
      <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>
        {heading}
      </span>
      {isPlaceholder ? (
        <span style={{ fontSize: 13, color: "#9ca3af" }}>
          This link is no longer active
        </span>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Stars count={rating} />
          <span style={{ fontSize: 13, color: brand, fontWeight: 600 }}>
            {rating} / 5
          </span>
        </div>
      )}
    </div>
  );
}

/** Neutral placeholder badge — rendered for invalid/revoked/expired tokens */
export function buildPlaceholderBadge(width = 480, height = 120) {
  return buildSignatureBadge({ config: {}, rating: undefined, width, height });
}
