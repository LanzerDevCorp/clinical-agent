#!/usr/bin/env bash
#
# Copy row data from a source Postgres into a target that already has the
# Payload schema applied by `payload migrate`.
#
# It copies column-by-column intersection per table, so columns that exist only
# in the source (superseded pre-refactor drafts) are skipped instead of aborting
# the load, and columns that exist only in the target stay NULL.
#
# Foreign keys are deferred during the load via session_replication_role, then
# re-enabled and validated. Sequences are advanced to match the loaded ids.
#
# payload_migrations is deliberately NOT copied: the target records its own
# migration history.
#
# Usage:
#   bash scripts/db/migrate-data.sh <SOURCE_URL> <TARGET_URL>
#   SRC_URL=... DST_URL=... bash scripts/db/migrate-data.sh
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

SKIP_TABLES="'payload_migrations'"

echo "==> Discovering tables present in BOTH databases"
# Plain assignment, not `mapfile < <(cmd)`: process substitution throws away the
# exit status, so a failed lookup used to read as "no tables" and the whole load
# became a silent no-op that still announced Done.
TABLES_RAW="$(psql_dst -tAc "SELECT table_name FROM information_schema.tables
                             WHERE table_schema='public' AND table_type='BASE TABLE'
                               AND table_name NOT IN (${SKIP_TABLES})
                             ORDER BY table_name;" | tr -d '\r')" \
  || { printf 'ERROR: could not list the tables of the target database.\n' >&2; exit 1; }

mapfile -t TABLES < <(printf '%s\n' "${TABLES_RAW}" | sed '/^$/d')

[[ "${#TABLES[@]}" -gt 0 ]] || {
  printf 'ERROR: the target has no tables in schema public, so there is nothing to load into.\n' >&2
  printf '       Run `payload migrate` against it first.\n' >&2
  exit 1
}
echo "    ${#TABLES[@]} candidate tables"

echo "==> Loading (foreign keys deferred)"
psql_dst -q -c "SET session_replication_role = 'replica';" >/dev/null 2>&1 || true

for T in "${TABLES[@]}"; do
  [[ -n "${T}" ]] || continue

  # Does the source have this table at all?
  HAS=$(psql_src -tAc "SELECT 1 FROM information_schema.tables
                       WHERE table_schema='public' AND table_name='${T}' LIMIT 1;" | tr -d '\r')
  [[ "${HAS}" == "1" ]] || { printf '    skip %-34s (absent in source)\n' "${T}"; continue; }

  # Columns the two sides share, in target order. The two lists must be fetched
  # from their own databases and intersected here: a subquery cannot reach across
  # the connection, and one that looks like it does silently returns everything.
  SRC_COLS=$(psql_src -tAc "SELECT column_name FROM information_schema.columns
                            WHERE table_schema='public' AND table_name='${T}';" | tr -d '\r')
  DST_COLS=$(psql_dst -tAc "SELECT column_name FROM information_schema.columns
                            WHERE table_schema='public' AND table_name='${T}'
                            ORDER BY ordinal_position;" | tr -d '\r')
  COLS=""
  while IFS= read -r C; do
    [[ -n "${C}" ]] || continue
    if grep -qx -- "${C}" <<< "${SRC_COLS}"; then
      COLS+="${COLS:+,}\"${C}\""
    fi
  done <<< "${DST_COLS}"
  [[ -n "${COLS}" ]] || { printf '    skip %-34s (no shared columns)\n' "${T}"; continue; }

  # Stream source rows straight into the target; no temp files, no disk copy.
  # session_replication_role must be set in the SAME psql session as the \copy,
  # so both -c options go on one invocation. Otherwise foreign keys fire and the
  # alphabetical table order breaks the load.
  docker run --rm -i --network "${NETWORK}" -e PGSRC "${IMAGE}" \
    sh -c 'exec psql "$PGSRC" -q -c "$1"' -- \
      "\copy (SELECT ${COLS} FROM public.\"${T}\") TO STDOUT" \
  | docker run --rm -i --network "${NETWORK}" -e PGDST "${IMAGE}" \
    sh -c 'exec psql "$PGDST" -q -c "$1" -c "$2"' -- \
      "SET session_replication_role = 'replica';" \
      "\copy public.\"${T}\" (${COLS}) FROM STDIN"

  N=$(psql_dst -tAc "SELECT count(*) FROM public.\"${T}\";" | tr -d '\r')
  printf '    %-34s %s rows\n' "${T}" "${N}"
done

echo "==> Re-enabling foreign key enforcement"
psql_dst -q -c "SET session_replication_role = 'origin';" >/dev/null 2>&1 || true

echo "==> Advancing sequences to match loaded ids"
psql_dst -tAc "
  SELECT 'SELECT setval(' || quote_literal(quote_ident(s.relname)) || ', COALESCE((SELECT max(' ||
         quote_ident(a.attname) || ') FROM ' || quote_ident(t.relname) || '), 0) + 1, false);'
  FROM pg_class s
  JOIN pg_depend d ON d.objid = s.oid AND d.deptype = 'a'
  JOIN pg_class t ON t.oid = d.refobjid
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
  WHERE s.relkind = 'S';" | tr -d '\r' > /tmp/setvals.sql
psql_dst -q -f /dev/stdin < /tmp/setvals.sql >/dev/null 2>&1 || \
  while read -r LINE; do [[ -n "${LINE}" ]] && psql_dst -tAc "${LINE}" >/dev/null; done < /tmp/setvals.sql

echo "==> Validating deferred foreign keys"
psql_dst -tAc "
  SELECT conrelid::regclass || ' -> ' || conname
  FROM pg_constraint WHERE contype='f' AND NOT convalidated;" | tr -d '\r' | sed '/^$/d' \
  || true

echo "Done."
