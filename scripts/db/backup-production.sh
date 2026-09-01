#!/usr/bin/env bash
#
# Back up the production Supabase database.
#
# Read-only against Supabase. Produces three artifacts under ./backups:
#   * supabase-schema-<ts>.sql   Schema only.
#   * supabase-full-<ts>.dump    public schema, data included, custom format —
#                                 the input extract-real-catalogue.mjs expects.
#   * supabase-complete-<ts>.dump  All schemas, owners and grants kept, for
#                                 disaster recovery.
#
# Requires Docker. No local Postgres install needed: the client version is
# pinned to the server's major version, which pg_dump demands.
#
# Supabase signs its certificate with a private CA (see the comment on
# SUPABASE_CA_CERT in src/payload.config.ts) — trusting the system trust
# store, which worked for Neon, does not work here. This script needs the
# actual CA, the same way the app does:
#
#   ! vercel env pull .env.production.local --environment=production
#
# That file carries both DATABASE_URL and SUPABASE_CA_CERT for production.
#
# Usage:
#   bash scripts/db/backup-production.sh
#
# DATABASE_URL and SUPABASE_CA_CERT are read from the environment, or from
# .env.production.local, or from .env (in that order). Neither is ever
# printed and neither is ever passed on a command line.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
BACKUP_DIR="${REPO_ROOT}/backups"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"

