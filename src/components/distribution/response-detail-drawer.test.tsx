// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

afterEach(cleanup);

import { ResponseDetailDrawer } from "./response-detail-drawer";
import type { ResponseListEnvelope } from "@/features/distribution/responses";

const ASSIGNMENT_ID = "550e8400-e29b-41d4-a716-446655440000";

const readyEnvelope: ResponseListEnvelope = {
  events: [
    {
      id: "event-1",
      assignment_id: ASSIGNMENT_ID,
      organization_id: "org-1",
      rating: 5,
      label: "Very satisfied",
      emoji: "😀",
      created_at: "2026-08-01T12:00:00Z",
      user_agent: "Mozilla/5.0",
      followup: {
        session_id: "session-1",
        current_rating: 5,
        rating_label: "Very satisfied",
        rating_emoji: "😀",
        identity_status: "self_reported",
        follow_up_status: "submitted",
        contact_status: "new",
        contact_requested: true,
        follow_up_submitted_at: "2026-08-01T12:05:00Z",
        contact_requested_at: "2026-08-01T12:05:00Z",
        customer_name: "Layla",
        customer_email: "layla@example.test",
        comment: "Excellent service",
      },
    },
  ],
  total: 1,
  channel: "email",
  template: "Default",
  assignment: {
    id: ASSIGNMENT_ID,
    organization_id: "org-1",
    channel: "email",
    employee_name: "Alice",
    employee_id: "emp-1",
    location_name_en: null,
    location_name_ar: null,
  },
  limit: 25,
  offset: 0,
};

const emptyEnvelope: ResponseListEnvelope = {
  events: [],
  total: 0,
  channel: "email",
  template: "Default",
  assignment: {
    id: ASSIGNMENT_ID,
    organization_id: "org-1",
    channel: "email",
    employee_name: "Alice",
    employee_id: "emp-1",
    location_name_en: null,
    location_name_ar: null,
  },
  limit: 25,
  offset: 0,
};
describe("ResponseDetailDrawer", () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders nothing when open is false", () => {
    const { container } = render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={false}
        onClose={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("lazy-fetches and renders captured ratings when opened", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify(readyEnvelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("responses-ready")).toBeTruthy());
    expect(screen.getByText("Very satisfied")).toBeTruthy();
    expect(screen.getByText("Excellent service")).toBeTruthy();
    expect(screen.getByText("layla@example.test")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toContain(`/api/email-signature/responses/${ASSIGNMENT_ID}`);
  });

  it("renders the empty state when there are no events", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify(emptyEnvelope), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("responses-empty")).toBeTruthy());
    expect(screen.queryByTestId("responses-ready")).toBeNull();
  });

  it("renders an error message when the API returns 403", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: "forbidden" }), { status: 403 }),
    );

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("responses-error")).toBeTruthy());
    expect(screen.getByTestId("responses-error").textContent).toContain("does not belong");
  });

  it("falls back to the generic message on a 503", async () => {
    fetchMock.mockImplementation(async () =>
      new Response(JSON.stringify({ error: "rpc_failed" }), { status: 503 }),
    );

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("responses-error")).toBeTruthy());
    expect(screen.getByTestId("responses-error").textContent).toContain("could not load");
  });

  it("hides PII when the customer opted to stay anonymous", async () => {
    const anon = {
      ...readyEnvelope,
      events: [
        {
          ...readyEnvelope.events[0]!,
          followup: {
            session_id: "session-1",
            current_rating: 5,
            rating_label: "Very satisfied",
            rating_emoji: "😀",
            identity_status: "anonymous",
            follow_up_status: "submitted",
            contact_status: "new",
            contact_requested: false,
            follow_up_submitted_at: null,
            contact_requested_at: null,
            customer_name: null,
            customer_email: null,
            comment: "Excellent service",
          },
        },
      ],
    };
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(anon), { status: 200 }));

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={vi.fn()}
      />,
    );

    await waitFor(() => expect(screen.getByTestId("responses-ready")).toBeTruthy());
    expect(screen.queryByText("layla@example.test")).toBeNull();
    expect(screen.getByText("Excellent service")).toBeTruthy();
  });

  it("calls onClose when the X button is clicked", async () => {
    fetchMock.mockImplementation(async () => new Response(JSON.stringify(emptyEnvelope), { status: 200 }));
    const onClose = vi.fn();

    render(
      <ResponseDetailDrawer
        assignmentId={ASSIGNMENT_ID}
        subjectLabel="Alice"
        open={true}
        onClose={onClose}
      />,
    );

    const closeBtn = await waitFor(() => screen.getByLabelText("Close responses drawer"));
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});