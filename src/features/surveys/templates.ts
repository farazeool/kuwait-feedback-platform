import "server-only";

import { randomUUID } from "node:crypto";

import type { SurveyBuilderQuestion, SurveyDraft } from "@/features/surveys/schemas";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Application-level survey templates (Milestone 8).
 *
 * Templates are pure, immutable definitions. `buildTemplateDraft` produces a
 * fresh, fully-owned SurveyDraft on every call with newly generated question
 * and option identifiers, so no mutable state is ever shared between callers or
 * tenants. Applying a template routes through the existing survey-draft save
 * path; the copied survey is fully editable afterwards. No database table or
 * migration backs these — they are starter content only.
 */

export type SurveyTemplateId = "cafe_restaurant" | "retail" | "service_center" | "general" | "fresh_produce";

type TemplateQuestion =
  | { type: "rating"; labelEn: string; labelAr: string; required: boolean; ratingMin: number; ratingMax: number; ratingScale?: string }
  | { type: "text"; labelEn: string; labelAr: string; required: boolean; textMaxLength: number }
  | { type: "multiple_choice"; labelEn: string; labelAr: string; required: boolean; allowMultiple?: boolean; options: Array<{ labelEn: string; labelAr: string; concernSlug?: string }> };

type SurveyTemplate = {
  id: SurveyTemplateId;
  nameEn: string;
  nameAr: string;
  descriptionEn: string;
  descriptionAr: string;
  titleEn: string;
  titleAr: string;
  surveyDescriptionEn: string;
  surveyDescriptionAr: string;
  thankYouEn: string;
  thankYouAr: string;
  surveyType: "generic" | "fresh_produce";
  questions: TemplateQuestion[];
};

const RATING_1_5 = { ratingMin: 1, ratingMax: 5 } as const;

const overallExperience: TemplateQuestion = {
  type: "rating",
  labelEn: "How would you rate your overall experience?",
  labelAr: "كيف تقيّم تجربتك بشكل عام؟",
  required: true,
  ...RATING_1_5,
};

const likelihoodToReturn: TemplateQuestion = {
  type: "rating",
  labelEn: "How likely are you to visit us again?",
  labelAr: "ما مدى احتمال زيارتك لنا مرة أخرى؟",
  required: false,
  ...RATING_1_5,
};

const optionalComment: TemplateQuestion = {
  type: "text",
  labelEn: "Anything you would like to add? (optional)",
  labelAr: "هل ترغب في إضافة أي ملاحظة؟ (اختياري)",
  required: false,
  textMaxLength: 1000,
};

