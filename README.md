# Kuwait Feedback Platform

A multi-tenant customer feedback platform for businesses in Kuwait. Organizations manage multiple locations, publish QR-linked surveys, collect anonymous customer responses, and analyze ratings and trends within strict role and tenant boundaries.

## Milestone 5 analytics and operations

The repository currently provides:

- Next.js App Router with strict TypeScript and Tailwind CSS
- Supabase browser/server client foundations
- Zod-based environment and survey-domain validation
- Vitest, ESLint, type-check, and production build scripts
- Explicit components, library, types, validation, and test boundaries
- English/Arabic and RTL-aware UI foundations
- Architecture, security, and phased implementation documentation
- A migrations-only database workflow under `supabase/migrations`
- Supabase SSR authentication, recovery, verification callbacks, and protected routes
- Atomic organization/first-location onboarding with audit coverage
- Role-aware, English/Arabic and RTL-ready dashboard shell
- Hashed, expiring, single-use invitation backend foundations
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

## Local setup

Requirements: Node.js 20.9 or later and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Replace the placeholder Supabase values in `.env.local` with credentials from a local or non-production project. Never commit `.env.local`.

## Quality checks

```bash
npm run check
npm run build
npm run test:e2e
npm run db:test:performance
```

Individual commands are available as `npm run lint`, `npm run typecheck`, and `npm test`.

## Documentation

- [Architecture](docs/architecture.md)
- [Database foundation](docs/database.md)
- [Implementation plan](docs/implementation-plan.md)
- [Repository agent instructions](AGENTS.md)

## Environment status

The repository is linked locally to an isolated free hosted Supabase development project. Its credentials remain in ignored `.env.local`; local demo seed data was not uploaded. No Vercel deployment or production Supabase project exists.

## Local database

The Supabase foundation is migration-driven. With Docker available, use `npm run db:start`, `npm run db:reset`, `npm run db:lint`, `npm run db:test`, `npm run db:test:authorization`, and `npm run db:types`. A repository-scoped native PostgreSQL fallback is available as `npm run db:verify:native`.

For a complete local public-flow check, reset the database, install Chromium once with `npx playwright install chromium`, then run `npm run test:e2e`. The test server derives only the disposable local Supabase URL and anonymous key; it never uses or uploads hosted demo data.
