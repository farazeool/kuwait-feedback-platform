import { describe, expect, it } from "vitest";

import { buildPilotChecklist } from "@/features/pilot/checklist";

describe("buildPilotChecklist", () => {
  it("marks all steps incomplete for a brand-new pilot", () => {
    const checklist = buildPilotChecklist({ locationCount: 0, surveyCount: 0, activeSurveyCount: 0, responseCount: 0 });
    expect(checklist.totalCount).toBe(4);
    expect(checklist.completedCount).toBe(0);
    expect(checklist.allComplete).toBe(false);
    expect(checklist.steps.every((step) => !step.completed)).toBe(true);
  });

  it("completes only the location step once a location exists", () => {
    const checklist = buildPilotChecklist({ locationCount: 1, surveyCount: 0, activeSurveyCount: 0, responseCount: 0 });
    expect(checklist.steps[0].completed).toBe(true);
    expect(checklist.steps.slice(1).every((step) => !step.completed)).toBe(true);
    expect(checklist.completedCount).toBe(1);
    expect(checklist.allComplete).toBe(false);
  });

  it("completes the survey step when any survey exists, even a draft", () => {
    const checklist = buildPilotChecklist({ locationCount: 1, surveyCount: 1, activeSurveyCount: 0, responseCount: 0 });
    expect(checklist.steps[1].completed).toBe(true);
    // Publish step still incomplete because no survey is active.
    expect(checklist.steps[2].completed).toBe(false);
    expect(checklist.completedCount).toBe(2);
  });

  it("completes the publish step only when an active survey exists", () => {
    const checklist = buildPilotChecklist({ locationCount: 1, surveyCount: 2, activeSurveyCount: 1, responseCount: 0 });
    expect(checklist.steps[2].completed).toBe(true);
    expect(checklist.steps[3].completed).toBe(false);
  });

  it("reports allComplete only when every step is satisfied", () => {
    const partial = buildPilotChecklist({ locationCount: 1, surveyCount: 1, activeSurveyCount: 1, responseCount: 0 });
    expect(partial.allComplete).toBe(false);
    const complete = buildPilotChecklist({ locationCount: 1, surveyCount: 1, activeSurveyCount: 1, responseCount: 1 });
    expect(complete.steps.every((step) => step.completed)).toBe(true);
    expect(complete.completedCount).toBe(4);
    expect(complete.allComplete).toBe(true);
  });

  it("exposes bilingual labels, non-empty hints, and dashboard hrefs for every step", () => {
    const checklist = buildPilotChecklist({ locationCount: 0, surveyCount: 0, activeSurveyCount: 0, responseCount: 0 });
    expect(checklist.steps.map((step) => step.id)).toEqual(["location", "survey", "publish", "response"]);
    for (const step of checklist.steps) {
      expect(step.labelEn.trim().length).toBeGreaterThan(0);
      expect(step.labelAr.trim().length).toBeGreaterThan(0);
      expect(step.hintEn.trim().length).toBeGreaterThan(0);
      expect(step.hintAr.trim().length).toBeGreaterThan(0);
      expect(step.href.startsWith("/dashboard/")).toBe(true);
    }
  });

  it("does not share mutable state between calls", () => {
    const input = { locationCount: 1, surveyCount: 1, activeSurveyCount: 1, responseCount: 1 };
    const first = buildPilotChecklist(input);
    first.steps[0].labelEn = "EDITED";
    first.completedCount = 0;
    const second = buildPilotChecklist(input);
    expect(second.steps[0].labelEn).not.toBe("EDITED");
    expect(second.completedCount).toBe(4);
  });
});
