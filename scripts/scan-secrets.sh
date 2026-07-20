#!/bin/sh
set -eu

matches=$(
  rg --hidden --line-number \
    --glob '!.git/**' \
    --glob '!node_modules/**' \
    --glob '!.next/**' \
    --glob '!.env*' \
    --glob '!package-lock.json' \
    '(sb_secret_[A-Za-z0-9_-]{20,}|sbp_[A-Za-z0-9_-]{20,}|gh[pousr]_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|eyJhbGciOiJ[A-Za-z0-9_-]{20,})' \
    . || true
)

if [ -n "$matches" ]; then
  echo "Potential committed secret material detected:" >&2
  echo "$matches" >&2
  exit 1
fi

echo "No high-confidence secret patterns found in source-controlled paths."
