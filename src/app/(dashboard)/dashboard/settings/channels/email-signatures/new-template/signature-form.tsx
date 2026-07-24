"use client";

import { useCallback, useState } from "react";
import { createTemplate } from "@/features/email-signature/actions";

interface SignatureFormProps {
  surveys: Array<{ id: string; title_en: string; title_ar: string }>;
  template?: {
    id: string;
    template_name: string;
    heading_en: string;
    heading_ar: string;
    description_en: string | null;
    description_ar: string | null;
    rating_style: string;
    layout: string;
    survey_id: string | null;
    show_logo: boolean;
    show_business_name: boolean;
    show_privacy_notice: boolean;
    privacy_notice_en: string | null;
    privacy_notice_ar: string | null;
    brand_color: string;
    icon_size: string;
    alignment: string;
    thank_you_en: string | null;
    thank_you_ar: string | null;
    follow_up_enabled: boolean;
    auto_submit_positive: boolean;
  } | null;
}

export function SignatureForm({ surveys, template }: SignatureFormProps) {
  const [templateName, setTemplateName] = useState(template?.template_name ?? "");
  const [headingEn, setHeadingEn] = useState(template?.heading_en ?? "How was your experience?");
  const [headingAr, setHeadingAr] = useState(template?.heading_ar ?? "كيف كانت تجربتك؟");
  const [descriptionEn, setDescriptionEn] = useState(template?.description_en ?? "");
  const [descriptionAr, setDescriptionAr] = useState(template?.description_ar ?? "");
  const [ratingStyle, setRatingStyle] = useState(template?.rating_style ?? "emoji");
  const [layout, setLayout] = useState(template?.layout ?? "horizontal");
  const [surveyId, setSurveyId] = useState(template?.survey_id ?? "");
  const [showLogo, setShowLogo] = useState(template?.show_logo ?? true);
  const [showBusinessName, setShowBusinessName] = useState(template?.show_business_name ?? true);
  const [showPrivacyNotice, setShowPrivacyNotice] = useState(template?.show_privacy_notice ?? false);
  const [privacyNoticeEn, setPrivacyNoticeEn] = useState(template?.privacy_notice_en ?? "");
  const [privacyNoticeAr, setPrivacyNoticeAr] = useState(template?.privacy_notice_ar ?? "");
  const [brandColor, setBrandColor] = useState(template?.brand_color ?? "#2563eb");
  const [iconSize, setIconSize] = useState(template?.icon_size ?? "medium");
  const [alignment, setAlignment] = useState(template?.alignment ?? "left");
  const [thankYouEn, setThankYouEn] = useState(template?.thank_you_en ?? "");
  const [thankYouAr, setThankYouAr] = useState(template?.thank_you_ar ?? "");
  const [followUpEnabled, setFollowUpEnabled] = useState(template?.follow_up_enabled ?? true);
  const [autoSubmitPositive, setAutoSubmitPositive] = useState(template?.auto_submit_positive ?? true);

  const previewEmoji = ratingStyle === "emoji" ? "😊 🙂 😐 ☹ 😡" :
    ratingStyle === "star" ? "★★★★★" :
    ratingStyle === "three_option" ? "Great | Okay | Poor" :
    "Yes | No";

  const handleSubmit = useCallback(async (formData: FormData) => {
    const payload = JSON.stringify({
      templateName,
      headingEn,
      headingAr,
      descriptionEn,
      descriptionAr,
      ratingStyle,
      layout,
      surveyId: surveyId || null,
      showLogo,
      showBusinessName,
      showPrivacyNotice,
      privacyNoticeEn,
      privacyNoticeAr,
      brandColor,
      iconSize,
      alignment,
      thankYouEn,
      thankYouAr,
      followUpEnabled,
      autoSubmitPositive,
    });
    formData.set("template", payload);
    await createTemplate(formData);
  }, [templateName, headingEn, headingAr, descriptionEn, descriptionAr, ratingStyle, layout, surveyId, showLogo, showBusinessName, showPrivacyNotice, privacyNoticeEn, privacyNoticeAr, brandColor, iconSize, alignment, thankYouEn, thankYouAr, followUpEnabled, autoSubmitPositive]);

  return (
    <form action={handleSubmit} className="grid gap-5 rounded-xl border border-border bg-white p-6">
      {/* Template name */}
      <label className="grid gap-1 text-sm font-semibold">
        Template name
        <input value={templateName} onChange={(e) => setTemplateName(e.target.value)} required className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="e.g., Standard feedback" />
      </label>

      {/* Layout */}
      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Layout & Appearance</legend>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">
            Rating style
            <select value={ratingStyle} onChange={(e) => setRatingStyle(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="emoji">Emoji scale</option>
              <option value="star">Five-star scale</option>
              <option value="three_option">Three-option (Poor/Okay/Great)</option>
              <option value="yes_no">Yes/No</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Layout
            <select value={layout} onChange={(e) => setLayout(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="horizontal">Horizontal</option>
              <option value="vertical">Vertical</option>
              <option value="minimal">Minimal</option>
              <option value="branded">Branded</option>
            </select>
          </label>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <label className="grid gap-1 text-sm">
            Icon size
            <select value={iconSize} onChange={(e) => setIconSize(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Alignment
            <select value={alignment} onChange={(e) => setAlignment(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
              <option value="left">Left</option>
              <option value="center">Center</option>
              <option value="right">Right</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Brand color
            <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-9 w-full rounded-lg border border-border px-1" />
          </label>
        </div>
      </fieldset>

      {/* Text content */}
      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Text content</legend>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">
            Heading (English)
            <input value={headingEn} onChange={(e) => setHeadingEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-sm font-semibold" dir="rtl">
            العنوان (عربي)
            <input value={headingAr} onChange={(e) => setHeadingAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">
            Description (English, optional)
            <input value={descriptionEn} onChange={(e) => setDescriptionEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
          <label className="grid gap-1 text-sm" dir="rtl">
            الوصف (عربي، اختياري)
            <input value={descriptionAr} onChange={(e) => setDescriptionAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <label className="grid gap-1 text-sm">
            Thank-you message (English, optional)
            <input value={thankYouEn} onChange={(e) => setThankYouEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Thank you for your feedback!" />
          </label>
          <label className="grid gap-1 text-sm" dir="rtl">
            رسالة الشكر (عربي، اختياري)
            <input value={thankYouAr} onChange={(e) => setThankYouAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="شكراً لملاحظاتك!" />
          </label>
        </div>
      </fieldset>

      {/* Behavior */}
      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Behavior & Survey</legend>

        <label className="grid gap-1 text-sm">
          Survey
          <select value={surveyId} onChange={(e) => setSurveyId(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm">
            <option value="">Select a survey (required for assignment)</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>{s.title_en}{s.title_ar ? ` / ${s.title_ar}` : ""}</option>
            ))}
          </select>
        </label>

        <div className="flex gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={autoSubmitPositive} onChange={(e) => setAutoSubmitPositive(e.target.checked)} className="size-4" />
            Auto-submit positive ratings
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={followUpEnabled} onChange={(e) => setFollowUpEnabled(e.target.checked)} className="size-4" />
            Enable follow-up for low ratings
          </label>
        </div>
      </fieldset>

      {/* Options */}
      <fieldset className="grid gap-3 rounded-lg border border-border p-4">
        <legend className="text-sm font-semibold">Display options</legend>

        <div className="flex flex-wrap gap-6">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} className="size-4" />
            Show organization logo
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showBusinessName} onChange={(e) => setShowBusinessName(e.target.checked)} className="size-4" />
            Show business name
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={showPrivacyNotice} onChange={(e) => setShowPrivacyNotice(e.target.checked)} className="size-4" />
            Show privacy notice
          </label>
        </div>

        {showPrivacyNotice && (
          <div className="grid grid-cols-2 gap-4">
            <label className="grid gap-1 text-sm">
              Privacy notice (English)
              <input value={privacyNoticeEn} onChange={(e) => setPrivacyNoticeEn(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="Your privacy matters to us" />
            </label>
            <label className="grid gap-1 text-sm" dir="rtl">
              إشعار الخصوصية (عربي)
              <input value={privacyNoticeAr} onChange={(e) => setPrivacyNoticeAr(e.target.value)} className="rounded-lg border border-border px-3 py-2 text-sm" placeholder="خصوصيتك تهمنا" />
            </label>
          </div>
        )}
      </fieldset>

      {/* Live preview */}
      <div className="rounded-lg border border-border bg-gray-50 p-4">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Live preview</p>
        <div className="rounded-lg border border-border bg-white p-4" style={{ textAlign: alignment as "left" | "center" | "right" }}>
          {showBusinessName && <div className="text-sm font-semibold text-gray-700">Organization Name</div>}
          <div className="text-sm text-gray-700">{headingEn}</div>
          {descriptionEn && <div className="mt-0.5 text-xs text-gray-500">{descriptionEn}</div>}
          <div className="mt-1" style={{ fontSize: iconSize === "large" ? "24px" : iconSize === "small" ? "14px" : "18px", letterSpacing: "2px", color: brandColor }}>
            {previewEmoji}
          </div>
          {showPrivacyNotice && privacyNoticeEn && <div className="mt-1 text-[10px] text-gray-400">{privacyNoticeEn}</div>}
        </div>
      </div>

      {/* Submit */}
      <div className="flex gap-3">
        <button type="submit" className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-dark">
          {template ? "Update template" : "Create template"}
        </button>
      </div>
    </form>
  );
}
