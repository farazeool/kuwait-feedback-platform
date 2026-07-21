import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { PublicSurveyForm } from "./public-survey-form";

const survey = {
  public_slug: "safe-survey-identifier",
  survey_type: "generic" as const,
  title: { en: "<script>alert(1)</script>", ar: "استبيان" },
  description: { en: null, ar: null },
  thank_you: { en: "Thank you", ar: "شكراً" },
  default_locale: "en" as const,
  organization: { name: { en: "Demo", ar: "تجريبي" }, branding: { primary_color: "#006c5b", accent_color: "#d5a742", logo_path: null, logo_url: null, header_style: "solid", footer: { en: null, ar: null } } },
  location: { name: { en: "Salmiya", ar: "السالمية" } },
  rating_scales: {},
  questions: [{ id: "50000000-0000-4000-8000-000000000001", type: "text" as const, position: 1, prompt: { en: "Comment", ar: "تعليق" }, help_text: { en: null, ar: null }, required: false, rating_min: null, rating_max: null, rating_scale: null, allow_multiple: false, text_max_length: 100, options: [] }],
};

describe("public survey rendering", () => {
  it("renders English content and escapes customer-controlled text", () => {
    const html = renderToStaticMarkup(<PublicSurveyForm survey={survey} startedAt={1} idempotencyKey="70000000-0000-4000-8000-000000000001" />);
    expect(html).toContain("&lt;script&gt;alert(1)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert(1)</script>");
    expect(html).toContain('dir="ltr"');
  });
});
