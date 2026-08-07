import Link from "next/link";

import { buildPilotChecklist } from "@/features/pilot/checklist";
import { listSurveyGroups } from "@/features/surveys/server";

/**
 * State-derived pilot setup checklist. Reads real counts (locations,
 * surveys, responses) so it never drifts from reality and needs no
 * persisted flag. Renders only for organization managers who can act on
 * the steps, and hides itself once every step is complete.
 */
export async function PilotChecklist() {
  const { context, rows } = await listSurveyGroups({});
  if (!context.organization) return null;

  const role = context.profile.platformRole ?? context.membership?.role;
  const canManage =
    role === "platform_admin" || role === "organization_owner" || role === "organization_admin";
  if (!canManage) return null;

  const checklist = buildPilotChecklist({
    locationCount: context.locations.length,
    surveyCount: rows.length,
    activeSurveyCount: rows.filter((row) => row.status === "active").length,
    responseCount: rows.reduce((total, row) => total + row.responseCount, 0),
  });
  if (checklist.allComplete) return null;

  return (
    <section className="rounded-xl border border-border bg-white p-5" aria-labelledby="pilot-checklist-title">
      <header className="grid gap-0.5">
        <p className="text-xs font-semibold uppercase tracking-wide text-brand">Pilot setup · إعداد التجربة</p>
        <h2 id="pilot-checklist-title" className="text-lg font-bold tracking-tight text-foreground">Finish setting up</h2>
        <p dir="rtl" className="text-sm font-medium text-muted">أكمل إعداد منصتك</p>
        <p className="text-xs text-muted">
          {checklist.completedCount} of {checklist.totalCount} complete · {checklist.completedCount} من {checklist.totalCount} مكتمل
        </p>
      </header>
      <ol className="mt-4 grid gap-2">
        {checklist.steps.map((step, index) => (
          <li key={step.id}>
            <Link href={step.href} className="flex items-start gap-3 rounded-lg border border-border p-3 transition-colors hover:border-brand">
              <span
                aria-hidden="true"
                className={
                  step.completed
                    ? "grid h-7 w-7 flex-none place-items-center rounded-full bg-brand text-xs text-white"
                    : "grid h-7 w-7 flex-none place-items-center rounded-full border border-border text-xs font-semibold text-muted"
                }
              >
                {step.completed ? "✓" : index + 1}
              </span>
              <div className="grid gap-0.5">
                <span className="sr-only">{step.completed ? "Completed: " : `Step ${index + 1}: `}</span>
                <p className="text-sm font-semibold text-foreground">{step.labelEn}</p>
                <p dir="rtl" className="text-xs font-medium text-muted">{step.labelAr}</p>
                <p className="text-xs text-muted">{step.hintEn}</p>
                <p dir="rtl" className="text-xs text-muted">{step.hintAr}</p>
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
