import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" ADD COLUMN "visible_effects_onset" varchar;
  ALTER TABLE "products" ADD COLUMN "effect_duration" varchar;
  ALTER TABLE "products" ADD COLUMN "recommended_dose" varchar;
  ALTER TABLE "products" ADD COLUMN "injection_depth" varchar;
  ALTER TABLE "products" ADD COLUMN "certifications" varchar;`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "products" DROP COLUMN "visible_effects_onset";
  ALTER TABLE "products" DROP COLUMN "effect_duration";
  ALTER TABLE "products" DROP COLUMN "recommended_dose";
  ALTER TABLE "products" DROP COLUMN "injection_depth";
  ALTER TABLE "products" DROP COLUMN "certifications";`)
}
