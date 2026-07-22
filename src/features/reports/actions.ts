"use server";

import { redirect } from "next/navigation";

import { requireAppAccessContext } from "@/lib/auth/context";

const REPORT_TYPES = ["monthly", "branch", "department", "concern", "channel", "review", "alert"] as const;
type ReportType = typeof REPORT_TYPES[number];

export async function generateReport(formData: FormData) {
  const context = await requireAppAccessContext();
  if (!context.organization) redirect("/dashboard/reports?error=denied");

  const raw = Object.fromEntries(formData);
  const reportType = REPORT_TYPES.includes(raw.reportType as ReportType) ? (raw.reportType as ReportType) : "monthly";
  const startAt = raw.startAt ? String(raw.startAt).trim() : "";
  const endAt = raw.endAt ? String(raw.endAt).trim() : "";
  const locationId = raw.locationId ? String(raw.locationId).trim() : "";
  const surveyId = raw.surveyId ? String(raw.surveyId).trim() : "";

  if (!startAt || !endAt) {
    redirect("/dashboard/reports?error=missing_dates");
  }

  const params = new URLSearchParams();
  params.set("reportType", reportType);
  params.set("startAt", startAt);
  params.set("endAt", endAt);
  if (locationId) params.set("locationId", locationId);
  if (surveyId) params.set("surveyId", surveyId);

  redirect(`/dashboard/reports?${params.toString()}`);
}