const TEMPLATES: readonly SurveyTemplate[] = [
  {
    id: "cafe_restaurant",
    nameEn: "Café / Restaurant experience",
    nameAr: "تجربة المقهى / المطعم",
    descriptionEn: "Food quality, service speed, and cleanliness for cafés and restaurants.",
    descriptionAr: "جودة الطعام وسرعة الخدمة والنظافة للمقاهي والمطاعم.",
    titleEn: "Customer experience survey",
    titleAr: "استبيان تجربة العميل",
    surveyDescriptionEn: "Your feedback helps us improve your next visit.",
    surveyDescriptionAr: "ملاحظاتك تساعدنا على تحسين زيارتك القادمة.",
    thankYouEn: "Thank you for helping us serve you better.",
    thankYouAr: "شكراً لمساعدتنا على خدمتك بشكل أفضل.",
    surveyType: "generic",
    questions: [
      overallExperience,
      { type: "rating", labelEn: "How was the quality of your food and drinks?", labelAr: "كيف كانت جودة الطعام والمشروبات؟", required: true, ...RATING_1_5 },
      { type: "rating", labelEn: "How was the speed of service?", labelAr: "كيف كانت سرعة الخدمة؟", required: false, ...RATING_1_5 },
      { type: "rating", labelEn: "How clean was the location?", labelAr: "ما مدى نظافة المكان؟", required: false, ...RATING_1_5 },
      { type: "rating", labelEn: "How helpful was our staff?", labelAr: "ما مدى تعاون فريق العمل؟", required: false, ...RATING_1_5 },
      likelihoodToReturn,
      optionalComment,
    ],
  },
  {
    id: "retail",
    nameEn: "Retail store experience",
    nameAr: "تجربة متجر التجزئة",
    descriptionEn: "Product availability, staff assistance, and checkout for retail stores.",
    descriptionAr: "توفر المنتجات ومساعدة الموظفين وتجربة الدفع لمتاجر التجزئة.",
    titleEn: "Store experience survey",
    titleAr: "استبيان تجربة المتجر",
    surveyDescriptionEn: "Tell us about your visit to our store.",
    surveyDescriptionAr: "شاركنا رأيك في زيارتك لمتجرنا.",
    thankYouEn: "Thank you for shopping with us.",
    thankYouAr: "شكراً لتسوقك معنا.",
    surveyType: "generic",
    questions: [
      overallExperience,
      { type: "rating", labelEn: "Did you find the products you were looking for?", labelAr: "هل وجدت المنتجات التي تبحث عنها؟", required: true, ...RATING_1_5 },
      { type: "rating", labelEn: "How helpful was our staff?", labelAr: "ما مدى تعاون فريق العمل؟", required: false, ...RATING_1_5 },
      { type: "rating", labelEn: "How was the checkout experience?", labelAr: "كيف كانت تجربة الدفع؟", required: false, ...RATING_1_5 },
      { type: "rating", labelEn: "How clean and organized was the store?", labelAr: "ما مدى نظافة وتنظيم المتجر؟", required: false, ...RATING_1_5 },
      likelihoodToReturn,
      optionalComment,
    ],
  },
  {
    id: "service_center",
    nameEn: "Service center experience",
    nameAr: "تجربة مركز الخدمة",
    descriptionEn: "Wait time, staff knowledge, and resolution for service centers.",
    descriptionAr: "وقت الانتظار ومعرفة الموظفين وحل المشكلات لمراكز الخدمة.",
    titleEn: "Service satisfaction survey",
    titleAr: "استبيان رضا الخدمة",
    surveyDescriptionEn: "Help us improve the service we provide.",
    surveyDescriptionAr: "ساعدنا على تحسين الخدمة التي نقدمها.",
    thankYouEn: "Thank you for your feedback on our service.",
    thankYouAr: "شكراً لملاحظاتك على خدمتنا.",
    surveyType: "generic",
    questions: [
      overallExperience,
      { type: "rating", labelEn: "Was your issue resolved to your satisfaction?", labelAr: "هل تم حل مشكلتك بما يرضيك؟", required: true, ...RATING_1_5 },
      { type: "rating", labelEn: "How would you rate the waiting time?", labelAr: "كيف تقيّم وقت الانتظار؟", required: false, ...RATING_1_5 },
      { type: "rating", labelEn: "How knowledgeable was our staff?", labelAr: "ما مدى معرفة فريق العمل؟", required: false, ...RATING_1_5 },
      likelihoodToReturn,
      optionalComment,
    ],
  },
  {
    id: "general",
    nameEn: "General customer satisfaction",
    nameAr: "رضا العملاء العام",
    descriptionEn: "A short, general-purpose satisfaction survey for any business.",
    descriptionAr: "استبيان رضا قصير وعام يناسب أي نشاط تجاري.",
    titleEn: "Customer satisfaction survey",
    titleAr: "استبيان رضا العملاء",
    surveyDescriptionEn: "We value your feedback.",
    surveyDescriptionAr: "نقدّر ملاحظاتك.",
    thankYouEn: "Thank you for your feedback.",
    thankYouAr: "شكراً لملاحظاتك.",
    surveyType: "generic",
    questions: [
      overallExperience,
      { type: "rating", labelEn: "How satisfied are you with our service?", labelAr: "ما مدى رضاك عن خدمتنا؟", required: true, ...RATING_1_5 },
      { type: "multiple_choice", labelEn: "How did you hear about us?", labelAr: "كيف سمعت عنا؟", required: false, options: [
        { labelEn: "Friend or family", labelAr: "صديق أو عائلة" },
        { labelEn: "Social media", labelAr: "وسائل التواصل الاجتماعي" },
        { labelEn: "Passing by", labelAr: "بالمرور" },
        { labelEn: "Other", labelAr: "أخرى" },
      ] },
      likelihoodToReturn,
      optionalComment,
    ],
  },
  {
    id: "fresh_produce",
    nameEn: "Fresh Produce QA",
    nameAr: "ضبط جودة المنتجات الطازجة",
    descriptionEn: "Quality rating and concern tracking for fresh produce departments.",
    descriptionAr: "تقييم الجودة وتتبع المخاوف لأقسام المنتجات الطازجة.",
    titleEn: "Fresh Produce quality survey",
    titleAr: "استبيان جودة المنتجات الطازجة",
    surveyDescriptionEn: "Rate the quality of our fresh produce and tell us about any concerns.",
    surveyDescriptionAr: "قيّم جودة منتجاتنا الطازجة وأخبرنا عن أي مخاوف.",
    thankYouEn: "Thank you for helping us maintain quality.",
    thankYouAr: "شكراً لمساعدتنا في الحفاظ على الجودة.",
    surveyType: "fresh_produce",
    questions: [
      {
        type: "rating",
        labelEn: "How would you rate the quality of the produce?",
        labelAr: "كيف تقيّم جودة المنتجات؟",
        required: true,
        ratingMin: 1,
        ratingMax: 5,
        ratingScale: "fresh_produce_5",
      },
      {
        type: "multiple_choice",
        labelEn: "Did you notice any concerns? (select all that apply)",
        labelAr: "هل لاحظت أي مخاوف؟ (اختر كل ما ينطبق)",
        required: false,
        allowMultiple: true,
        options: [
          { labelEn: "Not fresh / wilted", labelAr: "غير طازج / ذابل", concernSlug: "freshness" },
          { labelEn: "Poor appearance / bruised", labelAr: "مظهر سيئ / به كدمات", concernSlug: "appearance" },
          { labelEn: "Not available on shelf", labelAr: "غير متوفر على الرف", concernSlug: "availability" },
          { labelEn: "Display not clean", labelAr: "العرض غير نظيف", concernSlug: "cleanliness" },
          { labelEn: "Price too high", labelAr: "السعر مرتفع جداً", concernSlug: "price" },
          { labelEn: "Could not find staff help", labelAr: "لم أجد مساعدة من الموظفين", concernSlug: "staff-assistance" },
        ],
      },
      optionalComment,
    ],
  },
] as const;

