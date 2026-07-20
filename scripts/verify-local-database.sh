#!/bin/sh
set -eu

repo_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
runtime_root="$repo_root/.local-postgres"
data_dir="$runtime_root/data"
socket_dir="$runtime_root/socket"
log_file="$runtime_root/postgres.log"
db_port="${LOCAL_DATABASE_PORT:-55432}"
# Native verification uses initdb trust authentication. The visibly fake URL
# password only satisfies clients that require a non-empty password field.
db_url="postgresql://postgres:not-used-trust-auth@127.0.0.1:${db_port}/postgres?sslmode=disable"

case "$runtime_root" in
  "$repo_root"/.local-postgres) ;;
  *)
    echo "Refusing to reset an unexpected database path: $runtime_root" >&2
    exit 1
    ;;
esac

if [ -f "$data_dir/postmaster.pid" ]; then
  pg_ctl -D "$data_dir" stop -m fast >/dev/null 2>&1 || true
fi

rm -rf "$runtime_root"
mkdir -p "$socket_dir"

initdb \
  --pgdata="$data_dir" \
  --username=postgres \
  --auth=trust \
  --no-locale \
  --encoding=UTF8 >/dev/null

cleanup() {
  if [ -f "$data_dir/postmaster.pid" ]; then
    pg_ctl -D "$data_dir" stop -m fast >/dev/null
  fi
}
trap cleanup EXIT INT TERM

pg_ctl \
  -D "$data_dir" \
  -l "$log_file" \
  -o "-h 127.0.0.1 -k $socket_dir -p $db_port" \
  start >/dev/null

psql "$db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$repo_root/supabase/tests/bootstrap_local_postgres.sql" >/dev/null

for migration in "$repo_root"/supabase/migrations/*.sql; do
  psql "$db_url" \
    --set=ON_ERROR_STOP=1 \
    --file="$migration" >/dev/null
done

psql "$db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$repo_root/supabase/seed.sql" >/dev/null

psql "$db_url" \
  --set=ON_ERROR_STOP=1 \
  --file="$repo_root/supabase/tests/rls_verification.sql" >/dev/null

if {
  command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1
} || {
  command -v podman >/dev/null 2>&1 && podman info >/dev/null 2>&1
}; then
  npx supabase gen types \
    --lang typescript \
    --db-url "$db_url" \
    > "$repo_root/src/types/database.ts"
else
  echo "Supabase type generation skipped: a Docker CLI is unavailable."
  echo "The checked-in generated-style types remain validated by TypeScript."
fi

if [ "$(psql "$db_url" --tuples-only --no-align --command="select exists (select 1 from pg_available_extensions where name = 'plpgsql_check')")" = "t" ]; then
  npx supabase db lint \
    --db-url "$db_url" \
    --level warning \
    --fail-on error
else
  echo "Supabase db lint skipped: plpgsql_check is unavailable in native PostgreSQL."
fi

echo "Local migrations, seed data, RLS verification, and all available tooling passed."
