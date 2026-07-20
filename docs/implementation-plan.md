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

**Status:** Complete locally. Official Docker-backed Supabase lint/type generation remains an environment follow-up; the repository-scoped PostgreSQL reset and policy suite pass.

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

- Implement Supabase SSR session refresh and protected dashboard routing.
- Build sign-in, sign-out, invitation acceptance, and recovery flows.
- Build organization creation, settings, membership, role, and location management.
- Enforce authorization in server actions and RLS.
- Add ownership-transfer safeguards and audit events.
- Add English/Arabic messages and locale-aware navigation shell.

**Exit criteria:** authenticated users can manage only allowed tenants/locations, with negative integration tests and audit coverage.

## Milestone 4 — Survey authoring, publishing, and QR links

- Migrate survey, version, question, option, and location-survey entities.
- Build an accessible bilingual survey editor for rating, multiple-choice, and text questions.
- Validate drafts with shared Zod schemas.
- Publish immutable versions and map them to locations.
- Generate stable public URLs and downloadable QR assets.
- Add preview and deactivate/reactivate workflows.

**Exit criteria:** a manager can create and publish a bilingual location survey without mutating historical versions.

## Milestone 5 — Public response collection

- Build locale-aware, RTL-safe public survey rendering.
- Add server-side schema/version validation and atomic response writes.
- Add idempotency, request-size limits, honeypot/risk signals, and rate limiting.
- Add accessible success/error/retry states.
- Verify that anonymous users cannot enumerate or read tenant/response data.
- Establish privacy-safe structured logging.

**Exit criteria:** anonymous submissions are reliable under retry and demonstrably cannot cross tenant or survey boundaries.

## Milestone 6 — Dashboard and analytics

- Add organization/location filters and permission-scoped data queries.
- Implement response totals, average ratings, distributions, and time trends.
- Add branch comparison and drill-down views.
- Add safe text-feedback browsing with pagination and export authorization.
- Test Kuwait-local day/week boundaries and Arabic number/date formatting.
- Measure query plans and add indexes before considering rollups.

**Exit criteria:** every dashboard metric matches controlled fixtures and respects role/location scope.

## Milestone 7 — Alerts, auditing, and operational hardening

- Add configurable low-score rules and idempotent alert events.
- Integrate approved notification channels in a non-production environment.
- Complete append-only audit coverage and administrator audit viewer.
- Add security headers, CSP, dependency review, and abuse monitoring.
- Define retention, backup, recovery, and incident procedures.
- Run accessibility, performance, tenant isolation, and threat-model reviews.

**Exit criteria:** alerts are deduplicated, admin mutations are traceable, and launch readiness findings are resolved or explicitly accepted.

## Milestone 8 — CI, staging, and approved launch

- Add GitHub CI for lint, type checking, tests, migration checks, and build.
- Configure isolated staging Supabase and Vercel projects after approval.
- Validate preview/staging secrets and migration release procedure.
- Run end-to-end smoke tests and production-readiness checklist.
- Prepare rollback and data-recovery steps.
- Deploy to production only after explicit user approval.

**Exit criteria:** protected CI is green, staging acceptance passes, and production launch has explicit authorization.

## Deferred decisions requiring evidence or product input

- Notification channels and delivery provider.
- Data retention and deletion policy, including free-text feedback.
- Whether analysts may export raw responses by default.
- Exact platform-admin support workflow and approval controls.
- Rate-limit provider and challenge mechanism at expected traffic volumes.
- Billing, subscription tiers, and organization quotas.

These decisions do not block the local foundation or tenancy schema, but they must be resolved before the affected production feature is enabled.
