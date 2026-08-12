-- Phase 3, step 1: stamp payload_migrations on Neon for the new baseline.
--
-- Replaces the 9 rows naming the migrations deleted in 726da74 with the two
-- migrations that exist today in src/migrations/index.ts. Payload matches
-- migration files to this table by `name` alone (see migrateStatus.js and
-- migrate.js in @payloadcms/drizzle 3.85.1), so the two names below must stay
-- byte-identical to the `name` values in src/migrations/index.ts.
--
-- Column shape taken from the live schema dump of 20260812T164706Z
-- (backups/neon-schema-20260812T164706Z.sql:633):
--   id         integer NOT NULL DEFAULT nextval('payload_migrations_id_seq')
--   name       character varying
--   batch      numeric
--   updated_at timestamp(3) with time zone NOT NULL DEFAULT now()
--   created_at timestamp(3) with time zone NOT NULL DEFAULT now()
-- Only name and batch are supplied; id and both timestamps take their defaults.
--
-- Run with ON_ERROR_STOP=1. Any RAISE below aborts the transaction and leaves
-- the table untouched.

BEGIN;

-- Guard: the table must hold exactly the 9 expected rows and nothing else.
-- Proving set equality here is what makes the unqualified DELETE below exact.
DO $$
DECLARE
  expected constant text[] := ARRAY[
    '20260622_234535_init_payload',
    '20260623_012334_init_payload',
    '20260728_225658_init_payload',
    '20260729_001929_init_payload',
    '20260729_003408_init_payload',
    '20260730_002716_init_payload',
    '20260805_093200_add_characteristics',
    '20260806_122450_add_protocol_client_shareable',
    '20260807_140000_clinical_agent_admission'
  ];
  total   integer;
  matched integer;
BEGIN
  SELECT count(*) INTO total FROM public.payload_migrations;
  SELECT count(*) INTO matched FROM public.payload_migrations WHERE name = ANY (expected);

  IF total <> 9 OR matched <> 9 THEN
    RAISE EXCEPTION
      'Unexpected payload_migrations state: % total rows, % matching the expected set (both must be 9). Nothing was changed.',
      total, matched;
  END IF;
END $$;

DELETE FROM public.payload_migrations;

-- Both rows share batch 1: the stamp is one event, not a replay of history.
-- Consequence: a future `migrate:down` reverts both together.
INSERT INTO public.payload_migrations (name, batch) VALUES
  ('20260812_000000_baseline', 1),
  ('20260812_000001_clinical_agent_admission', 1);

-- Post-check: only the two new rows may remain.
DO $$
DECLARE total integer;
BEGIN
  SELECT count(*) INTO total FROM public.payload_migrations;
  IF total <> 2 THEN
    RAISE EXCEPTION 'Expected 2 rows after stamping, found %. Rolling back.', total;
  END IF;
END $$;

COMMIT;

-- Final state, for the record.
SELECT id, name, batch, created_at FROM public.payload_migrations ORDER BY id;
