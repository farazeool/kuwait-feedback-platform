# Staging Pilot Deployment Checklist — v1.0.0-beta

## Phase 1: Supabase Project Setup

- [ ] Create a new Supabase project for staging
- [ ] Note the project reference (subdomain), anon key, and service-role key
- [ ] Enable the required extensions (pgcrypto, pgTAP optional)
- [ ] Configure Authentication settings:
  - [ ] Disable "Confirm email" for pilot users (or configure Email templates)
  - [ ] Set site URL to staging frontend URL
  - [ ] Add redirect URLs: `https://staging.example.com/auth/callback`
- [ ] Configure Database:
  - [ ] Set statement timeout to 30s
  - [ ] Enable row-level security (applied via migrations)
  - [ ] Ensure connection pooling is active

## Phase 2: Environment Variables

- [ ] Set `NEXT_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co`
- [ ] Set `NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>`
- [ ] Set `NEXT_PUBLIC_APP_URL=https://staging.example.com`
- [ ] Set `SUPABASE_SERVICE_ROLE_KEY=<service-role-key>` (server-side only)
- [ ] Set `SUBMISSION_FINGERPRINT_SECRET` to a random 32+ char string
- [ ] Set `NEXT_PUBLIC_DISABLE_EMAIL_CONFIRMATION=true` for pilot

## Phase 3: Migration Deployment

- [ ] Run migrations against staging Supabase:
  ```bash
  npx supabase link --project-ref <project-ref>
  npx supabase db push
  ```
- [ ] Verify migration chain completes without errors
- [ ] Verify `supabase_migrations.schema_migrations` table has all 33 migrations
- [ ] Run `npx supabase db lint` to check for database warnings

### Migration List (applied in order)
All 33 migrations from `20260720070000_core_schema` through `20260725260000_restrict_assert_analytics_scope_anon`.

## Phase 4: Seed / Demo Data

- [ ] Run the pilot seed script against staging:
  ```bash
  psql "$STAGING_DB_URL" -f scripts/pilot-seed.sql
  ```
- [ ] Verify 6 users created (admin, manager, 3 employees, + platform admin)
- [ ] Verify 1 organization created (Boulevard Cafeteria)
- [ ] Verify 2 locations created (Salmiya, Sharq)
- [ ] Verify 25 survey responses exist
- [ ] Verify 3 alerts exist
- [ ] Verify distribution assignments exist

## Phase 5: Authentication Configuration

- [ ] Test sign-in with all 5 pilot accounts:
  - [ ] `admin@pilot.kuwait-feedback.test` / `Pilot2024!`
  - [ ] `manager@pilot.kuwait-feedback.test` / `Pilot2024!`
  - [ ] `employee1@pilot.kuwait-feedback.test` / `Pilot2024!`
  - [ ] `employee2@pilot.kuwait-feedback.test` / `Pilot2024!`
  - [ ] `employee3@pilot.kuwait-feedback.test` / `Pilot2024!`
- [ ] Verify role-based redirects (admin → dashboard, no-org → onboarding)
- [ ] Test password reset flow

## Phase 6: Email Configuration

- [ ] Configure SMTP provider (SendGrid, Resend, or similar)
- [ ] Set custom SMTP credentials in Supabase Auth settings
- [ ] Send test invitation email
- [ ] Verify email templates:
  - [ ] Confirmation email
  - [ ] Invitation email
  - [ ] Password reset email
- [ ] Verify email delivery to Kuwait-based addresses (optional)

## Phase 7: Frontend Deployment

- [ ] Build the Next.js app:
  ```bash
  npm ci
  npm run build
  ```
- [ ] Deploy to hosting platform (Vercel, Netlify, Fly.io, or Docker):
  - [ ] **Vercel**: `vercel --prod`
  - [ ] **Docker**: `docker build -t kuwait-feedback-staging . && docker run -p 3000:3000 kuwait-feedback-staging`
  - [ ] **Fly.io**: `fly deploy`
- [ ] Set all environment variables on the hosting platform
- [ ] Verify the app starts without errors
- [ ] Verify health check endpoint returns 200

## Phase 8: Domain Configuration

- [ ] Configure DNS: add CNAME record pointing to hosting platform
- [ ] Configure SSL/TLS certificate
- [ ] Set custom domain in Supabase Auth settings
- [ ] Update site URL in Supabase Auth settings to match custom domain

## Phase 9: Pilot Acceptance Testing

Run the acceptance tests described in `PILOT_ACCEPTANCE.md`.

## Phase 10: Rollback Procedure

If the staging deployment fails acceptance or has critical issues:

```bash
# 1. Revert the frontend
vercel rollback          # Vercel
fly deploy v1.0.0-alpha  # Fly.io — deploy previous image

# 2. Revert the database
npx supabase db diff --from v1.0.0-beta --to v1.0.0-alpha > rollback.sql
psql "$STAGING_DB_URL" -f rollback.sql

# 3. Remove the tag if needed
git push --delete origin v1.0.0-beta

# 4. Update alias to point to known good deployment
vercel alias <known-good-url> staging.example.com
```

### Quick Rollback (database-only)
```sql
-- Drop all migrations after the last stable point
DELETE FROM supabase_migrations.schema_migrations
WHERE version > '20260724115000';

-- Re-apply any seed data that was in use before
```

### Data-preserving rollback
If rollback must preserve responses collected during the pilot:
1. Take a full database dump: `pg_dump $STAGING_DB_URL > pre-rollback.sql`
2. Restore from a pre-pilot snapshot
3. Re-import only `survey_responses`, `survey_answers`, and `alerts` from the dump
4. Verify referential integrity

## Known Issues (pre-pilot)

1. **Email delivery**: Requires SMTP provider configuration. Without it, users must
   have `email_confirmed_at` set manually or confirmation disabled.
2. **File storage**: Organization branding upload requires Supabase Storage bucket
   `organization-branding` to be created with appropriate RLS policies.
3. **`get_followup_records`**: Has a pre-existing SQL reference error (`recorded_at`
   column missing from `response_review_audit`) — affects reports page only.
4. **`bulk_create_distribution_assignments`**: Has a pre-existing constraint error
   (ON CONFLICT references a non-indexed constraint) — affects bulk operations.
5. **Quick Feedback / Escalation rules**: Functionally present but not heavily
   tested in this pilot. Core survey + workflow functionality is validated.