log() { printf '  %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

# A shell-only parser (sed/awk) reads one line at a time, which breaks on
# SUPABASE_CA_CERT: a PEM certificate is a quoted value spanning many lines,
# the same multi-line-in-quotes convention Next.js documents for private keys.
# dotenv (already a project dependency) parses that correctly, and unlike
# @next/env it never expands `$` — see the credential note in CLAUDE.md about
# @next/env eating a `$` in a value; a CA certificate cannot contain one, but
# there is no reason to route through the expander at all here.
read_var_from_env_files() {
  local name="$1"
  local file value
  for file in "${REPO_ROOT}/.env.production.local" "${REPO_ROOT}/.env"; do
    [[ -f "${file}" ]] || continue
    value="$(node -e '
      const fs = require("fs")
      const path = require("path")
      const dotenv = require(path.join(process.argv[1], "node_modules", "dotenv"))
      const parsed = dotenv.parse(fs.readFileSync(process.argv[2], "utf8"))
      process.stdout.write(parsed[process.argv[3]] || "")
    ' "${REPO_ROOT}" "${file}" "${name}" 2>/dev/null)"
    [[ -n "${value}" ]] || continue
    printf '%s' "${value}"
    return 0
  done
  return 1
}

# --- Resolve the connection string and CA -----------------------------------

if [[ -z "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(read_var_from_env_files DATABASE_URL)" \
    || die "DATABASE_URL is unset and not found in .env.production.local or .env. Run: vercel env pull .env.production.local --environment=production"
fi
[[ -n "${DATABASE_URL}" ]] || die "DATABASE_URL resolved to an empty value."

if [[ -z "${SUPABASE_CA_CERT:-}" ]]; then
  SUPABASE_CA_CERT="$(read_var_from_env_files SUPABASE_CA_CERT)" \
    || die "SUPABASE_CA_CERT is unset and not found in .env.production.local or .env. Run: vercel env pull .env.production.local --environment=production"
fi
[[ -n "${SUPABASE_CA_CERT}" ]] || die "SUPABASE_CA_CERT resolved to an empty value."

# Supabase's Transaction pooler (port 6543) rejects pg_dump the way Neon's did
# — no session/prepared-statement support. The Session pooler (port 5432, same
# host) is fine: it holds one backend per connection like a direct session
# does. It also matters here for a second, unrelated reason: the direct host
# (db.<project-ref>.supabase.co) is IPv6-only, and networks without IPv6
# egress (this one included — see any probe-error-*.log with "Network
# unreachable") cannot reach it at all. The Session pooler is IPv4, so it is
# the fix for that too. Get it from Supabase dashboard -> Connect -> Session
# pooler (not Transaction).
if [[ "${DATABASE_URL}" == *"pooler.supabase.com"* ]] && [[ "${DATABASE_URL}" == *":6543"* ]]; then
  die "DATABASE_URL points at the Supabase Transaction pooler (port 6543), which pg_dump does not support. Use the Session pooler (port 5432) connection string instead — Supabase dashboard -> Connect -> Session pooler."
fi

CERT_DIR="$(mktemp -d)"
trap 'rm -rf "${CERT_DIR}"' EXIT
CA_FILE="${CERT_DIR}/ca.pem"
printf '%s' "${SUPABASE_CA_CERT}" > "${CA_FILE}"
chmod 600 "${CA_FILE}"

# Strip any ssl* parameters already on the URL, then pin verify-full against
# the mounted CA — same reasoning as SSL_URL_PARAMETERS in payload.config.ts:
# a stray sslmode on the URL silently overrides what is set here otherwise.
strip_ssl_params() {
  local url="$1" base query kept=() part key joined
  base="${url%%\?*}"
  query="${url#*\?}"
  [[ "${query}" == "${url}" ]] && { printf '%s' "${url}"; return; }
  IFS='&' read -ra parts <<< "${query}"
  for part in "${parts[@]}"; do
    key="${part%%=*}"
    case "${key}" in
      ssl|sslmode|sslrootcert|sslcert|sslkey) continue ;;
    esac
    kept+=("${part}")
  done
  if [[ ${#kept[@]} -eq 0 ]]; then
    printf '%s' "${base}"
  else
    joined="$(IFS='&'; printf '%s' "${kept[*]}")"
    printf '%s?%s' "${base}" "${joined}"
  fi
}

PGURL="$(strip_ssl_params "${DATABASE_URL}")"
if [[ "${PGURL}" == *"?"* ]]; then
  PGURL="${PGURL}&sslmode=verify-full&sslrootcert=/certs/ca.pem"
else
  PGURL="${PGURL}?sslmode=verify-full&sslrootcert=/certs/ca.pem"
fi
export PGURL

DOCKER_CERT_MOUNT=(-v "${CERT_DIR}:/certs:ro")

# --- Detect the server major version ----------------------------------------

mkdir -p "${BACKUP_DIR}"
PROBE_LOG="${BACKUP_DIR}/probe-error-${TIMESTAMP}.log"

echo "==> Probing the production database"
PROBE_IMAGE="postgres:17-alpine"
SERVER_VERSION_NUM="$(
  docker run --rm -e PGURL "${DOCKER_CERT_MOUNT[@]}" "${PROBE_IMAGE}" \
    psql "${PGURL}" -tAc "SHOW server_version_num" 2>"${PROBE_LOG}" | tr -d '[:space:]'
)" || die "Could not reach production. The real error (may include the host, never the password) is in ${PROBE_LOG} — open it yourself, it never needs to be pasted anywhere."
[[ -s "${PROBE_LOG}" ]] && rm -f "${PROBE_LOG}"
[[ "${SERVER_VERSION_NUM}" =~ ^[0-9]+$ ]] || die "Unexpected server_version_num: '${SERVER_VERSION_NUM}'"

PG_MAJOR=$(( SERVER_VERSION_NUM / 10000 ))
PG_IMAGE="postgres:${PG_MAJOR}-alpine"
log "Server is Postgres ${PG_MAJOR} — using ${PG_IMAGE} for the dump."

# --- Record what we expect the backup to contain ----------------------------

echo "==> Counting rows in the tables that must survive"
docker run --rm -e PGURL "${DOCKER_CERT_MOUNT[@]}" "${PG_IMAGE}" psql "${PGURL}" -v ON_ERROR_STOP=1 -c "
  SELECT relname AS table_name, n_live_tup AS approx_rows
  FROM pg_stat_user_tables
  WHERE schemaname = 'public'
  ORDER BY n_live_tup DESC, relname;
" | tee "${BACKUP_DIR}/rowcounts-${TIMESTAMP}.txt"

# --- Dump --------------------------------------------------------------------

# Docker Desktop needs a Windows-style host path; pwd -W provides it under Git Bash.
HOST_BACKUP_DIR="$(cd "${BACKUP_DIR}" && { pwd -W 2>/dev/null || pwd; })"
HOST_CERT_DIR="$(cd "${CERT_DIR}" && { pwd -W 2>/dev/null || pwd; })"

SCHEMA_FILE="supabase-schema-${TIMESTAMP}.sql"
FULL_FILE="supabase-full-${TIMESTAMP}.dump"
COMPLETE_FILE="supabase-complete-${TIMESTAMP}.dump"

# --no-owner/--no-privileges: production's role grants do not exist in the
# local scratch database and would fail on restore.
COMMON_FLAGS=(--no-owner --no-privileges --schema=public)

echo "==> Dumping schema"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" -v "${HOST_CERT_DIR}:/certs:ro" "${PG_IMAGE}" \
  pg_dump "${PGURL}" "${COMMON_FLAGS[@]}" --schema-only -f "/backups/${SCHEMA_FILE}"
log "${SCHEMA_FILE}"

echo "==> Dumping public schema + data (input for extract-real-catalogue.mjs)"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" -v "${HOST_CERT_DIR}:/certs:ro" "${PG_IMAGE}" \
  pg_dump "${PGURL}" "${COMMON_FLAGS[@]}" -Fc -f "/backups/${FULL_FILE}"
log "${FULL_FILE}"

# The two dumps above are scoped to `public` and stripped of ownership, which
# is wrong for disaster recovery — it silently omits every other schema. This
# third dump is the real "restore production as it was" copy.
echo "==> Dumping the COMPLETE database (all schemas, owners and grants)"
MSYS_NO_PATHCONV=1 docker run --rm -e PGURL \
  -v "${HOST_BACKUP_DIR}:/backups" -v "${HOST_CERT_DIR}:/certs:ro" "${PG_IMAGE}" \
  pg_dump "${PGURL}" -Fc -f "/backups/${COMPLETE_FILE}"
log "${COMPLETE_FILE}"

# --- Verify the artifacts ----------------------------------------------------

echo "==> Verifying"
[[ -s "${BACKUP_DIR}/${SCHEMA_FILE}" ]] || die "Schema dump is empty."
[[ -s "${BACKUP_DIR}/${FULL_FILE}" ]]   || die "Full dump is empty."

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
echo "Done. Artifacts in ./backups (gitignored):"
( cd "${BACKUP_DIR}" && ls -lh "${SCHEMA_FILE}" "${FULL_FILE}" "${COMPLETE_FILE}" "rowcounts-${TIMESTAMP}.txt" "checksums-${TIMESTAMP}.txt" )
