import { getPayload } from 'payload'
import configPromise from '../payload.config.js'
import { sql } from '@payloadcms/db-postgres'

async function run() {
  console.log('Initializing payload to execute schema SQL directly...')
  const payload = await getPayload({ config: configPromise })
  const adapter = payload.db as any

  console.log('Creating clinical_indications table...')
  await adapter.drizzle.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "clinical_indications" (
      "id" serial PRIMARY KEY NOT NULL,
      "name" varchar NOT NULL UNIQUE,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `))

  console.log('Creating post_care_notes table...')
  await adapter.drizzle.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "post_care_notes" (
      "id" serial PRIMARY KEY NOT NULL,
      "description" varchar NOT NULL UNIQUE,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `))

  console.log('Creating safety_warnings table...')
  await adapter.drizzle.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS "safety_warnings" (
      "id" serial PRIMARY KEY NOT NULL,
      "description" varchar NOT NULL UNIQUE,
      "updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
      "created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
    );
  `))

  console.log('Adding relationship columns to products_rels and payload_locked_documents_rels...')
  await adapter.drizzle.execute(sql.raw(`
    ALTER TABLE "products_rels" ADD COLUMN IF NOT EXISTS "clinical_indications_id" integer;
    ALTER TABLE "products_rels" ADD COLUMN IF NOT EXISTS "post_care_notes_id" integer;
    ALTER TABLE "products_rels" ADD COLUMN IF NOT EXISTS "safety_warnings_id" integer;

    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "clinical_indications_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "post_care_notes_id" integer;
    ALTER TABLE "payload_locked_documents_rels" ADD COLUMN IF NOT EXISTS "safety_warnings_id" integer;

    ALTER TABLE "protocols" ADD COLUMN IF NOT EXISTS "visible_effects_onset" varchar;
    ALTER TABLE "protocols" ADD COLUMN IF NOT EXISTS "effect_duration" varchar;
    ALTER TABLE "protocols" ADD COLUMN IF NOT EXISTS "recommended_dose" varchar;
    ALTER TABLE "protocols" ADD COLUMN IF NOT EXISTS "injection_depth" varchar;
  `))

  console.log('Schema SQL executed successfully!')
  process.exit(0)
}

run().catch((err) => {
  console.error('Error executing SQL:', err)
  process.exit(1)
})
