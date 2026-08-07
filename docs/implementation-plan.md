# Kuwait Feedback Platform Implementation Plan

## Delivery rules

Each milestone must end with linting, type checking, unit tests, and a production build. Database milestones additionally require migration review and policy tests. External environments must remain non-production unless the user explicitly approves production access. No milestone is complete with known failing checks.

## Milestone 1 — Repository and application foundation

**Status:** Complete.

- Document durable repository instructions, architecture, security model, and delivery sequence.
- Initialize Next.js App Router, strict TypeScript, Tailwind CSS, ESLint, and Vitest.
- Add Zod environment validation with placeholder-only example configuration.
- Establish `app`, `features`, `components`, `lib`, and Supabase migration boundaries.
- Add browser/server Supabase client factories without connecting production data.
- Add initial bilingual survey-domain schemas and unit tests.
- Run lint, type checking, tests, and a production build.
- Create a local Git checkpoint commit.

**Exit criteria:** clean checkout can install, pass `npm run check`, and pass `npm run build`; no secrets or cloud mutations are present.

## Milestone 2 — Local database tenancy and RLS

**Status:** Complete. Official Docker-backed PostgreSQL 17 reset, lint, pgTAP, direct authorization tests, and generated types pass.

- Add Supabase local development configuration and reproducible reset scripts.
- Create migrations for profiles, organizations, locations, organization/location memberships, surveys, responses, alerts, audit logs, and subscriptions.
- Add enums/constraints for the five platform roles and active/inactive lifecycle states.
- Enable and force RLS on every tenant table.
- Add helper functions and least-privilege policies for each role.
- Add seed fixtures only for local test identities and synthetic tenants.
- Add a checked-in Supabase-compatible TypeScript database contract and official regeneration script.
- Add SQL tests proving allowed access, anonymous submission validation, self-promotion prevention, and cross-tenant denial.

**Exit criteria:** migrations rebuild a local database from zero; policy tests demonstrate isolation for every role.

## Milestone 3 — Authentication and organization management

**Status:** Complete.

- Implement Supabase SSR session refresh and protected dashboard routing.
- Build sign-in, sign-out, invitation acceptance, and recovery flows.
- Build atomic first-organization/first-location creation and the protected management shell.
- Add secure invitation preparation/acceptance/revocation foundations; defer real email delivery and advanced team UI.
- Enforce authorization in server actions and RLS.
- Add ownership-transfer safeguards and audit events.
- Add English/Arabic messages and locale-aware navigation shell.

**Exit criteria:** authenticated users can manage only allowed tenants/locations, with negative integration tests and audit coverage.

## Milestone 4 — Survey authoring, publishing, and QR links

**Status:** Complete. The migration passed the full local PostgreSQL 17 verification suite before being applied without seed data to the isolated hosted development project.

- Migrate survey, version, question, option, and location-survey entities.
- Build an accessible bilingual survey editor for rating, multiple-choice, and text questions.
- Validate drafts with shared Zod schemas.
- Publish immutable versions and map them to locations.
- Generate stable public URLs and downloadable QR assets.
- Add preview and deactivate/reactivate workflows.

**Exit criteria:** a manager can create and publish a bilingual location survey without mutating historical versions.

## Milestone 5 — Public response collection

**Status:** Core collection and the permission-scoped basic response inbox were delivered with Milestone 4. Full analytics/export remains in Milestone 6.

- Build locale-aware, RTL-safe public survey rendering.
- Add server-side schema/version validation and atomic response writes.
- Add idempotency, request-size limits, honeypot/risk signals, and rate limiting.
- Add accessible success/error/retry states.
- Verify that anonymous users cannot enumerate or read tenant/response data.
- Establish privacy-safe structured logging.

**Exit criteria:** anonymous submissions are reliable under retry and demonstrably cannot cross tenant or survey boundaries.

## Milestone 6 — Dashboard and analytics

**Status:** Complete as the analytics portion of the requested Milestone 5 delivery.

