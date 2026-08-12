#!/usr/bin/env bash
#
# Prove that every shared column holds the same value in both databases.
#
# Row counts are not evidence: two tables can agree on counts and disagree on
# content. For each table this hashes the full ordered content of the shared
# columns on each side and compares the digests, so a single changed character
# in any field of any row breaks the match.
#
# Usage:
#   bash scripts/db/verify-data.sh <SOURCE_URL> <TARGET_URL>
#   SRC_URL=... DST_URL=... bash scripts/db/verify-data.sh
#
# Prefer the second form when either side holds a real credential: positional
# arguments land in shell history and in `docker inspect` output. Set PGNETWORK
# when neither database is reachable through the default one; it still points at
# the phase 2 probe container for backwards compatibility.

set -euo pipefail

SRC="${1:-${SRC_URL:-}}"
DST="${2:-${DST_URL:-}}"
[[ -n "${SRC}" ]] || { printf 'ERROR: source connection string required (argument 1 or SRC_URL).\n' >&2; exit 1; }
[[ -n "${DST}" ]] || { printf 'ERROR: target connection string required (argument 2 or DST_URL).\n' >&2; exit 1; }
IMAGE="postgres:18-alpine"
NETWORK="${PGNETWORK:-container:pg17probe}"

# psql reads each URL from the container's own environment. `docker run -e VAR`
# with no value forwards the host's value, so the string never enters argv.
export PGSRC="${SRC}" PGDST="${DST}"

psql_src() { docker run --rm --network "${NETWORK}" -e PGSRC "${IMAGE}" sh -c 'exec psql "$PGSRC" "$@"' -- "$@"; }
psql_dst() { docker run --rm --network "${NETWORK}" -e PGDST "${IMAGE}" sh -c 'exec psql "$PGDST" "$@"' -- "$@"; }

# The table list has to arrive through a plain assignment. `mapfile < <(cmd)`
# discards cmd's exit status, so an unreachable database produced an empty list,
# an empty loop, and a cheerful PASS over nothing.
TABLES_RAW="$(psql_dst -tAc "SELECT table_name FROM information_schema.tables
                             WHERE table_schema='public' AND table_type='BASE TABLE'
                               AND table_name <> 'payload_migrations'
                             ORDER BY table_name;" | tr -d '\r')" \
  || { printf 'ERROR: could not list the tables of the target database.\n' >&2; exit 1; }

mapfile -t TABLES < <(printf '%s\n' "${TABLES_RAW}" | sed '/^$/d')

[[ "${#TABLES[@]}" -gt 0 ]] || {
  printf 'ERROR: the target has no tables in schema public, so there is nothing to compare.\n' >&2
  printf '       That is a failure, not a pass. Was `payload migrate` run against it?\n' >&2
  exit 1
}

printf '%-34s %8s %8s  %s\n' "TABLE" "SOURCE" "TARGET" "CONTENT"
printf '%-34s %8s %8s  %s\n' "----------------------------------" "--------" "--------" "-------"

MISMATCH=0
TOTAL_ROWS=0
COMPARED=0

for T in "${TABLES[@]}"; do
  [[ -n "${T}" ]] || continue

  HAS=$(psql_src -tAc "SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='${T}' LIMIT 1;" | tr -d '\r')
  [[ "${HAS}" == "1" ]] || continue

  SRC_COLS=$(psql_src -tAc "SELECT column_name FROM information_schema.columns
                            WHERE table_schema='public' AND table_name='${T}';" | tr -d '\r')
  DST_COLS=$(psql_dst -tAc "SELECT column_name FROM information_schema.columns
                            WHERE table_schema='public' AND table_name='${T}'
                            ORDER BY ordinal_position;" | tr -d '\r')
  COLS=""
  while IFS= read -r C; do
    [[ -n "${C}" ]] || continue
    grep -qx -- "${C}" <<< "${SRC_COLS}" && COLS+="${COLS:+,}\"${C}\""
  done <<< "${DST_COLS}"
  [[ -n "${COLS}" ]] || continue

  # Order by the rendered row itself, so the digest does not depend on physical
  # row order or on the table having a usable primary key.
  Q="SELECT count(*)::text || ' ' || COALESCE(md5(string_agg(r::text, E'\\n' ORDER BY r::text)), 'empty')
     FROM (SELECT ${COLS} FROM public.\"${T}\") r;"

  S=$(psql_src -tAc "${Q}" | tr -d '\r')
  D=$(psql_dst -tAc "${Q}" | tr -d '\r')

  SN="${S%% *}"; SH="${S##* }"
  DN="${D%% *}"; DH="${D##* }"

  COMPARED=$(( COMPARED + 1 ))

  if [[ "${SH}" == "${DH}" && "${SN}" == "${DN}" ]]; then
    printf '%-34s %8s %8s  %s\n' "${T}" "${SN}" "${DN}" "identical"
    TOTAL_ROWS=$(( TOTAL_ROWS + SN ))
  else
    printf '%-34s %8s %8s  %s\n' "${T}" "${SN}" "${DN}" "*** MISMATCH ***"
    MISMATCH=$(( MISMATCH + 1 ))
  fi
done

echo
if [[ "${COMPARED}" -eq 0 ]]; then
  # Every table was skipped. Silence is not agreement.
  echo "FAIL - no table was actually compared. Refusing to report a pass."
  exit 1
elif [[ "${MISMATCH}" -eq 0 ]]; then
  echo "PASS - every shared column matches, ${TOTAL_ROWS} rows verified across ${COMPARED} tables."
else
  echo "FAIL - ${MISMATCH} table(s) differ."
  exit 1
fi
