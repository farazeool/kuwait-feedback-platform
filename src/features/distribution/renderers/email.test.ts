import { describe, expect, it } from "vitest";
import { renderEmailSignatureHtml, renderEmailSignaturePlainText } from "./email";
import type { DistributionTemplate } from "../templates";

describe("renderEmailSignatureHtml", () => {
  const baseTemplate: DistributionTemplate = {
    id: "test-template-id",
    organization_id: "test-org-id",
    template_name: "Test Template",
    channel: "email",
    description: null,
    is_active: true,
    is_default: false,
    config: {},
    render_config: {
      ratingStyle: "emoji",
      headingEn: "How was your experience?",
      brandColor: "#2563eb",
      iconSize: "medium",
      alignment: "left",
      showBusinessName: true,
    },
    created_at: new Date().toISOString(),
  };

  it("escapes organization name to prevent XSS", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      '<script>alert("xss")</script>',
    );

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML tags in organization name", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "<b>Bold Org</b>",
    );

    expect(html).not.toContain("<b>Bold Org</b>");
    expect(html).toContain("&lt;b&gt;Bold Org&lt;/b&gt;");
  });

  it("escapes quotes in organization name", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      'Org "Name" with quotes',
    );

    expect(html).toContain("&quot;");
  });

  it("escapes apostrophes in heading", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        headingEn: "How's your experience?",
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    // Apostrophes are HTML-entity encoded
    expect(html).toContain("How&#039;s your experience?");
  });

  it("escapes ampersands in public token URLs", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "token&test",
      "https://app.test",
      "Test Org",
    );

    // URL ampersands should be HTML-entity encoded
    expect(html).toContain("&amp;");
  });

  it("handles emoji in organization name safely", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Coffee Shop ☕️",
    );

    expect(html).toContain("Coffee Shop ☕️");
    expect(html).not.toContain("<script>");
  });

  it("handles unicode characters in organization name", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "مطعم الكويت", // Arabic text
    );

    expect(html).toContain("مطعم الكويت");
  });

  it("generates table-based HTML structure", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("<table");
    expect(html).toContain("</table>");
    expect(html).toContain("cellpadding");
    expect(html).toContain("cellspacing");
  });

  it("uses inline styles only", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain('style=');
    expect(html).not.toContain("<style>");
    expect(html).not.toContain("class=");
  });

  it("does not contain script tags", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).not.toContain("<script");
    expect(html).not.toContain("</script>");
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("onerror=");
    expect(html).not.toContain("onclick=");
  });

  it("generates absolute HTTPS URLs from app URL", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token-123",
      "https://preview.example.test",
      "Test Org",
    );

    expect(html).toContain("https://preview.example.test/f/test-token-123");
    expect(html).not.toContain("http://localhost");
  });

  it("includes rating query parameter in links", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("?r=5");
    expect(html).toContain("?r=4");
    expect(html).toContain("?r=3");
    expect(html).toContain("?r=2");
    expect(html).toContain("?r=1");
  });

  it("pairs each emoji with the matching rating value (worst=1, best=5)", () => {
    const html = renderEmailSignatureHtml(
      { ...baseTemplate, render_config: { ...baseTemplate.render_config, ratingStyle: "emoji" } },
      "tok",
      "https://example.com",
      "Acme",
    );
    // The angry face must submit 1 and the happy face must submit 5. Asserting
    // only that "?r=5" and each emoji appear somewhere cannot catch inversion.
    expect(html).toMatch(/\?r=1"[^>]*>&#128545;</);
    expect(html).toMatch(/\?r=5"[^>]*>&#128522;</);
    // Ratings appear in ascending left-to-right order.
    expect(html.match(/\?r=(\d)/g)).toEqual(["?r=1", "?r=2", "?r=3", "?r=4", "?r=5"]);
  });

  it("pairs each star with the matching rating value in ascending order", () => {
    const html = renderEmailSignatureHtml(
      { ...baseTemplate, render_config: { ...baseTemplate.render_config, ratingStyle: "star" } },
      "tok",
      "https://example.com",
      "Acme",
    );
    expect(html.match(/\?r=(\d)/g)).toEqual(["?r=1", "?r=2", "?r=3", "?r=4", "?r=5"]);
    expect(html).toContain('title="5 of 5"');
  });

  it("renders emoji rating style correctly", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    // Should contain emoji HTML entities
    expect(html).toContain("&#128545;"); // angry face
    expect(html).toContain("&#128522;"); // happy face
  });

  it("renders star rating style correctly", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        ratingStyle: "star",
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("&#9733;"); // star character
  });

  it("renders three-option rating style correctly", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        ratingStyle: "three_option",
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("Great");
    expect(html).toContain("Okay");
    expect(html).toContain("Poor");
  });

  it("renders yes/no rating style correctly", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        ratingStyle: "yes_no",
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("Yes");
    expect(html).toContain("No");
    expect(html).toContain("&#10003;"); // checkmark
    expect(html).toContain("&#10007;"); // X mark
  });

  it("includes organization name when showBusinessName is true", () => {
    const html = renderEmailSignatureHtml(
      baseTemplate,
      "test-token",
      "https://app.test",
      "Test Organization",
    );

    expect(html).toContain("Test Organization");
  });

  it("omits organization name when showBusinessName is false", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        showBusinessName: false,
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Organization",
    );

    expect(html).not.toContain("Test Organization");
  });

  it("includes privacy notice when enabled", () => {
    const template = {
      ...baseTemplate,
      render_config: {
        ...baseTemplate.render_config,
        showPrivacyNotice: true,
        privacyNoticeEn: "Your privacy is important to us",
      },
    };

    const html = renderEmailSignatureHtml(
      template,
      "test-token",
      "https://app.test",
      "Test Org",
    );

    expect(html).toContain("Your privacy is important to us");
  });
});

describe("renderEmailSignaturePlainText", () => {
  const baseTemplate: DistributionTemplate = {
    id: "test-template-id",
    organization_id: "test-org-id",
    template_name: "Test Template",
    channel: "email",
    description: null,
    is_active: true,
    is_default: false,
    config: {},
    render_config: {
      headingEn: "How was your experience?",
      descriptionEn: "Rate us below",
    },
    created_at: new Date().toISOString(),
  };

  it("generates plain text fallback", () => {
    const text = renderEmailSignaturePlainText(
      "test-token",
      "https://app.test",
      "Test Org",
      baseTemplate,
    );

    expect(text).toContain("Test Org");
    expect(text).toContain("How was your experience?");
    expect(text).toContain("https://app.test/f/test-token");
  });

  it("includes description when present", () => {
    const text = renderEmailSignaturePlainText(
      "test-token",
      "https://app.test",
      "Test Org",
      baseTemplate,
    );

    expect(text).toContain("Rate us below");
  });

  it("uses absolute URL from appUrl parameter", () => {
    const text = renderEmailSignaturePlainText(
      "test-token-456",
      "https://preview.example.test",
      "Test Org",
      baseTemplate,
    );

    expect(text).toContain("https://preview.example.test/f/test-token-456");
  });
});
