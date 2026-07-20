# Supabase Database Foundation

## Scope

Milestones 2–5 define the PostgreSQL tenancy, survey authoring/lifecycle, protected response, rate-limit, analytics, operational workflow, alert, subscription, audit, onboarding, and invitation foundation. The schema is validated against the official local Supabase PostgreSQL 17 stack and applied to an isolated free hosted development project. Production remains unlinked and untouched.

The source of truth is the ordered SQL in `supabase/migrations`. `supabase/seed.sql` contains synthetic local fixtures only.

## Relationships

- `profiles` extends `auth.users`. The optional `platform_role` can contain only `platform_admin`.
- `organizations` are tenant roots.
- `organization_memberships` joins users to organizations with owner, admin, location-manager, or analyst roles and an explicit `organization`/`locations` scope.
- `locations` belong to organizations. Composite foreign keys ensure records cannot claim a location from another organization.
- `location_memberships` explicitly grants a location manager or location-scoped analyst access to a location.
- `surveys` belong to one organization and one location, expose a random non-sequential public slug, and use `survey_group_id` to atomically coordinate the same draft across locations.
- `survey_questions` belong to surveys and enforce rating, multiple-choice, or text-specific shapes.
- `survey_question_options` normalize choices for multiple-choice questions.
- `survey_responses` capture an immutable submission scope and optional idempotency key.
- `survey_answers` store rating/text answers. `survey_answer_choices` is the normalized join for selected options.
- `alerts` belong to an organization/location and may reference the response that triggered them.
- `response_internal_notes` contains manager-only response notes. Notes are scope-protected, are never returned by public survey functions, and are not copied into audit logs.
- `subscriptions` are one-to-one with organizations. Provider credentials are never stored.
- `audit_logs` are append-only records for administrative changes.
- `organization_invitations` stores invitation metadata and SHA-256 token digests; it never stores plaintext tokens.
- `organization_invitation_locations` records explicit locations for location-scoped invitations.
- `public_submission_rate_limits` stores only SHA-256 fingerprint bytes, short time buckets, counts, and expiry timestamps. It has no ordinary or anonymous grants.

All primary keys are UUIDs. Timestamps are `timestamptz` values stored in UTC. Organization and location timezones are constrained to `Asia/Kuwait` for this product.

## Permission model

| Role | Organization scope | Location scope | Writes |
| --- | --- | --- | --- |
| `platform_admin` | All organizations | All locations | Full platform administration |
| `organization_owner` | Own memberships | All organization locations | Organization, membership, location, survey, alert, and response-retention management |
| `organization_admin` | Own memberships | All organization locations | Same operational management, but cannot grant/modify owner roles |
| `location_manager` | Organization identity only | Explicit `location_memberships` only | Alert and response workflow updates within assigned locations |
| `analyst` | Organization-wide when assigned there | Explicit locations when location-assigned | Read-only |

Users cannot update their own membership role. Owner memberships are not editable through ordinary tenant policies. Platform elevation exists only in `profiles.platform_role` and self-profile policies require it to remain null.

Organization-wide analysts have `scope = organization`. Location-scoped analysts and every location manager have `scope = locations` plus explicit `location_memberships`. The permission helpers check both layers so a location-scoped membership cannot become organization-wide merely because the tenant membership exists.

## RLS behavior

RLS is enabled and forced on every application table. Permission helpers are `SECURITY DEFINER`, owned by the migration owner, use an empty `search_path`, and query membership tables with row security bypassed. This avoids recursive membership-policy evaluation while keeping policy expressions small and consistent.

Important helpers include:

- `is_platform_admin`
- `organization_role`
- `can_read_organization` / `can_manage_organization`
- `can_access_location` / `can_manage_location`
- `can_read_survey` / `can_manage_survey`
- `can_access_response`
- `can_manage_alert`

Ordinary authenticated users receive table privileges only where a matching RLS policy exists. Audit logs have read policies but no update/delete grants, plus defensive triggers that reject mutation.

## Survey lifecycle and historical integrity

`save_survey_draft` is the trusted authenticated authoring boundary. It checks organization management permission, validates 1–20 organization locations and up to 50 questions, and synchronizes all group members in one transaction. Direct authenticated question/option mutations are revoked. `transition_survey_group` requires a location, a question, English labels, valid rating bounds, and at least two active options for every multiple-choice question before activation. Archiving immediately removes the group from public lookup without deleting responses; restoration runs the same publication validation.

Answered question and option triggers reject update/delete operations. An active survey with responses must be duplicated with `duplicate_survey_group`; the new draft receives new survey, question, option, and public identifiers while the original response graph remains unchanged.

## Anonymous survey safety

