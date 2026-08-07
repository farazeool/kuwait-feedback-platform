"use client";

import { useCallback, useState } from "react";
import { createTemplate, updateTemplate } from "@/features/distribution/actions";
import type { DistributionTemplate } from "@/features/distribution/templates";

interface SignatureFormProps {
  surveys?: Array<{ id: string; title_en: string; title_ar: string }>;
  template?: DistributionTemplate;
}

export function SignatureForm({ template }: SignatureFormProps) {
  const isEdit = Boolean(template);
  const rc = (template?.render_config ?? {}) as Record<string, unknown>;
  const cfg = (template?.config ?? {}) as Record<string, unknown>;
  const str = (value: unknown, fallback: string) => (typeof value === "string" ? value : fallback);
  const bool = (value: unknown, fallback: boolean) => (typeof value === "boolean" ? value : fallback);

  const [templateName, setTemplateName] = useState(template?.template_name ?? "");
  const [headingEn, setHeadingEn] = useState(str(rc.headingEn, "How was your experience?"));
  const [headingAr, setHeadingAr] = useState(str(rc.headingAr, "كيف كانت تجربتك؟"));
  const [descriptionEn, setDescriptionEn] = useState(str(rc.descriptionEn, ""));
  const [descriptionAr, setDescriptionAr] = useState(str(rc.descriptionAr, ""));
  const [ratingStyle, setRatingStyle] = useState(str(rc.ratingStyle, "emoji"));
  const [brandColor, setBrandColor] = useState(str(rc.brandColor, "#2563eb"));
  const [iconSize, setIconSize] = useState(str(rc.iconSize, "medium"));
  const [alignment, setAlignment] = useState(str(rc.alignment, "left"));
  const [showBusinessName, setShowBusinessName] = useState(bool(rc.showBusinessName, true));
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(bool(rc.showPrivacyNotice, false));
  const [privacyNoticeEn, setPrivacyNoticeEn] = useState(str(rc.privacyNoticeEn, ""));
  const [privacyNoticeAr, setPrivacyNoticeAr] = useState(str(rc.privacyNoticeAr, ""));
  const [layout, setLayout] = useState(str(rc.layout, "horizontal"));
  const [autoSubmitPositive, setAutoSubmitPositive] = useState(bool(cfg.autoSubmitPositive, true));
  const [followUpEnabled, setFollowUpEnabled] = useState(bool(cfg.followUpEnabled, true));

  const previewEmoji = ratingStyle === "emoji" ? "😊 🙂 😐 ☹ 😡" :
    ratingStyle === "star" ? "★★★★★" :
    ratingStyle === "three_option" ? "Great | Okay | Poor" : "Yes | No";

  const handleSubmit = useCallback(async (formData: FormData) => {
    const payload = JSON.stringify({
      channel: "email",
      templateName,
      description: descriptionEn,
      // Preserve the existing default flag when editing (the form has no control for it).
      isDefault: template?.is_default ?? false,
      config: { followUpEnabled, autoSubmitPositive },
      renderConfig: {
        ratingStyle, headingEn, headingAr, descriptionEn, descriptionAr,
        brandColor, iconSize, alignment, layout,
        showBusinessName, showPrivacyNotice, privacyNoticeEn, privacyNoticeAr,
      },
    });
    formData.set("template", payload);
    if (isEdit && template) {
      formData.set("templateId", template.id);
      await updateTemplate(formData);
    } else {
      await createTemplate(formData);
    }
  }, [isEdit, template, templateName, headingEn, headingAr, descriptionEn, descriptionAr, ratingStyle, brandColor, iconSize, alignment, showBusinessName, showPrivacyNotice, privacyNoticeEn, privacyNoticeAr, layout, autoSubmitPositive, followUpEnabled]);

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-xl border border-border bg-white p-6">
      <label className="grid gap-1 text-sm font-semibold">
        Template name
        <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g., Standard email feedback" />
      </label>

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Layout & Appearance</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">Rating style
            <select value={ratingStyle} onChange={(e) => setRatingStyle(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="emoji">Emoji scale</option><option value="star">Five-star scale</option>
              <option value="three_option">Three-option (Poor/Okay/Great)</option><option value="yes_no">Yes/No</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Layout
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
              <option value="minimal">Minimal</option><option value="branded">Branded</option>
            </select>
          </label>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <label className="grid gap-1 text-sm">Icon size
            <select value={iconSize} onChange={(e) => setIconSize(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Alignment
            <select value={alignment} onChange={(e) => setAlignment(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="left">Left</option><option value="center">Center</option><option value="right">Right</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">Brand color
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-full rounded-lg border border-border px-1" />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Text content</legend>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">Heading (English)
            <input value={headingEn} onChange={(e) => setHeadingEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-sm" dir="rtl">العنوان (عربي)
            <input value={headingAr} onChange={(e) => setHeadingAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">Description (English)
            <input value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-sm" dir="rtl">الوصف (عربي)
            <input value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
        </div>
      </fieldset>

      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Display options</legend>
        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showBusinessName} onChange={(e) => setShowBusinessName(e.target.checked)} className="size-4" /> Show business name
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPrivacyNotice} onChange={(e) => setShowPrivacyNotice(e.target.checked)} className="size-4" /> Show privacy notice
          </label>
        </div>
        {showPrivacyNotice && (
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm">Privacy notice (English)
              <input value={privacyNoticeEn} onChange={(e) => setPrivacyNoticeEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
            <label className="grid gap-1 text-sm" dir="rtl">إشعار الخصوصية (عربي)
              <input value={privacyNoticeAr} onChange={(e) => setPrivacyNoticeAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
            </label>
          </div>
        )}
        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoSubmitPositive} onChange={(e) => setAutoSubmitPositive(e.target.checked)} className="size-4" /> Auto-submit positive ratings
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={followUpEnabled} onChange={(e) => setFollowUpEnabled(e.target.checked)} className="size-4" /> Enable follow-up
          </label>
        </div>
      </fieldset>

      {/* Live preview */}
      <div className="rounded-lg border border-border bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Live preview</p>
        <div className="rounded-lg border border-border bg-white p-4" style={{ textAlign: alignment as "left" | "center" | "right" }}>
          {showBusinessName && <div className="text-sm font-semibold text-gray-700">Organization Name</div>}
          <div className="text-sm text-gray-700">{headingEn}</div>
          {descriptionEn && <div className="mt-0.5 text-xs text-gray-500">{descriptionEn}</div>}
          <div className="mt-1" style={{ fontSize: iconSize === "large" ? "24px" : iconSize === "small" ? "14px" : "18px", letterSpacing: "2px", color: brandColor }}>{previewEmoji}</div>
          {showPrivacyNotice && privacyNoticeEn && <div className="mt-1 text-[10px] text-gray-400">{privacyNoticeEn}</div>}
        </div>
      </div>

      <button type="submit" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white">
        {isEdit ? "Save changes" : "Create template"}
      </button>
    </form>
  );
}
