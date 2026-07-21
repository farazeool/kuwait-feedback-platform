#!/bin/sh
set -eu

if [ ! -d .next/static ]; then
  echo "Build output is required before client bundle scanning." >&2
  exit 1
fi

matches=$(rg --hidden --line-number \
  '(SUPABASE_SERVICE_ROLE_KEY|SMTP_PASSWORD|BOT_PROTECTION_SECRET_KEY|SUBMISSION_FINGERPRINT_SECRET|sb_secret_[A-Za-z0-9_-]{20,})' \
  .next/static || true)

if [ -n "$matches" ]; then
  echo "Server-only secret identifier found in a client bundle:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "No server-only secret identifiers found in client bundles."
