# Kuwait Feedback Platform

A production-ready, multi-tenant customer feedback platform for businesses in Kuwait. Organizations manage multiple locations, publish QR-linked bilingual surveys, collect anonymous customer responses, and analyze ratings and trends within strict role and tenant boundaries.

## Features

### Core platform (Milestones 1–7)

- Next.js 16 App Router with strict TypeScript and Tailwind CSS v4
- Supabase PostgreSQL with Row Level Security on every tenant table
- Zod-based environment and survey-domain validation at trust boundaries
- English/Arabic bilingual UI with RTL-aware layouts and navigation
- Supabase SSR authentication, recovery, and protected routes
- Atomic organization/first-location onboarding with audit coverage
- Five-role hierarchy: `platform_admin`, `organization_owner`, `organization_admin`, `location_manager`, `analyst`
- Role-aware, bilingual dashboard shell with locale-aware navigation
- Hashed, expiring, single-use invitation backend with rate-limited digest delivery
- Protected bilingual survey authoring, preview, publication, archival, and duplication
- Stable per-location public links with local SVG/PNG QR-code generation
- Mobile-first anonymous English/Arabic feedback with atomic validation and idempotency
- Database-backed hashed rate-limit buckets and privacy-safe rejection logging
- Permission-scoped response inbox with Kuwait-local timestamps
- Permission-scoped analytics with bounded Kuwait-local date ranges
- Normalized mixed-scale rating summaries, trends, distributions, and branch/survey comparisons
- Accessible low-JavaScript charts and question-level survey analytics
- Alert acknowledgement, assignment, resolution, dismissal, and reopening workflows
- Response review status, internal tags, assignees, and private notes
- Streamed, audited UTF-8 CSV exports with formula-injection protection and row limits
- Permission-scoped team directory, invitation history, role/location assignment, deactivation, removal, and guarded ownership transfer
- Organization, location, branding, profile, password, session, and guarded account-deactivation settings
- Private tenant-scoped branding bucket (PNG/JPEG/WebP, max 2 MiB, signed URLs)
- English/Arabic message catalogs with key-parity tests and Kuwait-local formatting
- Read-only `platform_admin` operational area that excludes customer answer text
- Security headers, CSP, client-bundle secret scanning, and bot-protection foundations

### Pilot readiness (Milestone 8)

- **Survey templates**: four bilingual industry templates (cafe/restaurant, retail, service center, general) plus a blank/scratch option. Selecting a template pre-fills the survey builder with validated questions and options.
- **Pilot onboarding checklist**: a state-derived, four-step checklist on the dashboard (set up a location, create a survey, publish a survey, collect a response). Visible to managers, hidden from analysts. Disappears when all steps are complete.
- **Pilot QR card**: a reusable, print-ready QR card component with bilingual labels (EN/AR), download in SVG and PNG, copy-link, and print actions. Cards render per location with organization branding and the correct public feedback URL.

## Local setup

Requirements: Node.js 20.9+ and Docker.

```bash
npm install
cp .env.example .env.local
npm run db:start    # start local Supabase (Docker)
npm run db:reset    # apply migrations + seed demo data
npm run dev         # start Next.js dev server on :3000
```

The seed creates five demo users. All share the password `Test1234!`:

| Email | Role | Locale |
|-------|------|--------|
| `owner@demo.kuwait-feedback.test` | organization_owner | en |
| `admin@demo.kuwait-feedback.test` | organization_admin | ar |
| `manager@demo.kuwait-feedback.test` | location_manager | en |
| `analyst@demo.kuwait-feedback.test` | analyst | ar |
| `platform-admin@demo.kuwait-feedback.test` | platform_admin | en |

The seed also creates one organization (Demo Kuwait Hospitality), two locations (Salmiya Marina, Kuwait City – Sharq), one published survey with three questions, three responses, one alert, and one trial subscription.

Replace the placeholder Supabase values in `.env.local` with credentials from a local or non-production project. Never commit `.env.local`.

## Quality checks

```bash
npm run check          # lint + typecheck + tests
npm run build          # production Next.js build
npm run db:test        # Supabase SQL policy tests
npm run db:test:authorization  # comprehensive RLS verification
```

Individual commands: `npm run lint`, `npm run typecheck`, `npm test`.

## Documentation

- [Architecture](docs/architecture.md)
- [Database foundation](docs/database.md)
- [Implementation plan](docs/implementation-plan.md)
- [Deployment preparation](docs/deployment.md)
- [Operations and recovery runbook](docs/operations.md)
- [Repository agent instructions](AGENTS.md)

## Environment status

The repository is linked locally to an isolated free hosted Supabase development project. Its credentials remain in ignored `.env.local`; local demo seed data was not uploaded. Production is intentionally unavailable until an isolated project and provider credentials are configured. The private GitHub repository protects `main` by requiring pull requests while blocking force pushes and branch deletion.

## Local database

The Supabase foundation is migration-driven. With Docker available, use `npm run db:start`, `npm run db:reset`, `npm run db:lint`, `npm run db:test`, `npm run db:test:authorization`, and `npm run db:types`. A repository-scoped native PostgreSQL fallback is available as `npm run db:verify:native`.

For a complete local public-flow check, reset the database, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`.

## Current limitations

- No production deployment configured; staging and launch require explicit approval
- No production email/SMTP provider configured; invitation delivery defaults to preview mode
- No billing, subscription tiers, or organization quotas
- No automated CI pipeline yet (Milestone 8 CI configuration is checked in but status requirements are deferred)