The `anon` role receives no direct table privileges. It can execute `get_public_survey(slug)`, which returns only active bilingual public structure and organization/location names without internal tenant IDs. Final writes use `submit_protected_survey_response`; the formerly exposed lower-level submission function is revoked from anonymous and authenticated clients.

The protected function validates fingerprint shape, consumes a five-request/15-minute per-survey bucket, honors idempotency before counting a retry, and then delegates required-question, ownership, type/range, choice-membership, text-length, duplicate-question, and atomic response/answer validation. Anonymous clients cannot list, update, or delete responses or inspect rate buckets.

The Next.js boundary additionally enforces JSON content type, a 64 KiB actual/declared body cap, 50 answers, Zod validation, a honeypot, realistic completion time, and an HMAC request fingerprint. Logs include only event category, public slug, decision class, and duplicate status—never raw addresses or answer text. Production bot challenge/WAF integration remains deferred and requires an approved provider.

## Audit behavior

Administrative mutations to organizations, memberships, locations, surveys, questions, options, alerts, subscriptions, and response deletion create audit records. Logs capture actor, database role, action, table, record, organization, optional request ID, and redacted before/after data. Subscription provider identifiers and arbitrary metadata are excluded; survey response free text is never copied into audit logs.

Atomic onboarding is audited by the existing organization, membership, and location triggers. Invitation preparation, acceptance, and revocation write redacted audit events directly; neither plaintext tokens nor token digests are copied into audit rows.

## Trusted onboarding and invitations

`create_organization_with_first_location` is the only self-service tenant bootstrap operation. It verifies `auth.uid()`, an active profile, and the absence of active memberships. It does not accept a role, so the caller can receive only the initial `organization_owner` role. Organization, membership, and first location creation share one PostgreSQL transaction.

`prepare_organization_invitation_v2` permits only `organization_admin`, `location_manager`, and `analyst`. Location managers require at least one active location. Analysts may be organization-wide or explicitly location-scoped. The function rejects an existing member or duplicate open invitation and uses a digest-only hourly rate bucket. `resend_organization_invitation` locks and revokes the old invitation before returning a new one-time token plus the trusted email/template fields. `accept_organization_invitation` locks the invitation, verifies hash, expiry, revocation, single-use state, and authenticated email, then creates memberships from trusted stored values. `revoke_organization_invitation` is owner/admin-only.

Authenticated clients have no direct read or write privileges on invitation tables, including token digests. Owner/admin workflows use only narrowly granted functions. `list_team_invitations` returns delivery and lifecycle metadata but omits token hashes. Invitation creation, resend, revoke, acceptance, delivery state, and non-sensitive failed acceptance events are audited without email bodies or tokens.

## Team role and ownership matrix

| Operation | Owner | Organization admin | Location manager | Analyst |
| --- | --- | --- | --- | --- |
| View organization team | Yes | Yes | Assigned/relevant only | Read-only |
| Invite admin/manager/analyst | Yes | Yes | No | No |
| Change non-owner role/scope | Yes | Yes | No | No |
| Transfer ownership | Yes, dedicated operation | No | No | No |
| Manage organization settings/branding | Yes | Yes | No | No |
| Manage locations | Yes | Yes | Assigned view only | Read-only |

No tenant operation can create `platform_admin`. The final active owner trigger rejects update/delete outside `transfer_organization_ownership`, and self-role mutation is rejected before any write.

## Settings, location lifecycle, and storage

The administration migration extends organizations with contact, locale/format, support, and branding fields; locations with operational contact, opening-hours JSON, active state, and timezone inheritance; and invitations with locale, personal message, delivery status, and supersession. `update_organization_settings` audits changes through the administrative trigger and checks recent authentication for a slug change. Unique organization and per-organization location slugs remain database constraints.

The private `organization-branding` bucket allows only tenant-authorized reads/writes. Object names are `<organization UUID>/<random UUID>.<approved extension>`, metadata MIME must be PNG/JPEG/WebP, and size must be 1–2,097,152 bytes. Application validation additionally checks magic bytes, so renaming an SVG cannot bypass the policy. Replacing a logo updates the relational reference before removing the previous object; failed uploads are cleaned up when possible.

## Account and platform lifecycle

`update_own_profile` can change only display name and locale. `deactivate_own_account` archives the profile and memberships and refuses active owners; it never deletes historical responses. Password and session operations remain Supabase Auth operations. Data erasure, legal retention, and ownerless-tenant handling require a reviewed support process before production.

`get_platform_overview` is executable only by a database-verified platform administrator. It returns per-organization member/location/survey/response/storage-object counts and status but no answers or customer text. The platform audit UI selects only actor, target table, action, tenant, and timestamp.

## Local seed data

The seed creates passwordless `.test` identities for:

- one platform administrator
- one organization owner
- one organization administrator
- one Salmiya location manager
- one organization-wide analyst

