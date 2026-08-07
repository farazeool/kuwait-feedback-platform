"use client";

import { useState } from "react";

import { ResponseDetailDrawer } from "./response-detail-drawer";

interface AssignmentResponsesTriggerProps {
  assignmentId: string;
  subjectLabel: string;
  responseCount: number;
  /** Locale used for timestamp formatting inside the drawer. */
  locale?: string;
}

/**
 * Renders a "View responses" button + lazily-mounted response drawer for a
 * single assignment. Encapsulates the open/close state so the parent server
 * component does not need to become a client component.
 */
export function AssignmentResponsesTrigger({
  assignmentId,
  subjectLabel,
  responseCount,
  locale,
}: AssignmentResponsesTriggerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-border bg-white px-3 py-1.5 text-xs font-medium text-foreground hover:border-brand hover:text-brand focus:outline-none focus:ring-2 focus:ring-brand"
        aria-haspopup="dialog"
        data-testid="view-responses-button"
      >
        View responses
        <span className="ml-1 rounded-full bg-surface-muted px-1.5 text-[10px] font-semibold text-muted">
          {responseCount}
        </span>
      </button>

      <ResponseDetailDrawer
        assignmentId={assignmentId}
        subjectLabel={subjectLabel}
        open={open}
        onClose={() => setOpen(false)}
        {...(locale ? { locale } : {})}
      />
    </>
  );
}