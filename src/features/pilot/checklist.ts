/**
 * Pilot onboarding checklist (Milestone 8).
 *
 * A state-derived setup checklist for pilot organizations. Each step is
 * marked complete by reading real data (locations, surveys, responses)
 * rather than a persisted flag, so the checklist can never drift from
 * reality and no database migration is required. `buildPilotChecklist` is
 * a pure function; the `PilotChecklist` server component supplies the
 * derived counts.
 */

export type PilotChecklistStepId = "location" | "survey" | "publish" | "response";

export type PilotChecklistInput = {
  locationCount: number;
  surveyCount: number;
  activeSurveyCount: number;
  responseCount: number;
};

export type PilotChecklistStep = {
  id: PilotChecklistStepId;
  labelEn: string;
  labelAr: string;
  hintEn: string;
  hintAr: string;
  href: string;
  completed: boolean;
};

export type PilotChecklist = {
  steps: PilotChecklistStep[];
  completedCount: number;
  totalCount: number;
  allComplete: boolean;
};

export function buildPilotChecklist(input: PilotChecklistInput): PilotChecklist {
  const steps: PilotChecklistStep[] = [
    {
      id: "location",
      labelEn: "Set up a location",
      labelAr: "إعداد موقع",
      hintEn: "Add a business location so customers can give feedback about it.",
      hintAr: "أضف موقع نشاطك التجاري ليتمكن العملاء من تقديم ملاحظات حوله.",
      href: "/dashboard/locations/new",
      completed: input.locationCount > 0,
    },
    {
      id: "survey",
      labelEn: "Create your first survey",
      labelAr: "أنشئ أول استبيان",
      hintEn: "Start from a bilingual template and edit the questions.",
      hintAr: "ابدأ من قالب ثنائي اللغة وعدّل الأسئلة.",
      href: "/dashboard/surveys/new",
      completed: input.surveyCount > 0,
    },
    {
      id: "publish",
      labelEn: "Publish a survey",
      labelAr: "انشر استبياناً",
      hintEn: "Publishing makes the survey live for customers.",
      hintAr: "النشر يجعل الاستبيان متاحاً للعملاء.",
      href: "/dashboard/surveys",
      completed: input.activeSurveyCount > 0,
    },
    {
      id: "response",
      labelEn: "Collect your first response",
      labelAr: "اجمع أول ملاحظة",
      hintEn: "Share your survey and watch responses come in.",
      hintAr: "شارك استبيانك وراقب وصول الملاحظات.",
      href: "/dashboard/responses",
      completed: input.responseCount > 0,
    },
  ];
  const completedCount = steps.filter((step) => step.completed).length;
  return {
    steps,
    completedCount,
    totalCount: steps.length,
    allComplete: completedCount === steps.length,
  };
}
