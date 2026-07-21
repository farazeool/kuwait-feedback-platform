import "server-only";

import { randomUUID } from "node:crypto";

import type { SurveyBuilderQuestion, SurveyDraft } from "@/features/surveys/schemas";

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

export type SurveyTemplateId = "cafe_restaurant" | "retail" | "service_center" | "general";

type TemplateQuestion =
  | { type: "rating"; labelEn: string; labelAr: string; required: boolean; ratingMin: number; ratingMax: number }
  | { type: "text"; labelEn: string; labelAr: string; required: boolean; textMaxLength: number }
  | { type: "multiple_choice"; labelEn: string; labelAr: string; required: boolean; options: Array<{ labelEn: string; labelAr: string }> };

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

function toBuilderQuestion(question: TemplateQuestion): SurveyBuilderQuestion {
  const base = {
    id: randomUUID(),
    labelEn: question.labelEn,
    labelAr: question.labelAr,
    helpTextEn: "",
    helpTextAr: "",
    required: question.required,
  };
  if (question.type === "rating") {
    return { ...base, type: "rating", ratingMin: question.ratingMin, ratingMax: question.ratingMax };
  }
  if (question.type === "text") {
    return { ...base, type: "text", textMaxLength: question.textMaxLength };
  }
  return {
    ...base,
    type: "multiple_choice",
    options: question.options.map((option) => ({ id: randomUUID(), labelEn: option.labelEn, labelAr: option.labelAr })),
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
    titleEn: template.titleEn,
    titleAr: template.titleAr,
    descriptionEn: template.surveyDescriptionEn,
    descriptionAr: template.surveyDescriptionAr,
    thankYouEn: template.thankYouEn,
    thankYouAr: template.thankYouAr,
    defaultLocale: "en",
    locationIds: [...locationIds],
    questions: template.questions.map(toBuilderQuestion),
  };
}
