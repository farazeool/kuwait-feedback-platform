# Local Database Foundation

## Scope

Milestone 2 defines the complete local PostgreSQL tenancy, survey, response, alert, subscription, and audit foundation. It does not link to or modify a hosted Supabase project.

The source of truth is the ordered SQL in `supabase/migrations`. `supabase/seed.sql` contains synthetic local fixtures only.

## Relationships

- `profiles` extends `auth.users`. The optional `platform_role` can contain only `platform_admin`.
- `organizations` are tenant roots.
- `organization_memberships` joins users to organizations with owner, admin, location-manager, or analyst roles.
- `locations` belong to organizations. Composite foreign keys ensure records cannot claim a location from another organization.
- `location_memberships` explicitly grants a location manager or location-scoped analyst access to a location.
- `surveys` belong to one organization and one location and expose a random, non-sequential public slug.
- `survey_questions` belong to surveys and enforce rating, multiple-choice, or text-specific shapes.
- `survey_question_options` normalize choices for multiple-choice questions.
- `survey_responses` capture an immutable submission scope and optional idempotency key.
- `survey_answers` store rating/text answers. `survey_answer_choices` is the normalized join for selected options.
- `alerts` belong to an organization/location and may reference the response that triggered them.
- `subscriptions` are one-to-one with organizations. Provider credentials are never stored.
- `audit_logs` are append-only records for administrative changes.

All primary keys are UUIDs. Timestamps are `timestamptz` values stored in UTC. Organization and location timezones are constrained to `Asia/Kuwait` for this product.

## Permission model

| Role | Organization scope | Location scope | Writes |
| --- | --- | --- | --- |
| `platform_admin` | All organizations | All locations | Full platform administration |
| `organization_owner` | Own memberships | All organization locations | Organization, membership, location, survey, alert, and response-retention management |
| `organization_admin` | Own memberships | All organization locations | Same operational management, but cannot grant/modify owner roles |
| `location_manager` | Organization identity only | Explicit `location_memberships` only | Alert acknowledgement; business data remains read-only in this foundation |
| `analyst` | Organization-wide when assigned there | Explicit locations when location-assigned | Read-only |

Users cannot update their own membership role. Owner memberships are not editable through ordinary tenant policies. Platform elevation exists only in `profiles.platform_role` and self-profile policies require it to remain null.

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

## Anonymous survey safety

The `anon` role receives no direct table privileges. It can execute only two narrow functions:

- `get_public_survey(slug)` returns the active bilingual location name, survey copy, active questions, and active options. It omits organization IDs, memberships, responses, and internal metadata.
- `submit_public_survey_response(slug, locale, answers, idempotency_key)` validates the active organization/location/survey, required questions, question ownership, value type/range, option ownership, text length, duplicate questions, and idempotency before atomically writing the response and answers.

Both functions set an empty `search_path`; the submission function is the only anonymous write boundary. Anonymous clients cannot list, update, or delete responses.

Application/edge rate limiting, body-size limits, and bot challenges are still required before production exposure. The database function enforces data validity and tenant scope but is not an IP rate limiter.

## Audit behavior

Administrative mutations to organizations, memberships, locations, surveys, questions, options, alerts, subscriptions, and response deletion create audit records. Logs capture actor, database role, action, table, record, organization, optional request ID, and redacted before/after data. Subscription provider identifiers and arbitrary metadata are excluded; survey response free text is never copied into audit logs.

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
npm run db:types
```

Stop the stack with `npm run db:stop`.

This workstation currently has native PostgreSQL but no Docker CLI. The repository therefore also provides:

```bash
npm run db:verify:native
```

That command creates `.local-postgres` inside the repository, applies every migration from zero, loads the seed, executes `supabase/tests/rls_verification.sql`, attempts available Supabase lint/type tooling, and stops the database. It never contacts a hosted Supabase project. Official Supabase lint/type generation still requires the Docker-backed stack or its bundled extensions; the checked-in generated-style `src/types/database.ts` keeps application code typed until then.
