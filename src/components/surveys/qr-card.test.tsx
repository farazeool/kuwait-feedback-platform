import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/image", () => ({
  default: ({ src, alt, className }: { src: string; alt: string; className?: string }) =>
    React.createElement("img", { src, alt, className }),
}));

import { QrCard } from "./qr-card";

const feedbackUrl = "https://feedback.example/feedback/some-public-slug-1234567890123456";
const baseProps = {
  locationNameEn: "Salmiya Branch",
  locationNameAr: "فرع السالمية",
  feedbackUrl,
  primaryColor: "#0f6b4d",
  status: "active" as const,
};

describe("QrCard", () => {
  it("renders bilingual location names with RTL for Arabic", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("Salmiya Branch");
    expect(html).toContain("فرع السالمية");
    expect(html).toContain('dir="rtl"');
  });

  it("encodes the feedback URL in the QR image src", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain(encodeURIComponent(feedbackUrl));
    expect(html).toContain("format=svg");
  });

  it("renders the raw feedback URL as visible text", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain(feedbackUrl);
  });

  it("renders active status badge in both languages", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("Active and accepting feedback");
    expect(html).toContain("نشط ويستقبل الملاحظات");
  });

  it("renders inactive status badge when status is draft", () => {
    const html = renderToStaticMarkup(
      React.createElement(QrCard, { ...baseProps, status: "draft" as const }),
    );
    expect(html).toContain("Not currently active");
    expect(html).toContain("غير نشط حالياً");
  });

  it("renders bilingual download links with download flag", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("format=svg&amp;download=1");
    expect(html).toContain("format=png&amp;download=1");
    expect(html).toContain("Download SVG");
    expect(html).toContain("تنزيل SVG");
    expect(html).toContain("Download PNG");
    expect(html).toContain("تنزيل PNG");
  });

  it("renders bilingual copy link button labels", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("Copy link");
    expect(html).toContain("نسخ الرابط");
  });

  it("applies primary color to card top border", () => {
    const html = renderToStaticMarkup(
      React.createElement(QrCard, { ...baseProps, primaryColor: "#ff0000" }),
    );
    expect(html).toContain("#ff0000");
  });

  it("hides action buttons in print layout", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("print:hidden");
  });

  it("uses print break-inside-avoid on card", () => {
    const html = renderToStaticMarkup(React.createElement(QrCard, baseProps));
    expect(html).toContain("print:break-inside-avoid");
  });
});
