import type { EmailRenderConfig } from "../schema";

// 5-pointed star as an SVG path (viewBox 0 0 24 24). Rendered as a shape so the
// badge never depends on a font that includes ★/☆ glyphs — the @vercel/og
// default fallback font renders those characters as tofu boxes.
const STAR_PATH =
  "M12 .587l3.668 7.431 8.2 1.192-5.934 5.786 1.402 8.174L12 18.897l-7.336 3.869 1.402-8.174L.132 9.21l8.2-1.192z";

const STAR_EMPTY_FILL = "#d1d5db";

const FRAME_STYLE = (brand: string, width: number, height: number) =>
  ({
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
  }) as const;

function Stars({
  count,
  total = 5,
  fill = "#f5b301",
}: {
  count: number;
  total?: number;
  fill?: string;
}) {
  return (
    <div style={{ display: "flex", gap: 4 }}>
      {Array.from({ length: total }, (_, i) => (
        <svg key={i} width={22} height={22} viewBox="0 0 24 24">
          <path d={STAR_PATH} fill={i < count ? fill : STAR_EMPTY_FILL} />
        </svg>
      ))}
    </div>
  );
}

export interface BadgeProps {
  config: Partial<EmailRenderConfig>;
  /** Captured rating (1–5). Omit to render the active invitation (empty stars). */
  rating?: number;
  width?: number;
  height?: number;
}

/** Active signature badge: an invitation (empty stars) or a captured rating. */
export function buildSignatureBadge({ config, rating, width = 480, height = 120 }: BadgeProps) {
  const brand = config.brandColor ?? "#2563eb";
  const heading = config.headingEn ?? "How was your experience?";
  const isInvitation = rating === undefined;

  return (
    <div style={FRAME_STYLE(brand, width, height)}>
      <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>{heading}</span>
      {isInvitation ? (
        // Active assignment, no rating yet — show empty stars as a call to action
        <Stars count={0} />
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Stars count={rating} />
          <span style={{ fontSize: 13, color: brand, fontWeight: 600 }}>{rating} / 5</span>
        </div>
      )}
    </div>
  );
}

/** Neutral placeholder badge — rendered for invalid/revoked/expired tokens. */
export function buildPlaceholderBadge(width = 480, height = 120) {
  return (
    <div style={FRAME_STYLE("#2563eb", width, height)}>
      <span style={{ fontSize: 14, color: "#6b7280", fontWeight: 500 }}>Thanks for your visit</span>
      <span style={{ fontSize: 13, color: "#9ca3af" }}>This link is no longer active</span>
    </div>
  );
}
