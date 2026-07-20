# Database migrations

Add forward-only Supabase SQL migrations here using UTC timestamp prefixes, for example:

`20260720090000_create_tenancy_schema.sql`

Each migration must include the relevant constraints, indexes, Row Level Security enablement, and policies. Never include credentials or production data. Test tenant isolation and denied-access cases before applying a migration outside a disposable environment.

Do not edit or reorder an already-applied migration. Add a new timestamped migration for corrections. Validate the full history with `npm run db:reset` and `npm run db:test`, or use `npm run db:verify:native` when the Docker-backed Supabase stack is unavailable.
