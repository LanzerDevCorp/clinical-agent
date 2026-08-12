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
#   status             Read-only. `payload migrate:status` against Supabase.
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
  check|schema|status|load|verify) ;;
  *) die "Unknown step '${STEP}'. Use check (default), schema, status, load or verify." ;;
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

# The two TLS settings are decided together, never independently. libpq 18
# rejects a root certificate paired with a non-verifying sslmode outright:
#   weak sslmode "require" may not be used with sslrootcert=system
# so a URL that arrives without a query string gets verify-full and a root,
# never require plus a root.
#
# $2 is what sslrootcert should point at: "system" for a provider whose CA the
# image already trusts, which is Neon, or a path inside the container for one
# whose CA it does not, which is Supabase's pooler.
normalise() {
  local url="${1/-pooler./.}" root="${2:-system}"
  if [[ "${url}" != *"sslmode="* ]]; then
    if [[ "${url}" == *"?"* ]]; then url="${url}&sslmode=verify-full"; else url="${url}?sslmode=verify-full"; fi
  fi
  if [[ "${url}" != *"sslrootcert="* && "${url}" == *"sslmode=verify"* ]]; then
    if [[ "${url}" == *"?"* ]]; then url="${url}&sslrootcert=${root}"; else url="${url}?sslrootcert=${root}"; fi
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

# Supabase signs its pooler certificate with a CA that no image trust store
# carries, and the pooler offers no SCRAM channel binding either, so verify-full
# against the downloaded CA is the only setting that authenticates the server.
# Both were measured, not assumed: with sslrootcert=system the handshake fails
# with "certificate verify failed", and channel_binding=require is refused by
# the server.
CA_FILE="${SUPABASE_CA_CERT:-}"
if [[ -z "${CA_FILE}" ]]; then
  # Browsers rename a downloaded certificate freely, so accept the usual spellings.
  for candidate in "${REPO_ROOT}"/certs/*.crt "${REPO_ROOT}"/certs/*.pem \
                   "${REPO_ROOT}"/certs/*.cer "${REPO_ROOT}"/certs/*.txt; do
    [[ -f "${candidate}" ]] && { CA_FILE="${candidate}"; break; }
  done
fi
if [[ -z "${CA_FILE}" || ! -f "${CA_FILE}" ]]; then
  printf 'ERROR: no CA certificate found for the target.\n' >&2
  printf '       Supabase dashboard -> Settings -> Database -> SSL Configuration\n' >&2
  printf '       -> Download certificate, then save it under %s/certs/\n' "${REPO_ROOT}" >&2
  printf '       or point SUPABASE_CA_CERT at the file.\n' >&2
  exit 1
fi

CA_DIR="$(cd "$(dirname "${CA_FILE}")" && pwd)"
CA_NAME="$(basename "${CA_FILE}")"
export PGCERT_DIR="${CA_DIR}"

# The same certificate needs two spellings. psql runs inside a container and
# sees the file on its mount point; `payload migrate` runs on the host under
# Node and needs a native path. Handing Node the container path made it look for
# C:\certs\<name> and fail with ENOENT before it reached the database.
CA_HOST_PATH="$(cd "${CA_DIR}" && { pwd -W 2>/dev/null || pwd; })/${CA_NAME}"

SRC_RAW="${SRC}"
DST_RAW="${DST}"

# `payload migrate` reads its URL through @next/env, whose expand() step runs
# dotenv-expand over process.env values - including ones set in the shell - and
# writes the result back. A literal $ in a credential is read as a variable
# reference and silently disappears: a 17-character password reached Postgres as
# 8, which surfaces only as "password authentication failed". psql never sees it
# because it reads the URL directly, so every check here would pass while the
# migration failed.
for pair in "DATABASE_URL=${SRC_RAW}" "SUPABASE_DATABASE_URL=${DST_RAW}"; do
  case "${pair#*=}" in
    *'$'*)
      printf 'ERROR: %s contains a literal $.\n' "${pair%%=*}" >&2
      printf '       @next/env expands it as a variable reference and truncates the value\n' >&2
      printf '       before Payload connects, while psql is unaffected.\n' >&2
      printf '       Percent-encode it in .env: $ becomes %%24, the way @ becomes %%40.\n' >&2
      exit 1 ;;
  esac
done

SRC="$(normalise "${SRC}")"
DST="$(normalise "${DST_RAW}" "/certs/${CA_NAME}")"
DST_FOR_NODE="$(normalise "${DST_RAW}" "${CA_HOST_PATH}")"

SRC_HOST="$(host_of "${SRC}")"
DST_HOST="$(host_of "${DST}")"
[[ "${SRC_HOST}" != "${DST_HOST}" ]] || \
  die "Source and target resolve to the same host (${SRC_HOST}). Refusing to run."

export PGSRC="${SRC}" PGDST="${DST}" SRC_URL="${SRC}" DST_URL="${DST}"

# Both databases are remote, so the phase 2 default of joining the local probe
# container's network namespace does not apply.
export PGNETWORK="${PGNETWORK:-bridge}"

CERT_MOUNT=(-v "${PGCERT_DIR}:/certs:ro")

psql_src() { MSYS_NO_PATHCONV=1 docker run --rm --network "${PGNETWORK}" "${CERT_MOUNT[@]}" -e PGSRC "${IMAGE}" sh -c 'exec psql "$PGSRC" "$@"' -- "$@"; }
psql_dst() { MSYS_NO_PATHCONV=1 docker run --rm --network "${PGNETWORK}" "${CERT_MOUNT[@]}" -e PGDST "${IMAGE}" sh -c 'exec psql "$PGDST" "$@"' -- "$@"; }

# Only the query string is printed. Everything before it is a credential.
echo "==> Source (Neon):     ${SRC_HOST}"
echo "    TLS:               ${SRC#*\?}"
echo "==> Target (Supabase): ${DST_HOST}"
echo "    TLS:               ${DST#*\?}"
echo "==> CA certificate:    ${CA_NAME}"
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
  ( cd "${REPO_ROOT}" && DATABASE_URL="${DST_FOR_NODE}" pnpm payload migrate )
  echo
  echo "Confirm it took:     bash scripts/db/phase3-load-supabase.sh status"
  echo "Then load the rows:  bash scripts/db/phase3-load-supabase.sh load"
  exit 0
fi

# --- status ------------------------------------------------------------------

if [[ "${STEP}" == "status" ]]; then
  echo "==> Migration status on Supabase"
  ( cd "${REPO_ROOT}" && DATABASE_URL="${DST_FOR_NODE}" pnpm payload migrate:status )
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
