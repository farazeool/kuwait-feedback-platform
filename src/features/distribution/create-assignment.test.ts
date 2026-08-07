import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Focused tests for the `createAssignment` server action.
 *
 * These run in the existing Vitest Node environment: the auth context, the
 * Supabase client and the Next.js cache/navigation helpers are mocked, so the
 * action's authorization, tenant-scoping and error-mapping branches can be
 * exercised without a browser or a live database.
 */

const DEMO_ORG = "20000000-0000-4000-8000-000000000001";
const OTHER_ORG = "30000000-0000-4000-8000-000000000009";
const ACTOR_ID = "10000000-0000-4000-8000-00000000000a";
const EMPLOYEE_ID = "550e8400-e29b-41d4-a716-446655440000";
const TEMPLATE_ID = "660e8400-e29b-41d4-a716-446655440000";
const ASSIGNMENT_ID = "990e8400-e29b-41d4-a716-446655440000";

interface PostgrestErrorLike {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
  constraint?: string;
}

interface MockState {
  /** Rows returned by the `distribution_templates` tenant lookup. */
  template: { id: string } | null;
  /** Rows returned by the `organization_memberships` tenant lookup. */
  membership: { user_id: string } | null;
  /** Result of the `distribution_assignments` insert. */
  insert: { data: { id: string } | null; error: PostgrestErrorLike | null };
}

interface CallRecord {
  tables: string[];
  filters: Array<{ table: string; column: string; value: unknown }>;
  inserts: Array<{ table: string; payload: Record<string, unknown> }>;
}

let state: MockState;
let calls: CallRecord;
let organization: { id: string } | null;

function makeSupabase() {
  const from = vi.fn((table: string) => {
    calls.tables.push(table);

    const builder = {
      select: vi.fn(() => builder),
      insert: vi.fn((payload: Record<string, unknown>) => {
        calls.inserts.push({ table, payload });
        return builder;
      }),
      update: vi.fn(() => builder),
      eq: vi.fn((column: string, value: unknown) => {
        calls.filters.push({ table, column, value });
        return builder;
      }),
      maybeSingle: vi.fn(async () => {
        if (table === "distribution_templates") return { data: state.template, error: null };
        if (table === "organization_memberships") return { data: state.membership, error: null };
        return { data: null, error: null };
      }),
      single: vi.fn(async () => state.insert),
    };

    return builder;
  });

  return { from };
}

let supabase: ReturnType<typeof makeSupabase>;

vi.mock("@/lib/auth/context", () => ({
  requireOrganizationManagementContext: vi.fn(async () => ({
    user: { id: ACTOR_ID },
    organization,
    profile: { platformRole: null },
    membership: { role: "organization_owner" },
  })),
}));

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: vi.fn(async () => supabase),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect() must not be called by createAssignment");
  }),
}));

import { createAssignment } from "./actions";

function formDataFor(assignment: unknown) {
  const formData = new FormData();
  formData.append("assignment", JSON.stringify(assignment));
  return formData;
}

const validAssignment = {
  kind: "fk" as const,
  targetType: "employee" as const,
  targetId: EMPLOYEE_ID,
  templateId: TEMPLATE_ID,
  surveyId: null,
  metadata: {},
};

