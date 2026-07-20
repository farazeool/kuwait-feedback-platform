# Operations, recovery, and privacy runbook

This runbook is preparation material. It does not authorize a production deployment, a hosted database dump, a DNS change, or deletion of customer data.

## Deployment and migration go/no-go

1. Require green GitHub `verify` and `database` checks, a reviewed pull request, and a clean local checkout.
2. Confirm the target's `APP_ENV`, `SUPABASE_PROJECT_ENVIRONMENT`, project reference, URL, bot configuration, SMTP mode, and deployment version without printing secret values.
3. Confirm a provider-managed backup/export procedure appropriate to the active Supabase plan before applying migrations.
4. Apply forward-only migrations through the reviewed Supabase workflow. Never run `seed.sql` on hosted environments.
5. Check liveness/readiness, authentication redirects, public unavailable-survey handling, and headers after deployment.

If migration validation or a smoke check fails, stop traffic-changing releases, retain error identifiers, restore the prior Vercel deployment where safe, and escalate to the data owner. Do not attempt a destructive down migration against customer data. Test rollback rehearsal only against the local Supabase stack.

## Backups and recovery

Supabase plan capabilities determine automated backup, logical-export, and point-in-time recovery availability; verify current plan documentation before claiming any recovery objective. Do not place dumps in this repository or download production data to developer machines by default. A pre-migration backup may be provider-managed or an approved encrypted logical export held in the designated restricted operations location. Branding objects require a separate storage inventory/backup plan because database recovery does not necessarily restore objects.

Vercel rollback is performed by promoting a previously healthy deployment after validating its environment variables remain compatible with the database schema. An outage recovery sequence is: assess provider status, protect credentials, pause risky changes, choose a compatible application deployment, validate health endpoints, then record the incident and follow-up.

## Emergency controls and credential rotation

- **Public submission risk:** disable public survey publication through the audited admin workflow, then investigate rate-limit and bot events. Do not remove validation/RLS or expose response data.
- **Invitation risk:** revoke active invitations through the tenant workflow; pause SMTP delivery by using the provider control plane only after authorized review.
- **Credential leak:** rotate the affected Supabase, Vercel, SMTP, or bot-provider credential in its provider dashboard; update only the matching environment variable; redeploy; invalidate affected sessions/keys where the provider supports it; inspect redacted logs and audit activity.
- **Incorrect deployment:** roll back at Vercel, verify schema compatibility, and create a corrective forward migration rather than editing production schema manually.

## Incident checklist

For credential leak, cross-tenant suspicion, failed migration, Supabase/Vercel/bot/email outage, abusive traffic, compromised staff account, storage exposure, or configuration leak: record time and correlation IDs; contain access; preserve redacted evidence; identify affected tenant scope; notify the responsible owner; recover using provider-approved actions; validate tenant isolation and health; then complete a post-incident review. Never include answers, notes, invitation links, tokens, cookies, or raw IP addresses in the incident record.

## Retention and privacy operations

Responses and answers remain immutable to preserve survey history. Audit logs remain append-only for necessary accountability. Internal notes, alerts, inactive account records, invitations, email delivery records, and branding assets require a written retention schedule before automatic deletion is enabled. Expired invitation and short-lived rate-limit records may be cleaned through reviewed, tenant-safe operational procedures; do not delete real production records automatically in this foundation.

CSV exports are generated on demand, streamed, and not stored publicly. A data-export or deletion request must be authenticated, scoped to the requester’s authority, assessed for contractual/audit/operational obligations, approved by the data owner, and executed through a reviewed support procedure. This document makes no legal or regulatory compliance claim.

## Capacity assumptions

At 1,000 responses, indexed bounded live queries should be sufficient. At 10,000, monitor query plans, pagination, and export duration. At 100,000, evaluate tenant-scoped daily rollups and asynchronous exports only after measured query plans show a need. Existing analytics date ranges (366 days), response pagination, and 10,000-row export cap are security and capacity controls; do not remove them. Future caches must include authorization scope, tenant/location access, and all filters.

## External readiness requirements

Production needs: a separate Supabase project, an isolated Vercel production environment, an approved bot-provider site key/secret and hostname/action configuration, and approved SMTP credentials. A custom domain remains optional; until approved, use the provider's default HTTPS URL and configure only exact callback/redirect URLs for it.