export const SURVEY_TEMPLATE_SUMMARIES = TEMPLATES.map((template) => ({
  id: template.id,
  nameEn: template.nameEn,
  nameAr: template.nameAr,
  descriptionEn: template.descriptionEn,
  descriptionAr: template.descriptionAr,
  questionCount: template.questions.length,
}));

export function isSurveyTemplateId(value: string): value is SurveyTemplateId {
  return TEMPLATES.some((template) => template.id === value);
}

function toBuilderQuestion(question: TemplateQuestion, concernIdBySlug?: Map<string, string>): SurveyBuilderQuestion {
  const base = {
    id: randomUUID(),
    labelEn: question.labelEn,
    labelAr: question.labelAr,
    helpTextEn: "",
    helpTextAr: "",
    required: question.required,
  };
  if (question.type === "rating") {
    return { ...base, type: "rating", ratingMin: question.ratingMin, ratingMax: question.ratingMax, ratingScale: question.ratingScale ?? null };
  }
  if (question.type === "text") {
    return { ...base, type: "text", textMaxLength: question.textMaxLength };
  }
  return {
    ...base,
    type: "multiple_choice",
    allowMultiple: question.allowMultiple ?? false,
    options: question.options.map((option) => ({
      id: randomUUID(),
      labelEn: option.labelEn,
      labelAr: option.labelAr,
      concernCategoryId: option.concernSlug && concernIdBySlug?.get(option.concernSlug)
        ? concernIdBySlug.get(option.concernSlug) ?? null
        : null,
    })),
  };
}

/**
 * Build a fresh, editable SurveyDraft from a template. Every call returns newly
 * allocated objects with unique identifiers; nothing is shared with the
 * template definition or with other callers.
 */
export function buildTemplateDraft(templateId: SurveyTemplateId, locationIds: string[]): SurveyDraft {
  const template = TEMPLATES.find((item) => item.id === templateId);
  if (!template) throw new Error(`Unknown survey template: ${templateId}`);
  return {
    surveyId: null,
    surveyType: template.surveyType,
    titleEn: template.titleEn,
    titleAr: template.titleAr,
    descriptionEn: template.surveyDescriptionEn,
    descriptionAr: template.surveyDescriptionAr,
    thankYouEn: template.thankYouEn,
    thankYouAr: template.thankYouAr,
    defaultLocale: "en",
    locationIds: [...locationIds],
    questions: template.questions.map((q) => toBuilderQuestion(q)),
    quickFeedbackEnabled: false,
    quickFeedbackRatingStyle: "emoji" as const,
    quickFeedbackPositiveThreshold: 4,
    quickFeedbackNegativeThreshold: 3,
    quickFeedbackCategories: [],
  };
}

/**
 * Build a Fresh Produce template with concern category UUIDs resolved from the
 * database. Must be called from a server context.
 */
export async function buildFreshProduceTemplateDraft(locationIds: string[]): Promise<SurveyDraft> {
  const template = TEMPLATES.find((item) => item.id === "fresh_produce");
  if (!template) throw new Error("Fresh Produce template not found");

  const supabase = await createSupabaseServerClient();
  const { data: categories } = await supabase
    .from("concern_categories")
    .select("id, slug")
    .eq("is_active", true);

  const concernIdBySlug = new Map<string, string>();
  if (categories) {
    for (const cat of categories) {
      concernIdBySlug.set(cat.slug, cat.id);
    }
  }

  return {
    surveyId: null,
    surveyType: template.surveyType,
    titleEn: template.titleEn,
    titleAr: template.titleAr,
    descriptionEn: template.surveyDescriptionEn,
    descriptionAr: template.surveyDescriptionAr,
    thankYouEn: template.thankYouEn,
    thankYouAr: template.thankYouAr,
    defaultLocale: "en",
    locationIds: [...locationIds],
    questions: template.questions.map((q) => toBuilderQuestion(q, concernIdBySlug)),
    quickFeedbackEnabled: false,
    quickFeedbackRatingStyle: "emoji" as const,
    quickFeedbackPositiveThreshold: 4,
    quickFeedbackNegativeThreshold: 3,
    quickFeedbackCategories: [],
  };
}
