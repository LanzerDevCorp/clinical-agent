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

set -euo pipefail

SRC="${1:?source connection string required}"
DST="${2:?target connection string required}"
IMAGE="postgres:18-alpine"
NETWORK="${PGNETWORK:-container:pg17probe}"

psql_src() { docker run --rm --network "${NETWORK}" "${IMAGE}" psql "${SRC}" "$@"; }
psql_dst() { docker run --rm --network "${NETWORK}" "${IMAGE}" psql "${DST}" "$@"; }

mapfile -t TABLES < <(
  psql_dst -tAc "SELECT table_name FROM information_schema.tables
                 WHERE table_schema='public' AND table_type='BASE TABLE'
                   AND table_name <> 'payload_migrations'
                 ORDER BY table_name;" | tr -d '\r'
)

printf '%-34s %8s %8s  %s\n' "TABLE" "SOURCE" "TARGET" "CONTENT"
printf '%-34s %8s %8s  %s\n' "----------------------------------" "--------" "--------" "-------"

MISMATCH=0
TOTAL_ROWS=0

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

  if [[ "${SH}" == "${DH}" && "${SN}" == "${DN}" ]]; then
    printf '%-34s %8s %8s  %s\n' "${T}" "${SN}" "${DN}" "identical"
    TOTAL_ROWS=$(( TOTAL_ROWS + SN ))
  else
    printf '%-34s %8s %8s  %s\n' "${T}" "${SN}" "${DN}" "*** MISMATCH ***"
    MISMATCH=$(( MISMATCH + 1 ))
  fi
done

echo
if [[ "${MISMATCH}" -eq 0 ]]; then
  echo "PASS - every shared column matches, ${TOTAL_ROWS} rows verified."
else
  echo "FAIL - ${MISMATCH} table(s) differ."
  exit 1
fi
