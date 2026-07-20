# Kuwait Feedback Platform Architecture

## 1. Purpose and quality goals

The platform lets Kuwait businesses operate customer-feedback programs across many organizations and physical locations. Customers reach a location-specific survey from a QR code and submit without an account. Authenticated managers see only the tenant data granted to them.

The design prioritizes, in order:

1. Tenant isolation and least-privilege access.
2. Reliable anonymous submissions without exposing tenant data.
3. Clear English and Arabic experiences, including RTL layouts.
4. Correct Kuwait-local reporting while retaining UTC source timestamps.
5. Auditable management activity and operational observability.
6. Incremental delivery without irreversible cloud coupling.

## 2. System context

The Next.js application is the user-facing web tier and server-side application boundary. Supabase provides PostgreSQL, Auth, Row Level Security, and generated API access. Vercel will host the application after an approved deployment milestone. GitHub will hold source and CI configuration.

There are three main request paths:

- **Public survey path:** a customer opens a signed, non-sequential location survey slug, reads the published survey snapshot, and submits validated answers through a rate-limited server endpoint.
- **Manager path:** an authenticated user accesses dashboard and management routes. Supabase Auth identifies the user; RLS independently filters every database operation.
- **Platform operations path:** a platform administrator performs exceptional cross-tenant operations through explicitly protected server-side actions, with an audit event for every material mutation.

No browser receives the Supabase service-role key. The anonymous key is safe to expose only because all exposed tables/functions remain protected by RLS and narrow grants.

## 3. Application boundaries and folders

```text
src/
  app/                  routes, layouts, route handlers, server actions
  components/           reusable presentational and interaction primitives
  features/             domain modules such as organizations, surveys, responses
  lib/
    config/             stable platform constants
    env/                Zod-validated environment access
    auth/               server-only identity, access context, route decisions
    datetime/           Kuwait-local presentation helpers
    supabase/           browser/server database client factories
  types/                shared TypeScript-only contracts
  validation/           cross-cutting validation export boundary
supabase/
  migrations/           forward-only SQL schema and RLS changes
docs/                   architecture and delivery decisions
tests/                  broad integration and foundation tests
```

Server Components are the default. Client Components are restricted to interactive islands such as survey editors and chart controls. Feature modules own their schemas, data access, application services, and tests; route files coordinate those modules rather than becoming business-logic containers.

The Next.js 16 `proxy.ts` refreshes Supabase sessions and performs only the coarse unauthenticated dashboard redirect. Server layouts verify the user with Supabase Auth, load role/membership context from RLS-protected tables, and redirect users without membership to onboarding. UI navigation is role-aware, but it is not an authorization boundary; protected pages, database grants, and RLS enforce access independently.

## 4. Proposed data model

All identifiers use UUIDs. All timestamps use `timestamptz` and are stored in UTC. Human-facing slugs are separate from primary keys and must not reveal record counts.

### Tenancy and identity

- `profiles`: one-to-one extension of `auth.users`; display name, preferred locale, status.
- `organizations`: tenant root; bilingual name, slug, settings, lifecycle status.
- `locations`: belongs to one organization; bilingual name, address, timezone defaulting to `Asia/Kuwait`, status.
- `organization_memberships`: user, organization, role, status; unique per user/organization.
- `location_assignments`: narrows a membership to allowed locations for location managers and analysts.
- `platform_roles`: exceptional platform-wide roles, kept separate from ordinary tenant membership.

### Survey authoring and publishing

- `surveys`: belongs to an organization; lifecycle status and default locale.
- `survey_versions`: immutable published definitions plus mutable drafts; version number and publication metadata.
- `survey_questions`: ordered question definitions for rating, multiple-choice, and text types.
- `survey_question_options`: ordered choices for multiple-choice questions.
- `location_surveys`: maps a survey to a location and owns the public slug/QR destination, activation window, and status.

A response always references the immutable survey version displayed to the customer. Editing a survey creates a new version so historical answers remain interpretable.

### Responses and operations

- `responses`: location survey, survey version, submitted timestamp, locale, overall rating, abuse/risk metadata, optional idempotency key.
- `response_answers`: response, question, typed answer fields with constraints ensuring exactly one appropriate value shape.
- `alert_rules`: organization/location thresholds and notification settings.
- `alert_events`: deduplicated low-score events and delivery state.
- `audit_logs`: append-only actor, action, target, organization context, request correlation, and redacted change metadata.
- `rate_limit_buckets`: only if database-backed limiting is chosen; otherwise use an approved edge key-value service.

Materialized views or rollup tables can be added after real query measurements. Initial dashboards should use indexed aggregate queries over bounded date ranges.

## 5. Authentication, roles, and authorization

Supabase Auth handles manager sessions. Customers submitting public feedback remain unauthenticated.

| Capability | Platform admin | Org owner | Org admin | Location manager | Analyst |
| --- | --- | --- | --- | --- | --- |
| Cross-tenant support | Yes, audited | No | No | No | No |
| Organization settings | Yes | Yes | Yes | No | Read only |
| Membership and roles | Yes | Yes | Yes, below owner | No | No |
| Location management | Yes | Yes | Yes | Assigned only | Read assigned |
| Survey authoring/publishing | Yes | Yes | Yes | Assigned, if granted | Read only |
| Response dashboard | Yes | All org | All org | Assigned only | Assigned/read only |
| Raw response export | Explicit, audited | Yes | Configurable | No by default | Configurable |

