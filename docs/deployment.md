# Deployment preparation

No Vercel or production Supabase project is configured by this repository. Deployments, DNS, SMTP setup, and production data changes require separate explicit approval.

## Environment matrix

| Environment | `APP_ENV` | Supabase credential marker | Allowed URLs | Bot protection |
| --- | --- | --- | --- | --- |
| Local | `local` | `local` | `localhost`, `127.0.0.1`, or `::1` only | Disabled provider is a controlled local bypass |
| Preview/development | `preview` | `preview` | Non-local HTTPS only | An external provider must be configured before public submissions |
| Production | `production` | `production` | Non-local HTTPS only | Disabled or bypassed protection is rejected |

`SUPABASE_PROJECT_ENVIRONMENT` is a server-only deployment assertion. It must match `APP_ENV`; preview deployments therefore refuse a credential bundle explicitly marked for production. Keep each environment's values in its provider environment manager, never in Git. `NEXT_PUBLIC_*` values are browser-visible by design; `SUPABASE_SERVICE_ROLE_KEY`, fingerprint keys, email values, and future bot-provider credentials are server-only.

The application validates required URLs and operational secrets at server use. Invalid or incomplete configuration makes readiness return a generic 503 rather than exposing configuration details. Production additionally rejects localhost URLs and a disabled bot provider.

## CI and release preparation

GitHub Actions runs deterministic dependency installation, ESLint, TypeScript, Vitest, localization parity, secret and client-boundary scans, migration filename ordering, production build, and high-severity dependency audit. Database migration application remains an explicit reviewed release action; CI does not connect to a hosted database.

Before an approved deployment, set an isolated preview or production credential bundle, confirm `/api/health/live` and `/api/health/ready`, run the release checks, and apply validated migrations through the approved database workflow. Neither health endpoint returns database topology, secrets, or credentials.

## Security headers and logging

All routes set a restrictive CSP, `nosniff`, strict referrer policy, disabled high-risk browser permissions, and `DENY` frame protection. HSTS is emitted only when `APP_ENV=production`.

Application events are structured JSON. The logger redacts secret-like fields, cookies, authorization headers, invitation tokens, customer answers/text, internal notes, fingerprints, and raw IP data before output. Do not pass request bodies or free-text metadata into logs.

## Bot-protection interface

Public submission uses a server-only, provider-independent verification interface. Local development can use the disabled-provider bypass; it is denied in preview and production. A future provider adapter must receive its credential only from a server-side environment variable, enforce the built-in timeout, and return a generic failure on timeout or provider errors. No provider account or client SDK is required for this foundation.

The included Turnstile adapter is server-only and verifies the provider response with a short timeout. `BOT_PROTECTION_SITE_KEY` is the only browser-safe bot value; `BOT_PROTECTION_SECRET_KEY` must remain server-only. Hosted environments require an expected hostname and action. Production refuses disabled protection, any bypass, or incomplete bot configuration. The browser challenge widget remains deliberately unconfigured until the provider supplies an approved site key.

## Email readiness

Local preview mode captures invitation delivery without sending it. SMTP mode requires server-only `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_FROM_EMAIL`, and `SMTP_FROM_NAME`; it uses bounded connection/socket timeouts and never logs recipient content, templates, or invitation tokens. Production rejects preview delivery mode. No production email is active until an approved provider credential bundle is placed in the production environment manager.

An operator may run `ALLOW_EMAIL_TEST_SEND=true npm run email:send-test -- recipient@example.test` only after intentionally configuring SMTP. It sends one simple delivery check to the supplied recipient and never runs automatically in CI or application flows.

See [operations and recovery](operations.md) for migration, backup, retention, incident, and capacity procedures.
