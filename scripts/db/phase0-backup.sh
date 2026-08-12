#!/usr/bin/env bash
#
# Phase 0 — Back up the production Neon database before the Supabase migration.
#
# Read-only against Neon. Produces two artifacts under ./backups:
#   * neon-schema-<ts>.sql   Schema only. This is the source of truth the new
#                            Payload baseline migration must reproduce exactly.
#   * neon-full-<ts>.dump    Schema + data, custom format, for pg_restore.
#
# Requires Docker. No local Postgres install needed: the client version is
# pinned to the server's major version, which pg_dump demands.
#
# Usage:
#   bash scripts/db/phase0-backup.sh
#
# DATABASE_URL is read from the environment, or from .env if unset. It is never
# printed and never passed on a command line.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log() { printf '  %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

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

# Neon rejects pg_dump over its pooled endpoint. Force the direct one.
PGURL="${DATABASE_URL/-pooler./.}"
if [[ "${PGURL}" != "${DATABASE_URL}" ]]; then
  log "Pooled endpoint detected; rewritten to the direct one (pg_dump requirement)."
fi

# Neon requires TLS.
if [[ "${PGURL}" != *"sslmode="* ]]; then
  if [[ "${PGURL}" == *"?"* ]]; then PGURL="${PGURL}&sslmode=require"; else PGURL="${PGURL}?sslmode=require"; fi
fi

# The container has no ~/.postgresql/root.crt, so a verify-* sslmode fails unless
# libpq is pointed at the image's system trust store.
if [[ "${PGURL}" != *"sslrootcert="* ]]; then
  if [[ "${PGURL}" == *"?"* ]]; then PGURL="${PGURL}&sslrootcert=system"; else PGURL="${PGURL}?sslrootcert=system"; fi
fi
export PGURL

# --- Detect the server major version ----------------------------------------

echo "==> Probing the Neon server"
PROBE_IMAGE="postgres:17-alpine"
SERVER_VERSION_NUM="$(
  docker run --rm -e PGURL "${PROBE_IMAGE}" \
    psql "${PGURL}" -tAc "SHOW server_version_num" 2>/dev/null | tr -d '[:space:]'
)" || die "Could not reach Neon. Check DATABASE_URL and your network."
[[ "${SERVER_VERSION_NUM}" =~ ^[0-9]+$ ]] || die "Unexpected server_version_num: '${SERVER_VERSION_NUM}'"

PG_MAJOR=$(( SERVER_VERSION_NUM / 10000 ))
PG_IMAGE="postgres:${PG_MAJOR}-alpine"
log "Server is Postgres ${PG_MAJOR} — using ${PG_IMAGE} for the dump."

# --- Record what we expect the backup to contain ----------------------------

mkdir -p "${BACKUP_DIR}"

echo "==> Counting rows in the tables that must survive"
docker run --rm -e PGURL "${PG_IMAGE}" psql "${PGURL}" -v ON_ERROR_STOP=1 -c "
  SELECT relname AS table_name, n_live_tup AS approx_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY n_live_tup DESC, relname;
" | tee "${BACKUP_DIR}/rowcounts-${TIMESTAMP}.txt"

# --- Dump --------------------------------------------------------------------

# Docker Desktop needs a Windows-style host path; pwd -W provides it under Git Bash.
HOST_BACKUP_DIR="$(cd "${BACKUP_DIR}" && { pwd -W 2>/dev/null || pwd; })"

SCHEMA_FILE="neon-schema-${TIMESTAMP}.sql"
FULL_FILE="neon-full-${TIMESTAMP}.dump"

# --no-owner/--no-privileges: Neon's role grants do not exist in Supabase and
# would fail on restore. Both dumps use identical flags so the Phase 2 schema
# diff compares like with like.
COMMON_FLAGS=(--no-owner --no-privileges --schema=public)

echo "==> Dumping schema (source of truth for the new baseline)"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" "${PG_IMAGE}" \
  pg_dump "${PGURL}" "${COMMON_FLAGS[@]}" --schema-only -f "/backups/${SCHEMA_FILE}"
log "${SCHEMA_FILE}"

echo "==> Dumping schema + data (the safety net for the product records)"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" "${PG_IMAGE}" \
  pg_dump "${PGURL}" "${COMMON_FLAGS[@]}" -Fc -f "/backups/${FULL_FILE}"
log "${FULL_FILE}"

# The two dumps above are scoped to `public` and stripped of ownership because
# they feed the Supabase migration. That scope is wrong for disaster recovery:
# it silently omits every other schema (neon_auth among them). This third dump
# is the real "restore Neon as it was" copy - all schemas, owners and grants kept.
COMPLETE_FILE="neon-complete-${TIMESTAMP}.dump"
echo "==> Dumping the COMPLETE database (all schemas, owners and grants)"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" "${PG_IMAGE}" \
  pg_dump "${PGURL}" -Fc -f "/backups/${COMPLETE_FILE}"
log "${COMPLETE_FILE}"

# --- Verify the artifacts ----------------------------------------------------

echo "==> Verifying"
[[ -s "${BACKUP_DIR}/${SCHEMA_FILE}" ]] || die "Schema dump is empty."
[[ -s "${BACKUP_DIR}/${FULL_FILE}" ]]   || die "Full dump is empty."

# Prove the archive is readable and actually carries the drifted tables.
MSYS_NO_PATHCONV=1 docker run --rm -v "${HOST_BACKUP_DIR}:/backups" "${PG_IMAGE}" \
  pg_restore --list "/backups/${FULL_FILE}" > "${BACKUP_DIR}/toc-${TIMESTAMP}.txt" \
  || die "The full dump is not a readable pg_restore archive."

for t in clinical_indications post_care_notes safety_warnings products; do
  if grep -q "\"${t}\"" "${BACKUP_DIR}/${SCHEMA_FILE}" || grep -q " ${t} " "${BACKUP_DIR}/${SCHEMA_FILE}"; then
    log "table present: ${t}"
  else
    printf '  WARNING: table not found in schema dump: %s\n' "${t}" >&2
  fi
done

( cd "${BACKUP_DIR}" && sha256sum "${SCHEMA_FILE}" "${FULL_FILE}" "${COMPLETE_FILE}" > "checksums-${TIMESTAMP}.txt" )

echo
echo "Phase 0 complete. Artifacts in ./backups (gitignored):"
( cd "${BACKUP_DIR}" && ls -lh "${SCHEMA_FILE}" "${FULL_FILE}" "${COMPLETE_FILE}" "rowcounts-${TIMESTAMP}.txt" "checksums-${TIMESTAMP}.txt" )
echo
echo "Keep a copy off this machine before Phase 1 touches anything."
