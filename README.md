# Kuwait Feedback Platform

A multi-tenant customer feedback platform for businesses in Kuwait. Organizations manage multiple locations, publish QR-linked surveys, collect anonymous customer responses, and analyze ratings and trends within strict role and tenant boundaries.

## Milestone 1 foundation

The repository currently provides:

- Next.js App Router with strict TypeScript and Tailwind CSS
- Supabase browser/server client foundations
- Zod-based environment and survey-domain validation
- Vitest, ESLint, type-check, and production build scripts
- Explicit components, library, types, validation, and test boundaries
- English/Arabic and RTL-aware UI foundations
- Architecture, security, and phased implementation documentation
- A migrations-only database workflow under `supabase/migrations`

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
```

Individual commands are available as `npm run lint`, `npm run typecheck`, and `npm test`.

## Documentation

- [Architecture](docs/architecture.md)
- [Implementation plan](docs/implementation-plan.md)
- [Repository agent instructions](AGENTS.md)

## Safety status

Milestone 1 does not connect the application to a production database and does not deploy to Vercel. Cloud mutations require explicit approval.
