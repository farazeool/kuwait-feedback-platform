import Link from "next/link";

import { listAvailableSurveys, generateMonthlyReport } from "@/features/reports/server";
import { MetricCard } from "@/components/analytics/metric-card";
import { AccessibleBarChart } from "@/components/analytics/bar-chart";
import { PrintButton } from "@/components/surveys/print-button";
import { getMessages } from "@/lib/i18n/messages";

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
  correctiveActions: {
    total: number;
    open: number;
    in_progress: number;
    pending_verification: number;
    verified: number;
    effectiveness_review: number;
    closed: number;
    rejected: number;
    overdue: number;
    by_priority: Array<{ priority: string; count: number }>;
    by_status: Array<{ status: string; count: number }>;
  } | null;
  branchRanking: Array<{
    id: string;
    name_en: string;
    name_ar: string;
    response_count: number;
    average_rating: number | null;
    satisfaction_pct: number | null;
    negative_feedback_pct: number | null;
  }>;
  departmentRanking: Array<{
    id: string;
    name_en: string;
    name_ar: string;
    location_name_en: string;
    location_name_ar: string;
    response_count: number;
    average_rating: number | null;
    satisfaction_pct: number | null;
    negative_feedback_pct: number | null;
  }>;
  alertSeverityBreakdown: Array<{ severity: string; count: number }>;
  triggerBreakdown: Array<{ rule_type: string; count: number }>;
  managementDecisions: Array<{
    id: string;
    title: string | null;
    branch_id: string;
    branch_name_en: string;
    branch_name_ar: string;
    department_id: string | null;
    department_name_en: string | null;
    department_name_ar: string | null;
    investigated_at: string;
    escalation_decision: string;
    recommendation: string | null;
    findings: string | null;
    root_cause: string | null;
    controlled_record_references: string[];
    evidence_reviewed: string | null;
    status: string;
    closed_at: string | null;
  }>;
  followupRecords: Array<{
    id: string;
    response_id: string;
    recorded_at: string;
    actor_id: string;
    new_status: string;
    previous_status: string | null;
    controlled_record_type: string | null;
    controlled_record_reference: string | null;
    controlled_record_reason: string | null;
    follow_up_details: string | null;
    outcome_summary: string | null;
    survey_title_en: string;
    survey_title_ar: string;
    location_name_en: string;
    location_name_ar: string;
    department_name_en: string | null;
    department_name_ar: string | null;
  }>;
  correctiveActionVerification: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
    more_evidence_required: number;
    by_status: Array<{ status: string; count: number }>;
  } | null;
  correctiveActionEffectiveness: {
    total_reviewed: number;
    effective: number;
    partially_effective: number;
    not_effective: number;
    by_result: Array<{ result: string; count: number }>;
  } | null;
  controlledRecordRefs: Array<{
    response_id: string;
    recorded_at: string | null;
    recorded_by: string | null;
    controlled_record_type: string | null;
    controlled_record_reference: string | null;
    controlled_record_status: string | null;
    outcome_summary: string | null;
    survey_title_en: string;
    survey_title_ar: string;
    location_name_en: string;
    location_name_ar: string;
    department_name_en: string | null;
    department_name_ar: string | null;
  }>;
  targetStatus: {
    satisfaction_pct: number | null;
    negative_feedback_pct: number | null;
    response_count: number;
    average_rating: number | null;
    target_status: Array<{
      metric: string;
      satisfied_min: number;
      negative_max: number;
      current_satisfaction_pct: number | null;
      current_negative_feedback_pct: number | null;
      current_avg_rating: number | null;
      current_response_count: number;
      status: string;
    }>;
  } | null;
  trendCharts: {
    concern_trend: Array<{
      period: string;
      concern_slug: string;
      concern_name_en: string;
      concern_name_ar: string;
      count: number;
    }>;
    response_trend: Array<{
      period: string;
      count: number;
    }>;
  } | null;
  prevKpi: {
    prev_satisfaction_pct?: number | null;
    prev_negative_feedback_pct?: number | null;
  } | null;
  period: { startAt: string; endAt: string; prevStart: string; prevEnd: string };
};

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const notice = await searchParams;
  const { context, surveys } = await listAvailableSurveys();
  const locale = context.profile.locale as "en" | "ar";
  const isArabic = locale === "ar";
  const messages = getMessages(locale);

  if (!context.organization) {
    return <p className="text-sm text-muted">{messages["common.empty"]}</p>;
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

  const localeObj = isArabic ? "ar-KW" : "en-US";
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(localeObj, { year: "numeric", month: "short", day: "numeric" });
  };
  const formatTimestamp = (dateStr: string | null | undefined) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(localeObj, { year: "numeric", month: "long", day: "numeric" });
  };

  return (
    <div className="grid gap-6">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">{messages["nav.reports"]}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight text-foreground">{messages["nav.reports"]}</h1>
        <p className="mt-1 text-sm text-muted">Generate printable management summaries for your organization.</p>
      </header>

      {notice.error ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {messages["common.error"]}
        </p>
      ) : null}

      <form action="/dashboard/reports" method="get" className="grid gap-4 rounded-xl border border-border bg-white p-5 sm:grid-cols-2 xl:grid-cols-4">
        <input type="hidden" name="reportType" value="monthly" />
        <label className="grid gap-2 text-sm font-semibold">
          {messages["common.filter"]} - {messages["analytics.average"]}
          <input type="date" name="startAt" required defaultValue={startAt} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          End date
          <input type="date" name="endAt" required defaultValue={endAt} className="rounded-lg border border-border px-3 py-2" />
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {messages["nav.surveys"]} (optional)
          <select name="surveyId" defaultValue={surveyId ?? ""} className="rounded-lg border border-border px-3 py-2">
            <option value="">{messages["survey.empty"]}</option>
            {surveys.map((s) => (
              <option key={s.id} value={s.id}>
                {isArabic ? s.title_ar : s.title_en}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2 text-sm font-semibold">
          {messages["nav.locations"]} (optional)
          <select name="locationId" defaultValue={locationId ?? ""} className="rounded-lg border border-border px-3 py-2">
            <option value="">{messages["nav.locations"]}</option>
            {context.locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {isArabic ? loc.nameAr : loc.nameEn}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="rounded-lg bg-brand px-4 py-2 font-semibold text-white sm:col-span-2 xl:col-span-4 print:hidden">
          Generate report
        </button>
      </form>

      {reportData ? (
        <>
          {/* Monthly Summary Header */}
          <div className="rounded-xl border border-border bg-white p-6 print:break-inside-avoid">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <h2 className="text-lg font-bold">{messages["analytics.title"]}</h2>
                <p className="mt-1 text-sm text-muted">
                  {messages["analytics.average"]}: {formatDate(reportData.period.startAt)} – {formatDate(reportData.period.endAt)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 print:hidden">
                <Link
                  className="rounded-lg border border-border px-4 py-2 font-medium"
                  href={`/api/exports/survey_summaries?${new URLSearchParams({
                    organization: context.organization.id,
                    from: startAt as string,
                    to: endAt as string,
                    survey: surveyId ?? "",
                    location: locationId ?? "",
                  })}`}
                >
                  Survey summaries CSV
                </Link>
                <Link
                  className="rounded-lg border border-border px-4 py-2 font-medium"
                  href={`/api/exports/location_summaries?${new URLSearchParams({
                    organization: context.organization.id,
                    from: startAt as string,
                    to: endAt as string,
                    survey: surveyId ?? "",
                    location: locationId ?? "",
                  })}`}
                >
                  Location summaries CSV
                </Link>
                <PrintButton labelEn="Print / Save as PDF" />
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
                    reportData.prevKpi?.prev_satisfaction_pct != null && reportData.kpi.satisfaction_pct != null
                      ? `${isArabic ? "السابقة" : "Previous"}: ${reportData.prevKpi.prev_satisfaction_pct}% (${reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct >= 0 ? "+" : ""}${(reportData.kpi.satisfaction_pct - reportData.prevKpi.prev_satisfaction_pct).toFixed(2)}%)`
                      : undefined
                  }
                />
                <MetricCard
                  label={isArabic ? "نسبة التعليقات السلبية" : "Negative feedback %"}
                  value={reportData.kpi.negative_feedback_pct != null ? `${reportData.kpi.negative_feedback_pct}%` : "—"}
                  detail={
                    reportData.prevKpi?.prev_negative_feedback_pct != null && reportData.kpi.negative_feedback_pct != null
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

            {/* Alert Severity Breakdown */}
            {reportData.alertSeverityBreakdown && reportData.alertSeverityBreakdown.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "تفصيل شدة التنبيهات" : "Alert severity breakdown"}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 print:grid-cols-4">
                  {reportData.alertSeverityBreakdown.map((item, idx) => (
                    <MetricCard
                      key={idx}
                      label={isArabic ? item.severity : item.severity.charAt(0).toUpperCase() + item.severity.slice(1)}
                      value={item.count.toString()}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Trigger Breakdown */}
            {reportData.triggerBreakdown && reportData.triggerBreakdown.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "تفصيل محفزات التنبيه" : "Alert trigger breakdown"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "نوع القاعدة" : "Rule type"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.triggerBreakdown.map((item, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3 font-medium">{item.rule_type.replace(/_/g, " ")}</td>
                          <td className="p-3 text-right">{item.count}</td>
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

            {/* Management Decisions */}
            {reportData.managementDecisions && reportData.managementDecisions.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "قرارات الإدارة" : "Management decisions"}</h3>
                <div className="space-y-4">
                  {reportData.managementDecisions.map((decision, idx) => (
                    <div key={idx} className="rounded-lg border border-border p-4 print:break-inside-avoid">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
                        <h4 className="font-semibold">{isArabic ? decision.title : decision.title}</h4>
                        <span className="text-xs text-muted">{formatTimestamp(decision.investigated_at)}</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2 text-sm">
                        <p><span className="font-medium text-muted">{isArabic ? "الفرع" : "Branch"}:</span> {isArabic ? decision.branch_name_ar : decision.branch_name_en}</p>
                        {decision.department_id && (
                          <p><span className="font-medium text-muted">{isArabic ? "القسم" : "Department"}:</span> {isArabic ? decision.department_name_ar : decision.department_name_en}</p>
                        )}
                        <p><span className="font-medium text-muted">{isArabic ? "قرار التصعيد" : "Escalation decision"}:</span> {decision.escalation_decision}</p>
                        <p><span className="font-medium text-muted">{isArabic ? "الحالة" : "Status"}:</span> {decision.status}</p>
                      </div>
                      {decision.findings && (
                        <p className="mt-2 text-sm"><span className="font-medium text-muted">{isArabic ? "النتائج" : "Findings"}:</span> {decision.findings}</p>
                      )}
                      {decision.root_cause && (
                        <p className="mt-1 text-sm"><span className="font-medium text-muted">{isArabic ? "السبب الجذري" : "Root cause"}:</span> {decision.root_cause}</p>
                      )}
                      {decision.recommendation && (
                        <p className="mt-1 text-sm"><span className="font-medium text-muted">{isArabic ? "التوصية" : "Recommendation"}:</span> {decision.recommendation}</p>
                      )}
                      {decision.controlled_record_references?.length && (
                        <p className="mt-1 text-sm"><span className="font-medium text-muted">{isArabic ? "المراجع المدارة" : "Controlled record refs"}:</span> {decision.controlled_record_references.join(", ")}</p>
                      )}
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Follow-up Records */}
            {reportData.followupRecords && reportData.followupRecords.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "سجلات المتابعة" : "Follow-up records"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "التاريخ" : "Date"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الاستبيان" : "Survey"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الفرع" : "Location"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "القسم" : "Department"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الحالة الجديدة" : "New status"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "تفاصيل المتابعة" : "Follow-up details"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "ملخص النتيجة" : "Outcome summary"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.followupRecords.map((record, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3">{formatDate(record.recorded_at)}</td>
                          <td className="p-3">{isArabic ? record.survey_title_ar : record.survey_title_en}</td>
                          <td className="p-3">{isArabic ? record.location_name_ar : record.location_name_en}</td>
                          <td className="p-3">{isArabic ? (record.department_name_ar ?? "—") : (record.department_name_en ?? "—")}</td>
                          <td className="p-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                              {record.new_status}
                            </span>
                          </td>
                          <td className="p-3 max-w-xs truncate">{record.follow_up_details}</td>
                          <td className="p-3 max-w-xs truncate">{record.outcome_summary}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Corrective Actions Summary */}
            {reportData.correctiveActions && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "ملخص الإجراءات التصحيحية" : "Corrective actions summary"}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 print:grid-cols-4">
                  <MetricCard
                    label={isArabic ? "الإجمالي" : "Total"}
                    value={reportData.correctiveActions.total.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مفتوح" : "Open"}
                    value={reportData.correctiveActions.open.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "قيد التنفيذ" : "In progress"}
                    value={reportData.correctiveActions.in_progress.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "معلق التحقق" : "Pending verification"}
                    value={reportData.correctiveActions.pending_verification.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "تم التحقق" : "Verified"}
                    value={reportData.correctiveActions.verified.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مغلق" : "Closed"}
                    value={reportData.correctiveActions.closed.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مرفوض" : "Rejected"}
                    value={reportData.correctiveActions.rejected.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "متأخر" : "Overdue"}
                    value={reportData.correctiveActions.overdue.toString()}
                  />
                </div>

                {/* Priority Breakdown */}
                {reportData.correctiveActions.by_priority?.length > 0 && (
                  <div className="mb-6 print:break-inside-avoid">
                    <h4 className="text-sm font-medium mb-3">{isArabic ? "تفصيل الأولوية" : "Priority breakdown"}</h4>
                    <div className="grid gap-3 sm:grid-cols-4 print:grid-cols-4">
                      {reportData.correctiveActions.by_priority.map((item, idx) => (
                        <MetricCard
                          key={idx}
                          label={isArabic ? item.priority : item.priority.charAt(0).toUpperCase() + item.priority.slice(1)}
                          value={item.count.toString()}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Status Breakdown */}
                {reportData.correctiveActions.by_status?.length > 0 && (
                  <div className="print:break-inside-avoid">
                    <h4 className="text-sm font-medium mb-3">{isArabic ? "تفصيل الحالة" : "Status breakdown"}</h4>
                    <div className="grid gap-3 sm:grid-cols-4 print:grid-cols-4">
                      {reportData.correctiveActions.by_status.map((item, idx) => (
                        <MetricCard
                          key={idx}
                          label={isArabic ? item.status : item.status.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}
                          value={item.count.toString()}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Verification Status */}
            {reportData.correctiveActionVerification && reportData.correctiveActionVerification.total > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "حالة التحقق" : "Verification status"}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-4 print:grid-cols-5">
                  <MetricCard
                    label={isArabic ? "الإجمالي" : "Total"}
                    value={reportData.correctiveActionVerification.total.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "معلق" : "Pending"}
                    value={reportData.correctiveActionVerification.pending.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مقبول" : "Accepted"}
                    value={reportData.correctiveActionVerification.accepted.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مرفوض" : "Rejected"}
                    value={reportData.correctiveActionVerification.rejected.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "مطلوب أدلة إضافية" : "More evidence required"}
                    value={reportData.correctiveActionVerification.more_evidence_required.toString()}
                  />
                </div>
                {reportData.correctiveActionVerification.by_status?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الحالة" : "Status"}</th>
                          <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.correctiveActionVerification.by_status.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="p-3">{isArabic ? item.status : item.status.replace(/_/g, " ")}</td>
                            <td className="p-3 text-right">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Effectiveness Status */}
            {reportData.correctiveActionEffectiveness && reportData.correctiveActionEffectiveness.total_reviewed > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "حالة الفعالية" : "Effectiveness status"}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-4 print:grid-cols-4">
                  <MetricCard
                    label={isArabic ? "مُراجع إجمالي" : "Total reviewed"}
                    value={reportData.correctiveActionEffectiveness.total_reviewed.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "فعال" : "Effective"}
                    value={reportData.correctiveActionEffectiveness.effective.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "فعال جزئياً" : "Partially effective"}
                    value={reportData.correctiveActionEffectiveness.partially_effective.toString()}
                  />
                  <MetricCard
                    label={isArabic ? "غير فعال" : "Not effective"}
                    value={reportData.correctiveActionEffectiveness.not_effective.toString()}
                  />
                </div>
                {reportData.correctiveActionEffectiveness.by_result?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-semibold text-muted">{isArabic ? "النتيجة" : "Result"}</th>
                          <th className="text-right p-3 font-semibold text-muted">{isArabic ? "العدد" : "Count"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.correctiveActionEffectiveness.by_result.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/50 last:border-0">
                            <td className="p-3">{isArabic ? item.result.replace(/_/g, " ") : item.result.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
                            <td className="p-3 text-right">{item.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Controlled Record References */}
            {reportData.controlledRecordRefs && reportData.controlledRecordRefs.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "مراجع السجلات المُدارة" : "Controlled record references"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "التاريخ" : "Date"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الاستبيان" : "Survey"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الفرع" : "Location"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "النوع" : "Type"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "المرجع" : "Reference"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الحالة" : "Status"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "ملخص النتيجة" : "Outcome summary"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.controlledRecordRefs.map((ref, idx) => (
                        <tr key={idx} className="border-b border-border/50 last:border-0">
                          <td className="p-3">{ref.recorded_at ? formatDate(ref.recorded_at) : "—"}</td>
                          <td className="p-3">{isArabic ? ref.survey_title_ar : ref.survey_title_en}</td>
                          <td className="p-3">{isArabic ? ref.location_name_ar : ref.location_name_en}</td>
                          <td className="p-3">{ref.controlled_record_type ?? "—"}</td>
                          <td className="p-3 font-mono">{ref.controlled_record_reference ?? "—"}</td>
                          <td className="p-3">{ref.controlled_record_status ?? "—"}</td>
                          <td className="p-3 max-w-xs truncate">{ref.outcome_summary ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Target Status */}
            {reportData.targetStatus && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "حالة الأهداف" : "Target status"}</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6 print:grid-cols-4">
                  <MetricCard
                    label={isArabic ? "نسبة الرضا" : "Satisfaction %"}
                    value={reportData.targetStatus.satisfaction_pct != null ? `${reportData.targetStatus.satisfaction_pct}%` : "—"}
                  />
                  <MetricCard
                    label={isArabic ? "نسبة التعليقات السلبية" : "Negative feedback %"}
                    value={reportData.targetStatus.negative_feedback_pct != null ? `${reportData.targetStatus.negative_feedback_pct}%` : "—"}
                  />
                  <MetricCard
                    label={isArabic ? "إجمالي الردود" : "Response count"}
                    value={reportData.targetStatus.response_count.toLocaleString()}
                  />
                  <MetricCard
                    label={isArabic ? "متوسط التقييم" : "Average rating"}
                    value={reportData.targetStatus.average_rating != null ? reportData.targetStatus.average_rating.toFixed(1) : "—"}
                  />
                </div>
                {reportData.targetStatus.target_status?.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm" role="table">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left p-3 font-semibold text-muted">{isArabic ? "المؤشر" : "Metric"}</th>
                          <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الحالة" : "Status"}</th>
                          <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الحالي" : "Current"}</th>
                          <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الهدف" : "Target"}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {reportData.targetStatus.target_status.map((item, idx) => {
                          const statusColor = item.status === "pass" ? "bg-green-100 text-green-800" :
                            item.status === "warning" ? "bg-yellow-100 text-yellow-800" :
                            item.status === "fail" ? "bg-red-100 text-red-800" : "bg-gray-100 text-gray-800";
                          return (
                            <tr key={idx} className="border-b border-border/50 last:border-0">
                              <td className="p-3 font-medium">{item.metric.replace(/_/g, " ")}</td>
                              <td className="p-3">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor}`}>
                                  {item.status}
                                </span>
                              </td>
                              <td className="p-3 text-right">
                                {item.metric === "satisfaction_pct" && item.current_satisfaction_pct != null
                                  ? `${item.current_satisfaction_pct}%`
                                  : item.metric === "negative_feedback_pct" && item.current_negative_feedback_pct != null
                                  ? `${item.current_negative_feedback_pct}%`
                                  : item.current_avg_rating != null
                                  ? item.current_avg_rating.toFixed(1)
                                  : "—"}
                              </td>
                              <td className="p-3 text-right">
                                {item.metric === "satisfaction_pct" ? `≥ ${item.satisfied_min}%` : `≤ ${item.negative_max}%`}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            )}

            {/* Branch Ranking */}
            {reportData.branchRanking && reportData.branchRanking.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "ترتيب الفروع" : "Branch ranking"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">#</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الفرع" : "Branch"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الردود" : "Responses"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "متوسط التقييم" : "Avg rating"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة الرضا" : "Satisfaction %"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة السلبي" : "Negative %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.branchRanking.map((branch, idx) => (
                        <tr key={branch.id} className="border-b border-border/50 last:border-0">
                          <td className="p-3 font-medium">{idx + 1}</td>
                          <td className="p-3 font-medium">{isArabic ? branch.name_ar : branch.name_en}</td>
                          <td className="p-3 text-right">{branch.response_count.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium">{branch.average_rating?.toFixed(1) ?? "—"}</td>
                          <td className="p-3 text-right">{branch.satisfaction_pct != null ? `${branch.satisfaction_pct}%` : "—"}</td>
                          <td className="p-3 text-right">{branch.negative_feedback_pct != null ? `${branch.negative_feedback_pct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Department Ranking */}
            {reportData.departmentRanking && reportData.departmentRanking.length > 0 && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "ترتيب الأقسام" : "Department ranking"}</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" role="table">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left p-3 font-semibold text-muted">#</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "القسم" : "Department"}</th>
                        <th className="text-left p-3 font-semibold text-muted">{isArabic ? "الفرع" : "Branch"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "الردود" : "Responses"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "متوسط التقييم" : "Avg rating"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة الرضا" : "Satisfaction %"}</th>
                        <th className="text-right p-3 font-semibold text-muted">{isArabic ? "نسبة السلبي" : "Negative %"}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.departmentRanking.map((dept, idx) => (
                        <tr key={dept.id} className="border-b border-border/50 last:border-0">
                          <td className="p-3 font-medium">{idx + 1}</td>
                          <td className="p-3 font-medium">{isArabic ? dept.name_ar : dept.name_en}</td>
                          <td className="p-3">{isArabic ? dept.location_name_ar : dept.location_name_en}</td>
                          <td className="p-3 text-right">{dept.response_count.toLocaleString()}</td>
                          <td className="p-3 text-right font-medium">{dept.average_rating?.toFixed(1) ?? "—"}</td>
                          <td className="p-3 text-right">{dept.satisfaction_pct != null ? `${dept.satisfaction_pct}%` : "—"}</td>
                          <td className="p-3 text-right">{dept.negative_feedback_pct != null ? `${dept.negative_feedback_pct}%` : "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Trend Charts */}
            {reportData.trendCharts && (
              <section className="mb-8 print:break-inside-avoid">
                <h3 className="text-lg font-semibold mb-4">{isArabic ? "رسوم الاتجاهات" : "Trend charts"}</h3>
                <div className="grid gap-6 sm:grid-cols-2">
                  {/* Response Trend Chart */}
                  {reportData.trendCharts.response_trend && reportData.trendCharts.response_trend.length > 0 && (
                    <AccessibleBarChart
                      title={isArabic ? "اتجاه الردود الأسبوعي" : "Weekly response trend"}
                      items={reportData.trendCharts.response_trend.map((item) => ({
                        label: item.period,
                        value: item.count,
                      }))}
                    />
                  )}

                  {/* Concern Trend Chart - top concern per period */}
                  {reportData.trendCharts.concern_trend && reportData.trendCharts.concern_trend.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-3">{isArabic ? "اتجاه أهم المواضيع" : "Top concern trend"}</h4>
                      {/* Group by period and show top concern for each */}
                      {(() => {
                        const byPeriod = new Map<string, Array<{ concern_name_en: string; concern_name_ar: string; count: number }>>();
                        reportData.trendCharts!.concern_trend.forEach((item) => {
                          if (!byPeriod.has(item.period)) byPeriod.set(item.period, []);
                          byPeriod.get(item.period)!.push({
                            concern_name_en: item.concern_name_en,
                            concern_name_ar: item.concern_name_ar,
                            count: item.count,
                          });
                        });
                        // Sort each period by count desc and take top 1
                        const topPerPeriod = Array.from(byPeriod.entries())
                          .sort((a, b) => a[0].localeCompare(b[0]))
                          .map(([period, concerns]) => {
                            const top = concerns.sort((a, b) => b.count - a.count)[0];
                            return {
                              label: period,
                              value: top.count,
                              detail: `${isArabic ? top.concern_name_ar : top.concern_name_en} (${top.count})`,
                            };
                          });
                        return topPerPeriod.length > 0 ? (
                          <AccessibleBarChart
                            title={isArabic ? "أهم موضوع لكل فترة" : "Top concern per period"}
                            items={topPerPeriod}
                          />
                        ) : null;
                      })()}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Previous Period Comparison */}
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
              <p>Generated on {new Date().toLocaleDateString(localeObj, { dateStyle: "full" })}</p>
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