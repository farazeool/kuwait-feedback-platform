"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type EmailSignatureTab = "templates" | "assignments" | "reports" | "setup";

interface EmailSignatureTabsProps {
  initialTab: EmailSignatureTab;
  templateCount: number;
  assignmentCount: number;
  templates: ReactNode;
  assignments: ReactNode;
  reports: ReactNode;
  setup: ReactNode;
}

const TABS: Array<{ id: EmailSignatureTab; label: string }> = [
  { id: "templates", label: "Templates" },
  { id: "assignments", label: "Assignments" },
  { id: "reports", label: "Reports" },
  { id: "setup", label: "Installation guide" },
];

function isTab(value: string | null): value is EmailSignatureTab {
  return TABS.some((tab) => tab.id === value);
}

export function EmailSignatureTabs({
  initialTab,
  templateCount,
  assignmentCount,
  templates,
  assignments,
  reports,
  setup,
}: EmailSignatureTabsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<EmailSignatureTab>(initialTab);
  const [isPending, startTransition] = useTransition();

  // Keep browser Back/Forward and externally-triggered URL changes in sync with
  // the instant local tab state. The optimistic state above prevents a click
  // from waiting for the RSC response before the selected tab changes.
  useEffect(() => {
    const urlTab = searchParams.get("tab");
    const nextTab = isTab(urlTab) ? urlTab : "templates";
    if (nextTab !== activeTab && !isPending) {
      const handle = window.setTimeout(() => setActiveTab(nextTab), 0);
      return () => window.clearTimeout(handle);
    }
    // activeTab/isPending are intentionally read as the optimistic guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const selectTab = (tab: EmailSignatureTab) => {
    if (tab === activeTab && !isPending) return;
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    if (tab === "templates") params.delete("tab");
    else params.set("tab", tab);
    if (tab !== "reports") {
      ["templateId", "preset", "from", "to", "subjectType", "locationId"].forEach((key) => params.delete(key));
    }
    const nextUrl = `${pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    if (tab === "reports" || activeTab === "reports") {
      startTransition(() => router.push(nextUrl, { scroll: false }));
    } else {
      // The non-report panels are already in this RSC payload. Update the URL
      // without requesting a new server render, so switching between them is
      // instant and does not repeat Supabase reads.
      window.history.pushState(null, "", nextUrl);
    }
  };

  const content = [
    { id: "templates" as const, node: templates },
    { id: "assignments" as const, node: assignments },
    { id: "reports" as const, node: reports },
    { id: "setup" as const, node: setup },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-1 rounded-xl bg-surface-muted p-1" role="tablist" aria-label="Email signature sections" aria-busy={isPending}>
        {TABS.map(({ id, label }) => {
          const selected = activeTab === id;
          const count = id === "templates" ? templateCount : id === "assignments" ? assignmentCount : null;
          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`email-signature-tab-${id}`}
              aria-controls={`email-signature-panel-${id}`}
              tabIndex={selected ? 0 : -1}
              onClick={() => selectTab(id)}
              onMouseEnter={id === "reports" ? () => router.prefetch(`${pathname}?tab=reports`) : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${selected ? "bg-white text-foreground shadow-sm" : "text-muted hover:text-foreground"}`}
            >
              {label}{count !== null ? ` (${count})` : ""}
              {isPending && selected ? <span className="sr-only">Loading</span> : null}
            </button>
          );
        })}
      </div>

      {content.map(({ id, node }) => (
        <section
          key={id}
          id={`email-signature-panel-${id}`}
          role="tabpanel"
          aria-labelledby={`email-signature-tab-${id}`}
          hidden={activeTab !== id}
          aria-busy={isPending && activeTab === id}
        >
          {isPending && activeTab === id && id === "reports" ? <TabSkeleton /> : node}
        </section>
      ))}
    </>
  );
}

function TabSkeleton() {
  return (
    <div className="grid gap-4" role="status" aria-label="Loading email signature section">
      <div className="h-24 animate-pulse rounded-xl border border-border bg-surface-muted" />
      <div className="h-48 animate-pulse rounded-xl border border-border bg-surface-muted" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}