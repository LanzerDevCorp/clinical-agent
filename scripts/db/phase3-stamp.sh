#!/usr/bin/env bash
#
# Phase 3 — Stamp payload_migrations on Neon for the new baseline.
#
# Runs scripts/db/phase3-stamp-migrations.sql, which swaps the 9 rows naming the
# migrations deleted in 726da74 for the two that exist in src/migrations/index.ts.
#
# This is the first write this project makes against Neon. It is therefore split
# into two explicit modes; the write never happens by default:
#
#   preflight  (default)  Read-only. Prints the current payload_migrations rows.
#   apply                 Runs the transaction. Requires the literal word.
#
# The SQL guards itself: it aborts unless it finds exactly the 9 expected rows,
# and again unless exactly 2 rows remain afterwards. Either way the transaction
# rolls back and Neon is left untouched.
#
# Requires Docker. Restore point if anything goes wrong: backups/ 20260812T164706Z.
#
# Usage:
#   bash scripts/db/phase3-stamp.sh
#   bash scripts/db/phase3-stamp.sh apply
#
# DATABASE_URL is read from the environment, or from .env if unset. It is never
# printed and never passed on a command line.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SQL_FILE="${REPO_ROOT}/scripts/db/phase3-stamp-migrations.sql"
MODE="${1:-preflight}"

log() { printf '  %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

case "${MODE}" in
  preflight|apply) ;;
  *) die "Unknown mode '${MODE}'. Use 'preflight' (default) or 'apply'." ;;
esac
[[ -f "${SQL_FILE}" ]] || die "Missing ${SQL_FILE}"

# --- Resolve the connection string ------------------------------------------

if [[ -z "${DATABASE_URL:-}" ]]; then
  ENV_FILE="${REPO_ROOT}/.env"
  [[ -f "${ENV_FILE}" ]] || die "DATABASE_URL is unset and ${ENV_FILE} does not exist."
  # Extract without sourcing, so nothing else in .env gets executed or exported.
  DATABASE_URL="$(sed -n 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//p' "${ENV_FILE}" | tail -n 1)"
  DATABASE_URL="${DATABASE_URL%\"}"; DATABASE_URL="${DATABASE_URL#\"}"
  DATABASE_URL="${DATABASE_URL%\'}"; DATABASE_URL="${DATABASE_URL#\'}"
  DATABASE_URL="${DATABASE_URL%$'\r'}"
fi
[[ -n "${DATABASE_URL}" ]] || die "DATABASE_URL resolved to an empty value."

# Use the direct endpoint, matching every other script in this phase.
PGURL="${DATABASE_URL/-pooler./.}"
if [[ "${PGURL}" != "${DATABASE_URL}" ]]; then
  log "Pooled endpoint detected; rewritten to the direct one."
fi

# Neon requires TLS, and the container has no ~/.postgresql/root.crt.
if [[ "${PGURL}" != *"sslmode="* ]]; then
  if [[ "${PGURL}" == *"?"* ]]; then PGURL="${PGURL}&sslmode=require"; else PGURL="${PGURL}?sslmode=require"; fi
fi
if [[ "${PGURL}" != *"sslrootcert="* ]]; then
  if [[ "${PGURL}" == *"?"* ]]; then PGURL="${PGURL}&sslrootcert=system"; else PGURL="${PGURL}?sslrootcert=system"; fi
fi
export PGURL

PG_IMAGE="postgres:18-alpine"

# psql reads the URL from the container's environment, never from argv.
psql_neon() { docker run --rm -i -e PGURL "${PG_IMAGE}" sh -c 'exec psql "$PGURL" "$@"' -- "$@"; }

# --- Preflight: what is in the table right now -------------------------------

echo "==> Current payload_migrations rows on Neon (read-only)"
psql_neon -v ON_ERROR_STOP=1 \
  -c "SELECT id, name, batch, created_at FROM public.payload_migrations ORDER BY id;" \
  </dev/null || die "Could not reach Neon. Check DATABASE_URL and your network."

if [[ "${MODE}" == "preflight" ]]; then
  echo
  echo "Preflight only. Nothing was written."
  echo "Expected above: 9 rows with the old migration names."
  echo "To stamp, re-run:  bash scripts/db/phase3-stamp.sh apply"
  exit 0
fi

# --- Apply -------------------------------------------------------------------

echo
echo "==> Stamping payload_migrations (single transaction)"
psql_neon -v ON_ERROR_STOP=1 -f - < "${SQL_FILE}"

echo
echo "Stamped. Expected above: DELETE 9, INSERT 0 2, COMMIT, then 2 rows at batch 1."
echo "Now verify with Payload's own machinery:  pnpm payload migrate:status"