It creates one demo organization, Salmiya and Sharq locations, one published bilingual customer-satisfaction survey, three active questions, normalized options, three representative responses, one low-score alert, and one local trial subscription. These fixed identities are synthetic and intended only for disposable local databases.

## Migration workflow

1. Add a forward-only timestamped migration to `supabase/migrations`.
2. Include constraints, indexes, RLS enablement, grants, and policies with the schema they protect.
3. Update `supabase/seed.sql` only with synthetic data.
4. Run `npm run db:reset`, `npm run db:lint`, `npm run db:test`, and `npm run db:types` with the official local Supabase stack.
5. Run `npm run check` and `npm run build`.
6. Review generated SQL/types and tenant-denial tests before committing.

Never edit a hosted database manually. Never include credentials, tokens, production project references, or customer data in a migration or seed.

## Local setup

With Docker or another Supabase-compatible container runtime:

```bash
npm ci
npm run db:start
npm run db:reset
npm run db:lint
npm run db:test
npm run db:test:authorization
npm run db:types
npm run test:e2e
```

Stop the stack with `npm run db:stop`.

The Playwright server reads the disposable local stack status, injects only its URL and anonymous key, and tests the mobile bilingual survey, protected anonymous submission, dashboard redirect, and same-origin local QR generation. Local seed identities remain synthetic/passwordless; no demo credentials are sent to the hosted development project.

The repository also provides a native PostgreSQL fallback for environments where Docker is unavailable:

```bash
npm run db:verify:native
```

That command creates `.local-postgres` inside the repository, applies every migration from zero, loads the seed, executes `supabase/tests/rls_verification.sql`, attempts available Supabase lint/type tooling, and stops the database. It never contacts a hosted Supabase project. The checked-in `src/types/database.ts` is now generated by the official local Supabase CLI.

## Hosted development environment

The hosted project is an isolated free development environment in `ap-south-1`. Its ignored local link state lives under `supabase/.temp`; credentials live only in ignored `.env.local`. Migrations were applied without `supabase/seed.sql`, and hosted verification confirms zero organizations, responses, and invitations. Never run local seed data against staging or production-like environments without a specific review.

## Analytics definitions and authorization

`get_analytics_overview` supplies response totals, normalized average, five-band distribution, response and low-score trends, survey/location comparisons, alert metrics, and recent responses. `get_survey_question_analytics` supplies scale-native rating average/median/distribution/trend, single-choice option counts and percentages, and bounded text-answer pages. Both functions call `assert_analytics_scope`; the maximum interval is 366 days and all tenant/location checks use the same RLS permission helpers as detail screens.

Overall cross-survey ratings are normalized to 0–100 from each survey's valid rating bounds. A normalized low score is at or below 40. Question screens retain the original values and scale. NPS is intentionally absent until a survey explicitly defines an eligible 0–10 recommendation question. Date filters convert Kuwait calendar midnights into UTC instants, query the half-open `[start, end)` interval, and bucket back through `Asia/Kuwait`.

Location comparisons show averages only with their counts. Ranking requires five current responses; improvement/decline also needs five responses in the immediately preceding equal-length range. This threshold prevents labels on tiny samples but is not a statistical-significance test.

`update_alert_workflow` implements assignment, acknowledgement, resolution, dismissal, and reopening. `update_response_workflow` implements review status, deduplicated internal tags, assignment, and private notes. Direct ordinary updates are revoked. The functions authorize owners/admins organization-wide, location managers only at assigned locations, and deny analyst mutations. Specialized triggers record action and non-sensitive state metadata in `audit_logs`; answer and internal-note text are excluded.

Exports first call `record_data_export`, then read only through the authenticated RLS client. The application streams at most 10,000 output rows within a maximum 366-day interval. CSV cells are always quoted, formula-leading values are prefixed safely, Arabic is encoded as UTF-8 with a BOM, and UTC plus Kuwait-local timestamps are included. Export code omits UUIDs where unnecessary and never selects secrets, tokens, authentication metadata, raw addresses, fingerprints, or rate-limit state.

## Indexing and scale assumptions

The analytics migration adds organization/date, location/date, survey/date, rating, workflow, assignee, tag, answer-value, option, alert-status, and note indexes. `supabase/tests/analytics_performance.sql` runs representative `EXPLAIN (ANALYZE, BUFFERS)` queries after each local reset.

- At 1,000 responses, bounded live aggregation and ordinary pagination are expected to be sufficient.
- At 10,000 responses, index usage and stable server-side pagination are required; exports remain streamed.
- At 100,000 responses, measure production-like plans and consider asynchronous exports and tenant-keyed daily rollups. Do not add global or cross-tenant caches.

Any future server cache key must include user authorization scope, organization, permitted locations, selected survey, date window, rating range, and alert/workflow filters. Cache invalidation must never widen scope.
