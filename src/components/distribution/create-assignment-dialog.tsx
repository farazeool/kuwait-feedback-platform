"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createAssignment } from "@/features/distribution/actions";
import {
  decideAssignmentSubmission,
  resolveAssignmentOutcome,
  ASSIGNMENT_MESSAGES,
} from "@/features/distribution/assignment-result";

interface CreateAssignmentDialogProps {
  employees: Array<{ id: string; user_id: string; display_name: string; email: string }>;
  templates: Array<{ id: string; template_name: string; is_active: boolean }>;
  onClose: () => void;
}

export function CreateAssignmentDialog({ employees, templates, onClose }: CreateAssignmentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState("");
  const [error, setError] = useState("");

  const activeTemplates = templates.filter((t) => t.is_active);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Every gate — required fields and the in-flight guard that prevents a
    // double submission — lives in the pure module.
    const decision = decideAssignmentSubmission({
      employeeId: selectedEmployee,
      templateId: selectedTemplate,
      isPending,
    });
    if (decision.action === "reject") {
      setError(decision.message);
      return;
    }

    const formData = new FormData();
    formData.append("assignment", JSON.stringify(decision.payload));

    startTransition(async () => {
      // The action now returns a structured result instead of redirecting, so a
      // thrown error here is genuinely unexpected and maps to the generic
      // message rather than closing the dialog.
      let result: unknown;
      try {
        result = await createAssignment(formData);
      } catch {
        setError(ASSIGNMENT_MESSAGES.unknown);
        return;
      }

      const outcome = resolveAssignmentOutcome(result);
      if (!outcome.closeDialog) {
        setError(outcome.message);
        return;
      }
      if (outcome.refreshList) router.refresh();
      onClose();
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-lg rounded-xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h2 className="text-xl font-bold text-foreground">Create Assignment</h2>
            <p className="mt-1 text-sm text-muted">Assign a signature template to an employee</p>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg p-1 text-muted hover:bg-surface-muted disabled:opacity-50"
            aria-label="Close"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="employee" className="block text-sm font-medium text-foreground">
              Employee <span className="text-red-500">*</span>
            </label>
            <select
              id="employee"
              value={selectedEmployee}
              onChange={(e) => setSelectedEmployee(e.target.value)}
              disabled={isPending}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
            >
              <option value="">Select an employee...</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.user_id}>
                  {emp.display_name} ({emp.email})
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {employees.length} employee{employees.length === 1 ? "" : "s"} available
            </p>
          </div>

          <div>
            <label htmlFor="template" className="block text-sm font-medium text-foreground">
              Signature Template <span className="text-red-500">*</span>
            </label>
            <select
              id="template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              disabled={isPending}
              required
              className="mt-1.5 w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground shadow-sm focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand disabled:opacity-50"
            >
              <option value="">Select a template...</option>
              {activeTemplates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.template_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-muted">
              {activeTemplates.length} active template{activeTemplates.length === 1 ? "" : "s"} available
              {templates.length > activeTemplates.length && ` (${templates.length - activeTemplates.length} inactive)`}
            </p>
          </div>

          {activeTemplates.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No active templates available. Create an active template first.
            </div>
          )}

          {employees.length === 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              No employees found in your organization. Invite team members first.
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-border pt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending || activeTemplates.length === 0 || employees.length === 0}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand/90 disabled:opacity-50"
            >
              {isPending ? "Creating..." : "Create assignment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
