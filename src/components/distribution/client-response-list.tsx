"use client";

import { useState } from "react";

import { AssignmentResponseList } from "./assignment-response-list";

/**
 * Minimal, already-resolved projection of a distribution assignment. The server
 * builds these from `resolveSubjectLabel` so the client bundle never carries the
 * full assignment record (which has an open `[key: string]: any` index signature
 * and internal FKs the browser has no business seeing).
 */
export interface AssignmentOption {
  /** Opaque assignment UUID — the only identifier sent back to the API. */
  id: string;
  /** Human-readable subject (employee display name, location, etc.). */
  subjectLabel: string;
}

interface ClientResponseListProps {
  assignments: AssignmentOption[];
  /** Optional locale for timestamp formatting inside the response table. */
  locale?: string;
}

export function ClientResponseList({ assignments, locale = "en" }: ClientResponseListProps) {
  const [selectedId, setSelectedId] = useState<string>(assignments[0]?.id ?? "");

  if (assignments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-surface p-12 text-center text-sm text-muted">
        No active assignments found
      </div>
    );
  }

  // Fall back to the first option if the selection ever drifts out of range
  // (e.g. the selected assignment was revoked between renders).
  const selected =
    assignments.find((assignment) => assignment.id === selectedId) ?? assignments[0];

  return (
    <div className="grid gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">Individual responses</h2>
          <p className="text-xs text-muted">
            Drill into detailed feedback for a specific employee or location.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <label htmlFor="assignment-select" className="text-xs font-medium text-muted">
            Subject
          </label>
          <select
            id="assignment-select"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {assignments.map((assignment) => (
              <option key={assignment.id} value={assignment.id}>
                {assignment.subjectLabel}
              </option>
            ))}
          </select>
        </div>
      </div>

      <AssignmentResponseList
        key={selected.id}
        assignmentId={selected.id}
        subjectLabel={selected.subjectLabel}
        locale={locale}
      />
    </div>
  );
}
