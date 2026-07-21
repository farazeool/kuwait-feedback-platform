#!/bin/sh
set -eu

previous=""
seen=""
for path in $(find supabase/migrations -maxdepth 1 -type f -name '*.sql' -print | sort); do
  name=$(basename "$path")
  stamp=${name%%_*}
  case "$name" in
    [0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9][0-9]_*.sql) ;;
    *) echo "Invalid migration filename: $name" >&2; exit 1 ;;
  esac
  if [ "$stamp" \< "$previous" ]; then
    echo "Migration timestamps are not ordered: $name" >&2
    exit 1
  fi
  case " $seen " in
    *" $stamp "*) echo "Duplicate migration timestamp: $stamp" >&2; exit 1 ;;
  esac
  seen="$seen $stamp"
  previous=$stamp
done

echo "Migration filenames are valid and ordered."