Permission checks use database helper functions with stable search paths, such as `is_platform_admin()`, `has_organization_role(org_id, roles[])`, and `can_access_location(location_id)`. Helpers must avoid recursive policy evaluation and should be covered by positive and negative SQL tests.

## 6. Row Level Security strategy

RLS is enabled and forced on every tenant or customer-data table. Policies follow these rules:

- A tenant row is visible only when the authenticated user has an active membership for its organization and, where relevant, an assignment to the location.
- Mutations require a role-specific policy, not merely tenant membership.
- Organization owners cannot be removed or demoted through ordinary admin paths without an ownership-transfer transaction.
- `platform_admin` bypass is expressed through reviewed policies/helper functions, never by distributing service-role credentials.
- Public users receive no direct table read access to drafts, organizations, locations, or responses.
- Published public survey reads and submissions go through narrowly granted security-definer functions or server endpoints that return only the required shape.
- Security-definer functions set a safe `search_path`, validate record status/version, and expose no dynamic SQL.

Every migration that introduces a table must introduce its RLS posture and supporting indexes in the same review unit.

## 7. Anonymous submission and abuse controls

The public URL uses a cryptographically random slug and does not imply authorization to any other record. A submission endpoint performs:

1. Origin, method, body-size, and content-type checks.
2. IP/network rate limiting with hashed or short-lived identifiers.
3. Optional invisible challenge escalation after risk thresholds.
4. Zod validation against the exact published survey version.
5. Server-side enforcement of required questions, answer types, and option membership.
6. An atomic database transaction for response and answers.
7. Idempotency protection against accidental resubmission.

Logs must not retain free-text feedback, raw authentication tokens, or full IP addresses. Retention and deletion requirements should be confirmed before production launch.

## 8. Analytics and alerts

Dashboard queries are always organization/location scoped and use explicit reporting windows. Metrics include response count, average rating, rating distribution, time-bucketed trends, and branch comparisons. Overall-rating semantics must be fixed per survey version so averages remain comparable.

Low-score alerts are created transactionally or asynchronously from new responses. Alert processing must be idempotent and record delivery status. Notification channels are a later integration and require approval before sending real messages.

## 9. Localization, RTL, and time

- Canonical locales are `en` and `ar`; routes will eventually use a locale segment or negotiated locale with an explicit user preference.
- UI copy uses message keys rather than inline duplicated translations.
- Root `lang` and `dir` values change with locale. Components use logical properties and RTL-safe icons/order.
- User-generated bilingual fields are structured as explicit English and Arabic values until translation workflow requirements justify a separate translations table.
- Database timestamps stay in UTC. Reporting boundaries are converted with the IANA zone `Asia/Kuwait`; never use a fixed offset in business logic.
- Tests cover day/week boundaries and formatting in both locales.

## 10. Audit, privacy, and observability

Administrative writes produce append-only audit records with actor, tenant, action, target, request ID, timestamp, and redacted structured metadata. Database triggers are preferred for high-value records so alternate write paths cannot skip the log.

Application logs use structured events and correlation IDs. Secrets, access tokens, free-text survey answers, and sensitive personal data are excluded. Operational metrics should track request latency, response errors, rate-limit decisions, and alert delivery health without exposing customer content.

Backups, recovery objectives, data retention, and Kuwaiti privacy/legal requirements require an explicit pre-production review.

## 11. Deployment model

Environments remain isolated: local, preview, staging, and production use separate Supabase projects and credentials. Vercel preview deployments may connect only to disposable or staging resources. Database migrations run as an explicit reviewed release step, never automatically against production from an untrusted preview.

No deployment or production mutation occurs without user approval. Secrets live in environment managers, not Git. GitHub CI will run lint, type checking, tests, and build before merge.

## 12. Initial architecture decisions

- Use Next.js App Router and Server Components by default.
- Use Supabase Auth identities plus database membership tables, rather than storing mutable authorization solely in JWT custom claims.
- Enforce multi-tenancy in PostgreSQL RLS even when server code already filters queries.
- Version published surveys immutably.
- Use a server-controlled public submission boundary instead of general anonymous table inserts.
- Start analytics with indexed live queries; introduce rollups only from measured need.
- Keep external integrations behind application services so providers can change without changing domain rules.

## 13. Authentication, onboarding, and invitations

Password sign-in, sign-out, recovery, reset, email verification, and PKCE callback handling use `@supabase/ssr`. Ordinary requests use only the public key. The service-role key is parsed only by the server environment module and is not imported by client modules or used to bypass tenant RLS.

The first-organization workflow calls `create_organization_with_first_location`. This `SECURITY DEFINER` function accepts no role input, verifies the caller has an active profile and no active membership, and atomically creates the organization, owner membership, first location, and trigger-backed audit records. A unique slug constraint makes duplicate creation fail without partial writes.

Invitation preparation is restricted to organization owners/admins through `prepare_organization_invitation`. It returns a random token once and stores only its SHA-256 digest. Invitations expire, are revocable and single-use, never allow `platform_admin` or owner assignment, and carry explicit organization/location scope. Acceptance matches the authenticated email and copies the server-selected role/scope; the user cannot submit a role. No real email is sent yet. A future delivery adapter will send the one-time token immediately after preparation using an approved provider, without logging or persisting plaintext tokens.
