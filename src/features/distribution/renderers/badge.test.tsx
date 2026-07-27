import type { ReactElement } from "react";
import { describe, expect, it } from "vitest";

import { buildPlaceholderBadge, buildSignatureBadge } from "./badge";

// Recursively collect all string children in a React element tree.
function textOf(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  const el = node as ReactElement<{ children?: unknown }>;
  return textOf(el.props?.children);
}

describe("buildSignatureBadge", () => {
  it("wires the brand color into the left border and the heading text", () => {
    const el = buildSignatureBadge({
      config: { brandColor: "#006c5b", headingEn: "Rate our service" },
      rating: 4,
    });
    expect(textOf(el)).toContain("Rate our service");
    expect(textOf(el)).toContain("4 / 5");
    expect(String(el.props.style.borderLeft)).toContain("#006c5b");
  });

  it("falls back to defaults when config is empty", () => {
    const el = buildSignatureBadge({ config: {}, rating: 5 });
    expect(textOf(el)).toContain("How was your experience?");
    expect(String(el.props.style.borderLeft)).toContain("#2563eb");
  });

  it("renders the neutral inactive copy when no rating is supplied", () => {
    const el = buildSignatureBadge({ config: { brandColor: "#006c5b" } });
    expect(textOf(el)).toContain("This link is no longer active");
    expect(textOf(el)).not.toContain("/ 5");
  });
});

describe("buildPlaceholderBadge", () => {
  it("produces the neutral placeholder with default styling", () => {
    const el = buildPlaceholderBadge();
    expect(textOf(el)).toContain("This link is no longer active");
    expect(String(el.props.style.borderLeft)).toContain("#2563eb");
  });
});
