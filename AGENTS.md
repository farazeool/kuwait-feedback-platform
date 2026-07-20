# Kuwait Feedback Platform — Agent Instructions

These instructions apply to the entire repository and should remain durable as the project evolves.

## Product and stack

- Build a production-ready, multi-tenant customer feedback platform for Kuwait businesses.
- Use Next.js App Router, TypeScript in strict mode, Tailwind CSS, Supabase PostgreSQL/Auth, Zod, Vitest, Vercel, and GitHub.
- Support English and Arabic. New UI must be RTL-safe and must not hard-code directional spacing when logical alternatives exist.
- Treat `Asia/Kuwait` as the business timezone. Store database timestamps as UTC and convert only at presentation or reporting boundaries.

## Standard commands

- `npm run dev` — local development server.
- `npm run lint` — ESLint.
- `npm run typecheck` — TypeScript without emitting files.
- `npm test` — Vitest once.
- `npm run check` — lint, typecheck, and tests.
- `npm run build` — production Next.js build.
- `npm run db:reset` — rebuild the official local Supabase database from migrations and seed data.
- `npm run db:test` — run Supabase SQL policy tests.
- `npm run db:verify:native` — validate migrations and RLS using repository-scoped native PostgreSQL when Docker is unavailable.

Run `npm run check` after each meaningful milestone. Run `npm run build` before declaring a milestone complete when application or configuration code changed.

## Architecture and code conventions

- Keep routes and route-specific composition in `src/app`.
- Put reusable UI in `src/components`, business capabilities in `src/features`, framework/infrastructure utilities in `src/lib`, shared types in `src/types`, and cross-cutting validation exports in `src/validation`.
- Keep validation at trust boundaries. Define reusable Zod schemas beside the feature that owns the data.
- Prefer Server Components. Add `"use client"` only at the narrowest interactive boundary.
- Keep privileged operations server-only. Never expose Supabase service-role credentials to browser bundles.
- Generate Supabase database types after schema milestones and use them in data access code.
- Avoid cross-feature imports that bypass a feature's public API.
- Use accessible semantic HTML, keyboard-visible focus states, and WCAG AA color contrast.

## Multi-tenancy, authorization, and data safety

- Every tenant-owned row must be scoped through an organization, directly or through a location/survey relationship.
- Authorization must be enforced in PostgreSQL Row Level Security. UI checks are convenience only, never the security boundary.
- Use the roles `platform_admin`, `organization_owner`, `organization_admin`, `location_manager`, and `analyst`.
- Default to least privilege. Managers may access only explicitly permitted organizations and locations.
- Public survey submission must use a narrowly scoped database function or server endpoint, with validation, rate limiting, abuse controls, and no tenant data leakage.
- Record security-relevant and administrative mutations in append-only audit logs.
- Never modify production data, disable RLS, deploy, purchase services, or delete cloud resources without explicit user approval.

## Database workflow

- Make every schema or policy change through a timestamped file in `supabase/migrations`.
- Migrations should be forward-only, reviewable, and safe for existing data. Include RLS policies and supporting indexes with the schema they protect.
- Test policies with multiple users/roles and negative access cases before applying them outside a local or disposable environment.
- Do not place secrets, access tokens, real project references, or customer data in migrations, fixtures, tests, docs, or source control.

## External services and Git

- Use local filesystem and terminal tools for implementation, dependency installation, tests, builds, and Git.
- Use Composio only when external access to GitHub, Supabase, or Vercel is required. Continue locally if it is unavailable.
- Do not deploy or mutate production services without explicit approval.
- Keep commits focused. Inspect the diff and run the relevant checks before committing.
- Keep broad integration/foundation tests in `tests`; colocate focused unit tests with the feature or utility they cover.

See `docs/architecture.md` for system design, `docs/database.md` for schema and RLS details, and `docs/implementation-plan.md` for sequencing and completion criteria.