- Add organization/location filters and permission-scoped data queries.
- Implement response totals, average ratings, distributions, and time trends.
- Add branch comparison and drill-down views.
- Add safe text-feedback browsing with pagination and export authorization.
- Test Kuwait-local day/week boundaries and Arabic number/date formatting.
- Measure query plans and add indexes before considering rollups.
- Add accessible chart summaries, survey question analytics, normalized mixed-scale comparisons, and minimum-sample safeguards.
- Add streamed and audited response, answer, survey, location, and alert CSV exports.

**Exit criteria:** every dashboard metric matches controlled fixtures and respects role/location scope.

## Milestone 7 — Alerts, auditing, and operational hardening

**Status:** Production-hardening foundation delivered on the Milestone 7 feature branch; external delivery and launch approval remain deferred.

- Add configurable low-score rules and idempotent alert events.
- Add permission-scoped alert assignment/lifecycle actions and response review states, tags, assignees, private notes, and audit events.
- Integrate approved notification channels in a non-production environment.
- Complete append-only audit coverage and administrator audit viewer.
- Add security headers, CSP, dependency review, CI, environment isolation assertions, provider-independent bot protection, and abuse monitoring foundations.
- Define retention, backup, recovery, capacity, and incident procedures in `docs/operations.md`.
- Run accessibility, performance, tenant isolation, and threat-model reviews.

**Exit criteria:** alerts are deduplicated, admin mutations are traceable, and launch readiness findings are resolved or explicitly accepted.

## Milestone 8 — CI, staging, and approved launch

**Status:** Pilot-ready locally. Survey templates, pilot onboarding checklist, and pilot QR card are implemented, tested, and production-build verified. CI configuration is checked in. Staging configuration, production secrets, and deployment remain pending explicit approval.

- Add GitHub CI for lint, type checking, tests, migration checks, and build.
- Configure isolated staging Supabase and Vercel projects after approval.
- Validate preview/staging secrets and migration release procedure.
- Run end-to-end smoke tests and production-readiness checklist.
- Prepare rollback and data-recovery steps.
- Deploy to production only after explicit user approval.

**Pilot readiness deliverables (complete):**

- Bilingual survey template gallery (cafe/restaurant, retail, service center, general, blank)
- State-derived pilot onboarding checklist (4 steps, manager-visible, auto-hiding)
- Reusable bilingual pilot QR card with print/download/copy actions
- Local seed authentication fix (non-NULL GoTrue token columns + demo passwords)

**Exit criteria:** protected CI is green, staging acceptance passes, and production launch has explicit authorization.

## Requested Milestone 6 — Team, settings, localization, and platform administration

**Status:** Complete locally; hosted migration and GitHub branch-protection status are recorded in the milestone handoff.

- Deliver permission-scoped team listing, invitation history, guarded role/location changes, deactivation/removal, and atomic ownership transfer.
- Deliver digest-only rate-limited invitation creation/resend/revoke/acceptance with bilingual provider-independent email templates and local capture.
- Add organization, location, branding, account profile/security, session, and guarded deactivation settings.
- Add a private tenant-scoped branding bucket with magic-byte/type/size validation and signed public presentation.
- Add English/Arabic catalog parity checks, RTL shell behavior, and Kuwait-local formatting.
- Add read-only platform organization counts and redacted audit visibility for database-verified platform administrators.
- Keep billing, production mail credentials, full erasure automation, and broad platform mutations deferred pending policy/provider decisions.

**Exit criteria:** local PostgreSQL 17 rebuild, pgTAP/RLS/storage/invitation tests, application tests, browser checks, lint, types, build, audit, and secret scans pass without production or demo-data mutation.

**Branch protection:** GitHub `main` now requires a pull request and disallows force pushes and branch deletion. Administrator enforcement is intentionally off so the existing solo checkpoint workflow remains usable. No status context is required because the repository does not yet have a stable GitHub Actions pipeline; add required checks with Milestone 8 CI.

## Deferred decisions requiring evidence or product input

- Notification channels and delivery provider.
- Data retention and deletion policy, including free-text feedback.
- Whether analysts may export raw responses by default.
- Exact platform-admin support workflow and approval controls.
- Rate-limit provider and challenge mechanism at expected traffic volumes.
- Billing, subscription tiers, and organization quotas.

These decisions do not block the local foundation or tenancy schema, but they must be resolved before the affected production feature is enabled.
