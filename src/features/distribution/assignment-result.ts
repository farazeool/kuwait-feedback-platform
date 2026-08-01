/**
 * Pure decision logic for the "Create Assignment" flow.
 *
 * The React dialog stays a thin wrapper: it owns form state and rendering,
 * while every branch that decides *what should happen* lives here so it can be
 * unit tested under the plain Node Vitest environment (no jsdom, no RTL).
 */

/** Safe, structured result returned by the `createAssignment` server action. */
export type CreateAssignmentResult =
  | { ok: true; assignmentId: string }
  | {
      ok: false;
      error: "denied" | "invalid" | "duplicate" | "creation_failed";
    };

/** Shape submitted to the server action for an employee/template assignment. */
export interface EmployeeAssignmentDraft {
  kind: "fk";
  targetType: "employee";
  targetId: string;
  templateId: string;
  surveyId: null;
  metadata: Record<string, never>;
}

/** Outcome of asking "should this submission be sent to the server?" */
export type AssignmentSubmissionDecision =
  | { action: "submit"; payload: EmployeeAssignmentDraft }
  | { action: "reject"; message: string };

/** Outcome of interpreting whatever the server action returned. */
export interface AssignmentOutcome {
  closeDialog: boolean;
  refreshList: boolean;
  /** Safe, user-facing message. Empty string on success. */
  message: string;
}

export const ASSIGNMENT_MESSAGES = {
  missingEmployee: "Please select an employee",
  missingTemplate: "Please select a template",
  alreadySubmitting: "This assignment is already being created",
  denied: "You do not have permission to create assignments for this organization.",
  invalid: "Select a valid employee and an active template from this organization, then try again.",
  duplicate: "This employee already has an active assignment for this template.",
  creationFailed: "The assignment could not be created. Please try again.",
  unknown: "Something went wrong. Please try again.",
} as const;

/**
 * Decides whether a submission attempt should reach the server.
 *
 * Guards both required selections and the pending state, so a second submit
 * while a request is in flight is rejected instead of creating a duplicate.
 */
export function decideAssignmentSubmission(input: {
  employeeId: string;
  templateId: string;
  isPending: boolean;
}): AssignmentSubmissionDecision {
  if (input.isPending) {
    return { action: "reject", message: ASSIGNMENT_MESSAGES.alreadySubmitting };
  }
  if (!input.employeeId) {
    return { action: "reject", message: ASSIGNMENT_MESSAGES.missingEmployee };
  }
  if (!input.templateId) {
    return { action: "reject", message: ASSIGNMENT_MESSAGES.missingTemplate };
  }

  return {
    action: "submit",
    payload: {
      kind: "fk",
      targetType: "employee",
      targetId: input.employeeId,
      templateId: input.templateId,
      surveyId: null,
      metadata: {},
    },
  };
}

const FAILURE_MESSAGES: Record<
  Extract<CreateAssignmentResult, { ok: false }>["error"],
  string
> = {
  denied: ASSIGNMENT_MESSAGES.denied,
  invalid: ASSIGNMENT_MESSAGES.invalid,
  duplicate: ASSIGNMENT_MESSAGES.duplicate,
  creation_failed: ASSIGNMENT_MESSAGES.creationFailed,
};

const STAY_OPEN = { closeDialog: false, refreshList: false } as const;

/**
 * Maps a server action result to what the dialog should do next.
 *
 * Anything that is not a recognised structured result (a thrown error, a
 * network failure, an unexpected payload) collapses to the generic safe
 * message and keeps the dialog open — never a silent close.
 */
export function resolveAssignmentOutcome(result: unknown): AssignmentOutcome {
  if (!result || typeof result !== "object") {
    return { ...STAY_OPEN, message: ASSIGNMENT_MESSAGES.unknown };
  }

  const candidate = result as Partial<Extract<CreateAssignmentResult, { ok: true }>> &
    Partial<Extract<CreateAssignmentResult, { ok: false }>>;

  if (candidate.ok === true) {
    if (typeof candidate.assignmentId !== "string" || candidate.assignmentId.length === 0) {
      return { ...STAY_OPEN, message: ASSIGNMENT_MESSAGES.unknown };
    }
    return { closeDialog: true, refreshList: true, message: "" };
  }

  if (candidate.ok === false && typeof candidate.error === "string") {
    const message = FAILURE_MESSAGES[candidate.error as keyof typeof FAILURE_MESSAGES];
    return { ...STAY_OPEN, message: message ?? ASSIGNMENT_MESSAGES.unknown };
  }

  return { ...STAY_OPEN, message: ASSIGNMENT_MESSAGES.unknown };
}