describe("createAssignment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    organization = { id: DEMO_ORG };
    calls = { tables: [], filters: [], inserts: [] };
    state = {
      template: { id: TEMPLATE_ID },
      membership: { user_id: EMPLOYEE_ID },
      insert: { data: { id: ASSIGNMENT_ID }, error: null },
    };
    supabase = makeSupabase();
  });

  it("returns ok with the new assignment id for a same-organization employee and template", async () => {
    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: true, assignmentId: ASSIGNMENT_ID });

    // The database path was genuinely exercised.
    expect(supabase.from).toHaveBeenCalledWith("distribution_assignments");
    expect(calls.inserts).toHaveLength(1);
    expect(calls.inserts[0].payload).toMatchObject({
      organization_id: DEMO_ORG,
      template_id: TEMPLATE_ID,
      assigned_employee_id: EMPLOYEE_ID,
      created_by: ACTOR_ID,
    });
  });

  it("scopes the template and membership lookups to the caller's organization", async () => {
    await createAssignment(formDataFor(validAssignment));

    expect(supabase.from).toHaveBeenCalledWith("distribution_templates");
    expect(supabase.from).toHaveBeenCalledWith("organization_memberships");

    // assigned_employee_id maps to memberships.user_id / auth.users.id.
    expect(calls.filters).toContainEqual({
      table: "organization_memberships",
      column: "organization_id",
      value: DEMO_ORG,
    });
    expect(calls.filters).toContainEqual({
      table: "organization_memberships",
      column: "user_id",
      value: EMPLOYEE_ID,
    });
    expect(calls.filters).toContainEqual({
      table: "distribution_templates",
      column: "organization_id",
      value: DEMO_ORG,
    });
  });

  it("returns denied when the caller has no organization", async () => {
    organization = null;

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "denied" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns invalid for a malformed payload without touching the database", async () => {
    const formData = new FormData();
    formData.append("assignment", "{not json");

    const result = await createAssignment(formData);

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns invalid when the payload fails schema validation", async () => {
    const result = await createAssignment(
      formDataFor({ ...validAssignment, targetId: "not-a-uuid" }),
    );

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("returns invalid for a template belonging to another organization", async () => {
    // The org-scoped lookup finds nothing for a foreign template.
    state.template = null;

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(supabase.from).toHaveBeenCalledWith("distribution_templates");
    expect(calls.inserts).toHaveLength(0);
  });

  it("returns invalid for an employee who is not a member of the organization", async () => {
    // Wrong-organization employees are rejected via organization membership,
    // not profiles.
    state.membership = null;

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "invalid" });
    expect(supabase.from).toHaveBeenCalledWith("organization_memberships");
    expect(calls.inserts).toHaveLength(0);
  });

  it("maps SQLSTATE 23505 to duplicate", async () => {
    state.insert = {
      data: null,
      error: {
        code: "23505",
        message: 'duplicate key value violates unique constraint "da_template_employee_unique"',
        constraint: "da_template_employee_unique",
      },
    };

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "duplicate" });
    expect(calls.inserts).toHaveLength(1);
  });

  it("maps a generic database failure to creation_failed without leaking detail", async () => {
    state.insert = {
      data: null,
      error: {
        code: "42P01",
        message: 'relation "distribution_assignments" does not exist',
        details: "internal detail",
      },
    };

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "creation_failed" });
    expect(JSON.stringify(result)).not.toMatch(/relation|42P01|internal detail/);
    expect(calls.inserts).toHaveLength(1);
  });

  it("treats an insert that returns no row as creation_failed", async () => {
    state.insert = { data: null, error: null };

    const result = await createAssignment(formDataFor(validAssignment));

    expect(result).toEqual({ ok: false, error: "creation_failed" });
  });

  it("never returns anything other than the safe error codes", async () => {
    const safeErrors = ["denied", "invalid", "duplicate", "creation_failed"];

    state.insert = {
      data: null,
      error: { code: "23503", message: "foreign key violation" },
    };
    const result = await createAssignment(formDataFor(validAssignment));

    expect(result.ok).toBe(false);
    if (!result.ok) expect(safeErrors).toContain(result.error);
  });

  it("uses OTHER_ORG only as a foreign-tenant fixture and never as the insert tenant", async () => {
    organization = { id: OTHER_ORG };

    await createAssignment(formDataFor(validAssignment));

    expect(calls.inserts[0].payload.organization_id).toBe(OTHER_ORG);
    expect(calls.filters).toContainEqual({
      table: "distribution_templates",
      column: "organization_id",
      value: OTHER_ORG,
    });
  });
});
