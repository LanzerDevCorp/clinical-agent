import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "clinical_agent_admission_events" (
      "event_id" uuid PRIMARY KEY NOT NULL,
      "subject_hash" char(64) NOT NULL,
      "admitted_at" timestamp with time zone NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "clinical_agent_admission_events_subject_time_idx"
      ON "clinical_agent_admission_events" USING btree ("subject_hash", "admitted_at");

    CREATE TABLE IF NOT EXISTS "clinical_agent_admission_leases" (
      "lease_id" uuid PRIMARY KEY NOT NULL,
      "subject_hash" char(64) NOT NULL,
      "expires_at" timestamp with time zone NOT NULL
    );
    CREATE INDEX IF NOT EXISTS "clinical_agent_admission_leases_subject_expiry_idx"
      ON "clinical_agent_admission_leases" USING btree ("subject_hash", "expires_at");
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS "clinical_agent_admission_leases";
    DROP TABLE IF EXISTS "clinical_agent_admission_events";
  `)
}
