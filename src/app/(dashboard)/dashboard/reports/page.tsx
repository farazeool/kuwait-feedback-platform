import Link from "next/link";

import { listAvailableSurveys, generateMonthlyReport } from "@/features/reports/server";
import { MetricCard } from "@/components/analytics/metric-card";

type ReportData = {
  kpi: {
    total_responses?: number;
    satisfaction_pct?: number;
    negative_feedback_pct?: number;
    average_rating?: number;
    top_concerns?: Array<{ slug: string; name_en: string; name_ar: string; count: number }>;
    location_kpis?: Array<{
      id: string;
      name_en: string;
      name_ar: string;
      response_count: number;
      average_rating: number | null;
      satisfaction_pct: number | null;
      negative_feedback_pct: number | null;
    }>;
    channel_breakdown?: Array<{ channel: string; count: number }>;
  } | null;
  concernTrend: Array<{ slug: string; name_en: string; name_ar: string; period: string; count: number }>;
  alertSummary: Array<{ status: string; count: number; low_score_count: number; system_count: number }>;
  reviewOutcomes: Array<{ workflow_status: string; count: number; with_controlled_record: number }>;
  prevKpi: {
    prev_satisfaction_pct?: number | null;
    prev_negative_feedback_pct?: number | null;
  } | null;
  period: { startAt: string; endAt: string; prevStart: string; prevEnd: string };
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const { context, surveys } = await listAvailableSurveys();
  const isArabic = context.profile.locale === "ar";

  if (!context.organization) {
    return <p className="text-sm text-muted">Create an organization before viewing reports.</p>;
  }

  const startAt = notice.startAt;
  const endAt = notice.endAt;
  const locationId = notice.locationId;
  const surveyId = notice.surveyId;

  // Fetch report data if dates are provided
  let reportData: ReportData | null = null;
  if (startAt && endAt) {
    const { report } = await generateMonthlyReport({
      startAt,
      endAt,
      locationId: locationId || undefined,
      surveyId: surveyId || undefined,
    });
    if (report) reportData = report as ReportData;
  }

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Insights</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">Reports</h1>
        <p className="mt-1 text-sm text-muted">Generate printable management summaries for your organization.</p>
      </header>

      {notice.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          Report generation failed.
        </p>
      ) : null}

      <form action="/dashboard/reports" method="get" className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="reportType" value="monthly" />
        <label className="grid gap-2 text-sm font-semibold">
          Start date
          <input type="date" name="startAt" required defaultValue={startAt} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          End date
          <input type="date" name="endAt" required defaultValue={endAt} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Survey (optional)
          <select name="surveyId" defaultValue={surveyId ?? ""} className="rounded-lg border border-border px-3 py-2">
            <option value="">All surveys</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>{s.title_en}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          Location (optional)
          <select name="locationId" defaultValue={locationId ?? ""} className="rounded-lg border border-border px-3 py-2">
            <option value="">All locations</option>
            {context.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {isArabic ? loc.nameAr : loc.nameEn}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white sm:col-span-2 xl:col-span-4">Generate report</button>
      </form>

      {reportData ? (
        <>
          {/* Monthly Summary Header */}
          <div className="rounded-xl border border-border bg-white p-6 print:break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold">Monthly summary report</h2>
                <p className="mt-1 text-sm text-muted">
                  {isArabic ? "الفترة" : "Period"}: {formatDate(reportData.period.startAt)} – {formatDate(reportData.period.endAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Link className="rounded-lg border border-border px-4 py-2 font-medium print:hidden" href={`/api/exports/survey_summaries?${new URLSearchParams({ organization: context.organization.id, from: startAt as string, to: endAt as string, survey: surveyId ?? "", location: locationId ?? "" })}`}>
                  Survey summaries CSV
                </Link>
                <Link className="rounded-lg border border-border px-4 py-2 font-medium print:hidden" href={`/api/exports/location_summaries?${new URLSearchParams({ organization: context.organization.id, from: startAt as string, to: endAt as string, survey: surveyId ?? "", location: locationId ?? "" })}`}>
                  Location summaries CSV
                </Link>
                <button onClick={() => window.print()} className="rounded-lg bg-brand px-4 py-2 font-semibold text-white print:hidden">
                  Print / Save as PDF
                </button>
              </div>
            </div>

            {/* KPI Cards */}
            {reportData.kpi && (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8 print:grid-cols-4">
                <MetricCard
                  label={isArabic ? "إجمالي الردود" : "Total responses"}
                  value={reportData.kpi.total_responses?.toLocaleString() ?? "—"}
                />
                <MetricCard
                  label={isArabic ? "نسبة الرضا" : "Satisfaction %"}
                  value={reportData.kpi.satisfaction_pct != null ? `${reportData.kpi.satisfaction_pct}%` : "—"}
                  detail={
                    reportData.prevKpi?.prev_satisfaction_pct != null
                      ? `${isArabic ? "السابقة" : "Previous"}: ${reportData.prevKpi.prev_satisfaction_pct}%${reportData.kpi.satisfaction_pct != null ? ` (${reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct >= 0 ? "+" : ""}${(reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct).toFixed(2)}%)` : ""}`
                      : undefined
                  }
                />
                <MetricCard
                  label={isArabic ? "نسبة التعليقات السلبية" : "Negative feedback %"}
                  value={reportData.kpi.negative_feedback_pct != null ? `${reportData.kpi.negative_feedback_pct}%` : "—"}
                  detail={
                    reportData.prevKpi?.prev_negative_feedback_pct != null
                      ? `${isArabic ? "السابقة" : "Previous"}: ${reportData.prevKpi.prev_negative_feedback_pct}%`
                      : undefined
                  }
                />
                <MetricCard
                  label={isArabic ? "متوسط التقييم" : "Average rating"}
                  value={reportData.kpi.average_rating != null ? reportData.kpi.average_rating.toFixed(1) : "—"}
                />
              </div>
            )}

            {/* Concern Trend Table */}
            {reportData.concernTrend.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "أهم المواضيع" : "Top concerns"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الموضوع" : "Concern"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الفترة" : "Period"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.concernTrend.slice(0, 10).map((concern, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3">
                            <p className="font-medium">{isArabic ? concern.name_ar : concern.name_en}</p>
                            <p className="text-xs text-muted">{concern.slug}</p>
                          </td>
                          <td className="p-3 text-right font-medium">{concern.count}</td>
                          <td className="p-3 text-right text-muted">{concern.period}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Location Comparison Table */}
            {reportData.kpi?.location_kpis && reportData.kpi.location_kpis.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "مقارنة الفروع" : "Location comparison"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الفرع" : "Location"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الردود" : "Responses"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "متوسط التقييم" : "Avg rating"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة الرضا" : "Satisfaction %"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة السلبي" : "Negative %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.kpi.location_kpis
                        .filter((loc) => loc.response_count > 0)
                        .map((loc, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="p-3 font-medium">{isArabic ? loc.name_ar : loc.name_en}</td>
                            <td className="p-3 text-right">{loc.response_count.toLocaleString()}</td>
                            <td className="p-3 text-right font-medium">{loc.average_rating?.toFixed(1) ?? "—"}</td>
                            <td className="p-3 text-right">{loc.satisfaction_pct != null ? `${loc.satisfaction_pct}%` : "—"}</td>
                            <td className="p-3 text-right">{loc.negative_feedback_pct != null ? `${loc.negative_feedback_pct}%` : "—"}</td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Channel Breakdown Table */}
            {reportData.kpi?.channel_breakdown && reportData.kpi.channel_breakdown.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "تفصيل القنوات" : "Channel breakdown"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "القناة" : "Channel"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الردود" : "Responses"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "النسبة" : "%"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.kpi.channel_breakdown.map((ch, idx) => {
                        const total = reportData.kpi?.channel_breakdown?.reduce((sum, c) => sum + c.count, 0) ?? 0;
                        return (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="p-3 font-medium">{ch.channel}</td>
                            <td className="p-3 text-right">{ch.count.toLocaleString()}</td>
                            <td className="p-3 text-right">{total > 0 ? `${((ch.count / total) * 100).toFixed(1)}%` : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Alert Summary Table */}
            {reportData.alertSummary.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "ملخص التنبيهات" : "Alert summary"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الحالة" : "Status"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "تنبيهات التقييم المنخفض" : "Low score alerts"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "تنبيهات النظام" : "System alerts"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.alertSummary.map((alert, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              alert.status === "open" ? "bg-red-100 text-red-800" :
                              alert.status === "acknowledged" ? "bg-yellow-100 text-yellow-800" :
                              alert.status === "resolved" ? "bg-green-100 text-green-800" :
                              "bg-gray-100 text-gray-800"
                            }`}>
                              {alert.status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium">{alert.count}</td>
                          <td className="p-3 text-right">{alert.low_score_count}</td>
                          <td className="p-3 text-right">{alert.system_count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Review Outcome Summary Table */}
            {reportData.reviewOutcomes.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "ملخص نتائج المراجعة" : "Review outcome summary"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "حالة سير العمل" : "Workflow status"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "مع سجل مُدار" : "With controlled record"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.reviewOutcomes.map((outcome, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              outcome.workflow_status === "unread" ? "bg-gray-100 text-gray-800" :
                              outcome.workflow_status === "reviewed" ? "bg-blue-100 text-blue-800" :
                              outcome.workflow_status === "action_required" ? "bg-yellow-100 text-yellow-800" :
                              "bg-green-100 text-green-800"
                            }`}>
                              {outcome.workflow_status}
                            </span>
                          </td>
                          <td className="p-3 text-right font-medium">{outcome.count}</td>
                          <td className="p-3 text-right">{outcome.with_controlled_record}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Previous Period Comparison for Satisfaction */}
            {reportData.kpi && reportData.prevKpi && (
              <section className="print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "مقارنة الفترة السابقة" : "Previous period comparison"}</h3>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{isArabic ? "نسبة الرضا" : "Satisfaction %"}</p>
                    <p className="mt-1 text-3xl font-bold">
                      {reportData.kpi.satisfaction_pct != null ? `${reportData.kpi.satisfaction_pct}%` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {reportData.prevKpi.prev_satisfaction_pct != null && reportData.kpi.satisfaction_pct != null
                        ? `${isArabic ? "السابقة" : "Previous"}: ${reportData.prevKpi.prev_satisfaction_pct}% (${reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct >= 0 ? "+" : ""}${(reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct).toFixed(2)}%)`
                        : isArabic ? "لا توجد بيانات للمقارنة" : "No comparison data"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{isArabic ? "نسبة التعليقات السلبية" : "Negative feedback %"}</p>
                    <p className="mt-1 text-3xl font-bold">
                      {reportData.kpi.negative_feedback_pct != null ? `${reportData.kpi.negative_feedback_pct}%` : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {reportData.prevKpi.prev_negative_feedback_pct != null && reportData.kpi.negative_feedback_pct != null
                        ? `${isArabic ? "السابقة" : "Previous"}: ${reportData.prevKpi.prev_negative_feedback_pct}%`
                        : isArabic ? "لا توجد بيانات للمقارنة" : "No comparison data"}
                    </p>
                  </div>
                  <div className="rounded-lg border border-border p-4">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted">{isArabic ? "متوسط التقييم" : "Average rating"}</p>
                    <p className="mt-1 text-3xl font-bold">
                      {reportData.kpi.average_rating != null ? reportData.kpi.average_rating.toFixed(1) : "—"}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {isArabic ? "لا توجد بيانات للمقارنة" : "No comparison data"}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Print footer */}
            <footer className="mt-8 pt-4 border-t border-border text-xs text-muted hidden print:block">
              <p>Generated on {new Date().toLocaleDateString(isArabic ? "ar-KW" : "en-US", { dateStyle: "full" })}</p>
              <p>Organization: {isArabic ? context.organization.nameAr : context.organization.nameEn}</p>
              <p>Period: {formatDate(reportData.period.startAt)} – {formatDate(reportData.period.endAt)}</p>
            </footer>
          </div>
        </>
      ) : (
        startAt && endAt ? null : (
          <p className="rounded-xl border border-border bg-white p-6 text-sm text-muted text-center">
            Select a date range and click &ldquo;Generate report&rdquo; to view the monthly summary.
          </p>
        )
      )}
    </div>
  );
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}
