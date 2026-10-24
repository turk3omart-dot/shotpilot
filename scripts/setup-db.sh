#!/usr/bin/env bash
# Creates the local dev + test databases (PostgreSQL 15+) and applies migrations.
# Usage: pnpm db:setup        (uses the `postgres` superuser via psql)
set -euo pipefail
PSQL=${PSQL:-psql}
SUPER=${PGSUPERUSER:-postgres}
run() { if [ "$(id -un)" = "root" ] && id postgres >/dev/null 2>&1; then su postgres -c "$1"; else eval "$1"; fi; }
run "$PSQL -U $SUPER -tc \"SELECT 1 FROM pg_roles WHERE rolname='shotpilot'\" | grep -q 1 || $PSQL -U $SUPER -c \"CREATE ROLE shotpilot LOGIN PASSWORD 'shotpilot' CREATEDB\""
for db in shotpilot_dev shotpilot_test; do
  run "$PSQL -U $SUPER -tc \"SELECT 1 FROM pg_database WHERE datname='$db'\" | grep -q 1 || $PSQL -U $SUPER -c \"CREATE DATABASE $db OWNER shotpilot\""
done
pnpm --filter @shotpilot/database migrate
echo "Databases ready."
