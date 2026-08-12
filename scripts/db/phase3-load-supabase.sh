#!/usr/bin/env bash
#
# Phase 3 step 2 — Load the Neon data into Supabase.
#
# Resolves both connection strings from .env without sourcing it, normalises
# them for the containerised psql, and drives the three steps in order. The
# direction is hard-wired: Neon (DATABASE_URL) is always the source, Supabase
# (SUPABASE_DATABASE_URL) always the target. Neither can be swapped by a typo
# on the command line, because neither is typed on the command line.
#
# Steps:
#   check   (default)  Read-only. Probes both databases and prints what it found.
#   schema             `payload migrate` against Supabase. Creates the schema there.
#   load               Copies the rows. Writes to Supabase only.
#   verify             Hashes every shared column on both sides and compares.
#
# Nothing here writes to Neon. The only write target is Supabase.
#
# Usage:
#   bash scripts/db/phase3-load-supabase.sh
#   bash scripts/db/phase3-load-supabase.sh schema
#   bash scripts/db/phase3-load-supabase.sh load
#   bash scripts/db/phase3-load-supabase.sh verify

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${REPO_ROOT}/.env"
IMAGE="postgres:18-alpine"
STEP="${1:-check}"

log() { printf '  %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

case "${STEP}" in
  check|schema|load|verify) ;;
  *) die "Unknown step '${STEP}'. Use check (default), schema, load or verify." ;;
esac

# --- Resolve both connection strings ----------------------------------------

# Read a single key out of .env without sourcing it, so nothing else in the
# file gets executed or exported.
read_env_key() {
  local key="$1" value
  [[ -f "${ENV_FILE}" ]] || die "${ENV_FILE} does not exist."
  value="$(sed -n "s/^[[:space:]]*${key}[[:space:]]*=[[:space:]]*//p" "${ENV_FILE}" | tail -n 1)"
  value="${value%\"}"; value="${value#\"}"
  value="${value%\'}"; value="${value#\'}"
  value="${value%$'\r'}"
  printf '%s' "${value}"
}

# Direct endpoint, TLS, and a trust store the container actually has.
normalise() {
  local url="${1/-pooler./.}"
  if [[ "${url}" != *"sslmode="* ]]; then
    if [[ "${url}" == *"?"* ]]; then url="${url}&sslmode=require"; else url="${url}?sslmode=require"; fi
  fi
  if [[ "${url}" != *"sslrootcert="* ]]; then
    if [[ "${url}" == *"?"* ]]; then url="${url}&sslrootcert=system"; else url="${url}?sslrootcert=system"; fi
  fi
  printf '%s' "${url}"
}

# Host only, for the sanity check below and for anything printed to the screen.
host_of() {
  local rest="${1#*://}"
  rest="${rest#*@}"
  rest="${rest%%/*}"
  rest="${rest%%\?*}"
  printf '%s' "${rest}"
}

SRC="${DATABASE_URL:-$(read_env_key DATABASE_URL)}"
DST="${SUPABASE_DATABASE_URL:-$(read_env_key SUPABASE_DATABASE_URL)}"
[[ -n "${SRC}" ]] || die "DATABASE_URL resolved to an empty value."
[[ -n "${DST}" ]] || die "SUPABASE_DATABASE_URL resolved to an empty value. Add it to ${ENV_FILE}."

SRC="$(normalise "${SRC}")"
DST="$(normalise "${DST}")"

SRC_HOST="$(host_of "${SRC}")"
DST_HOST="$(host_of "${DST}")"
[[ "${SRC_HOST}" != "${DST_HOST}" ]] || \
  die "Source and target resolve to the same host (${SRC_HOST}). Refusing to run."

export PGSRC="${SRC}" PGDST="${DST}" SRC_URL="${SRC}" DST_URL="${DST}"

# Both databases are remote, so the phase 2 default of joining the local probe
# container's network namespace does not apply.
export PGNETWORK="${PGNETWORK:-bridge}"

psql_src() { docker run --rm --network "${PGNETWORK}" -e PGSRC "${IMAGE}" sh -c 'exec psql "$PGSRC" "$@"' -- "$@"; }
psql_dst() { docker run --rm --network "${PGNETWORK}" -e PGDST "${IMAGE}" sh -c 'exec psql "$PGDST" "$@"' -- "$@"; }

echo "==> Source (Neon):     ${SRC_HOST}"
echo "==> Target (Supabase): ${DST_HOST}"
echo "==> Docker network:    ${PGNETWORK}"
echo

# --- check -------------------------------------------------------------------

if [[ "${STEP}" == "check" ]]; then
  echo "==> Reachability and versions (read-only)"
  log "neon:     $(psql_src -tAc 'SHOW server_version;' </dev/null | tr -d '\r')" \
    || die "Could not reach Neon."
  log "supabase: $(psql_dst -tAc 'SHOW server_version;' </dev/null | tr -d '\r')" \
    || die "Could not reach Supabase. Check SUPABASE_DATABASE_URL (Direct tab, session pooler, port 5432)."

  echo
  echo "==> Tables in public, per side"
  log "neon:     $(psql_src -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" </dev/null | tr -d '\r')"
  log "supabase: $(psql_dst -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE';" </dev/null | tr -d '\r')"

  echo
  echo "==> Clinical row counts on Neon, for later comparison"
  psql_src -c "SELECT 'products' AS t, count(*) FROM public.products
               UNION ALL SELECT 'protocols', count(*) FROM public.protocols
               UNION ALL SELECT 'clinical_indications', count(*) FROM public.clinical_indications
               UNION ALL SELECT 'post_care_notes', count(*) FROM public.post_care_notes
               UNION ALL SELECT 'safety_warnings', count(*) FROM public.safety_warnings
               UNION ALL SELECT 'users', count(*) FROM public.users
               ORDER BY 1;" </dev/null

  echo
  echo "Read-only. Nothing was written."
  echo "Expected on Neon: products 13, protocols 13, clinical_indications 27,"
  echo "post_care_notes 19, safety_warnings 14, users 3."
  echo "Next, once Supabase looks empty:  bash scripts/db/phase3-load-supabase.sh schema"
  exit 0
fi

# --- schema ------------------------------------------------------------------

if [[ "${STEP}" == "schema" ]]; then
  echo "==> Applying the Payload schema to Supabase"
  echo "    (DATABASE_URL is overridden for this command only; .env is not touched,"
  echo "     and a shell variable wins over .env under @next/env.)"
  ( cd "${REPO_ROOT}" && DATABASE_URL="${DST}" pnpm payload migrate )
  echo
  echo "Now confirm both migrations report Ran: Yes on the target:"
  echo "  DATABASE_URL=\"\$SUPABASE_DATABASE_URL\" pnpm payload migrate:status"
  echo "Then load the rows:  bash scripts/db/phase3-load-supabase.sh load"
  exit 0
fi

# --- load --------------------------------------------------------------------

if [[ "${STEP}" == "load" ]]; then
  echo "==> Copying rows Neon -> Supabase"
  bash "${REPO_ROOT}/scripts/db/migrate-data.sh"
  echo
  echo "Next:  bash scripts/db/phase3-load-supabase.sh verify"
  exit 0
fi

# --- verify ------------------------------------------------------------------

echo "==> Comparing every shared column by digest"
bash "${REPO_ROOT}/scripts/db/verify-data.sh"
