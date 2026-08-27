import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * User attribution across the catalogue.
 *
 * Every catalogue collection gains `created_by_id` / `updated_by_id` — nullable
 * integer FKs to `users`, `ON DELETE SET NULL` so removing an account never
 * removes the record it touched. Each column is indexed the same way Payload
 * indexes any single relationship field (`<table>_<field>_idx`).
 *
 * `products` additionally gets `approved_by_id` (FK + index) and `approved_at`
 * (`timestamp(3) with time zone`, nullable), stamped by the `stampApproval`
 * hook whenever `validation_status` enters `APPROVED`.
 *
 * Backfill: existing approved products are credited to `drasara@test.com` with
 * their last-updated time as the approval time. If that account does not exist
 * (any environment other than production) the UPDATE matches zero rows and is a
 * no-op — the columns simply stay null and the hook fills them on the next edit.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "active_ingredients" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "active_ingredients" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "administration_routes" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "administration_routes" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "adverse_effects" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "adverse_effects" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "application_techniques" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "application_techniques" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "application_zones" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "application_zones" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "clinical_indications" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "clinical_indications" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "contraindications" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "contraindications" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "laboratories" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "laboratories" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "post_care_notes" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "post_care_notes" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "product_types" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "product_types" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "protocols" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "protocols" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "safety_warnings" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "safety_warnings" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "products" ADD COLUMN "created_by_id" integer;
  ALTER TABLE "products" ADD COLUMN "updated_by_id" integer;
  ALTER TABLE "products" ADD COLUMN "approved_by_id" integer;
  ALTER TABLE "products" ADD COLUMN "approved_at" timestamp(3) with time zone;

  ALTER TABLE "active_ingredients" ADD CONSTRAINT "active_ingredients_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "active_ingredients" ADD CONSTRAINT "active_ingredients_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "administration_routes" ADD CONSTRAINT "administration_routes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "administration_routes" ADD CONSTRAINT "administration_routes_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adverse_effects" ADD CONSTRAINT "adverse_effects_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "adverse_effects" ADD CONSTRAINT "adverse_effects_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_techniques" ADD CONSTRAINT "application_techniques_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_techniques" ADD CONSTRAINT "application_techniques_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_zones" ADD CONSTRAINT "application_zones_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "application_zones" ADD CONSTRAINT "application_zones_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinical_indications" ADD CONSTRAINT "clinical_indications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "clinical_indications" ADD CONSTRAINT "clinical_indications_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contraindications" ADD CONSTRAINT "contraindications_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "contraindications" ADD CONSTRAINT "contraindications_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "laboratories" ADD CONSTRAINT "laboratories_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "post_care_notes" ADD CONSTRAINT "post_care_notes_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "post_care_notes" ADD CONSTRAINT "post_care_notes_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_types" ADD CONSTRAINT "product_types_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "product_types" ADD CONSTRAINT "product_types_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "safety_warnings" ADD CONSTRAINT "safety_warnings_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "safety_warnings" ADD CONSTRAINT "safety_warnings_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_approved_by_id_users_id_fk" FOREIGN KEY ("approved_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

  CREATE INDEX "active_ingredients_created_by_idx" ON "active_ingredients" USING btree ("created_by_id");
  CREATE INDEX "active_ingredients_updated_by_idx" ON "active_ingredients" USING btree ("updated_by_id");
  CREATE INDEX "administration_routes_created_by_idx" ON "administration_routes" USING btree ("created_by_id");
  CREATE INDEX "administration_routes_updated_by_idx" ON "administration_routes" USING btree ("updated_by_id");
  CREATE INDEX "adverse_effects_created_by_idx" ON "adverse_effects" USING btree ("created_by_id");
  CREATE INDEX "adverse_effects_updated_by_idx" ON "adverse_effects" USING btree ("updated_by_id");
  CREATE INDEX "application_techniques_created_by_idx" ON "application_techniques" USING btree ("created_by_id");
  CREATE INDEX "application_techniques_updated_by_idx" ON "application_techniques" USING btree ("updated_by_id");
  CREATE INDEX "application_zones_created_by_idx" ON "application_zones" USING btree ("created_by_id");
  CREATE INDEX "application_zones_updated_by_idx" ON "application_zones" USING btree ("updated_by_id");
  CREATE INDEX "clinical_indications_created_by_idx" ON "clinical_indications" USING btree ("created_by_id");
  CREATE INDEX "clinical_indications_updated_by_idx" ON "clinical_indications" USING btree ("updated_by_id");
  CREATE INDEX "contraindications_created_by_idx" ON "contraindications" USING btree ("created_by_id");
  CREATE INDEX "contraindications_updated_by_idx" ON "contraindications" USING btree ("updated_by_id");
  CREATE INDEX "laboratories_created_by_idx" ON "laboratories" USING btree ("created_by_id");
  CREATE INDEX "laboratories_updated_by_idx" ON "laboratories" USING btree ("updated_by_id");
  CREATE INDEX "post_care_notes_created_by_idx" ON "post_care_notes" USING btree ("created_by_id");
  CREATE INDEX "post_care_notes_updated_by_idx" ON "post_care_notes" USING btree ("updated_by_id");
  CREATE INDEX "product_types_created_by_idx" ON "product_types" USING btree ("created_by_id");
  CREATE INDEX "product_types_updated_by_idx" ON "product_types" USING btree ("updated_by_id");
  CREATE INDEX "protocols_created_by_idx" ON "protocols" USING btree ("created_by_id");
  CREATE INDEX "protocols_updated_by_idx" ON "protocols" USING btree ("updated_by_id");
  CREATE INDEX "safety_warnings_created_by_idx" ON "safety_warnings" USING btree ("created_by_id");
  CREATE INDEX "safety_warnings_updated_by_idx" ON "safety_warnings" USING btree ("updated_by_id");
  CREATE INDEX "products_created_by_idx" ON "products" USING btree ("created_by_id");
  CREATE INDEX "products_updated_by_idx" ON "products" USING btree ("updated_by_id");
  CREATE INDEX "products_approved_by_idx" ON "products" USING btree ("approved_by_id");

  UPDATE "products" SET "approved_by_id" = u.id, "approved_at" = "products"."updated_at"
  FROM "users" u
  WHERE u.email = 'drasara@test.com' AND "products"."validation_status" = 'APPROVED';`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "active_ingredients" DROP CONSTRAINT IF EXISTS "active_ingredients_created_by_id_users_id_fk";
  ALTER TABLE "active_ingredients" DROP CONSTRAINT IF EXISTS "active_ingredients_updated_by_id_users_id_fk";
  ALTER TABLE "administration_routes" DROP CONSTRAINT IF EXISTS "administration_routes_created_by_id_users_id_fk";
  ALTER TABLE "administration_routes" DROP CONSTRAINT IF EXISTS "administration_routes_updated_by_id_users_id_fk";
  ALTER TABLE "adverse_effects" DROP CONSTRAINT IF EXISTS "adverse_effects_created_by_id_users_id_fk";
  ALTER TABLE "adverse_effects" DROP CONSTRAINT IF EXISTS "adverse_effects_updated_by_id_users_id_fk";
  ALTER TABLE "application_techniques" DROP CONSTRAINT IF EXISTS "application_techniques_created_by_id_users_id_fk";
  ALTER TABLE "application_techniques" DROP CONSTRAINT IF EXISTS "application_techniques_updated_by_id_users_id_fk";
  ALTER TABLE "application_zones" DROP CONSTRAINT IF EXISTS "application_zones_created_by_id_users_id_fk";
  ALTER TABLE "application_zones" DROP CONSTRAINT IF EXISTS "application_zones_updated_by_id_users_id_fk";
  ALTER TABLE "clinical_indications" DROP CONSTRAINT IF EXISTS "clinical_indications_created_by_id_users_id_fk";
  ALTER TABLE "clinical_indications" DROP CONSTRAINT IF EXISTS "clinical_indications_updated_by_id_users_id_fk";
  ALTER TABLE "contraindications" DROP CONSTRAINT IF EXISTS "contraindications_created_by_id_users_id_fk";
  ALTER TABLE "contraindications" DROP CONSTRAINT IF EXISTS "contraindications_updated_by_id_users_id_fk";
  ALTER TABLE "laboratories" DROP CONSTRAINT IF EXISTS "laboratories_created_by_id_users_id_fk";
  ALTER TABLE "laboratories" DROP CONSTRAINT IF EXISTS "laboratories_updated_by_id_users_id_fk";
  ALTER TABLE "post_care_notes" DROP CONSTRAINT IF EXISTS "post_care_notes_created_by_id_users_id_fk";
  ALTER TABLE "post_care_notes" DROP CONSTRAINT IF EXISTS "post_care_notes_updated_by_id_users_id_fk";
  ALTER TABLE "product_types" DROP CONSTRAINT IF EXISTS "product_types_created_by_id_users_id_fk";
  ALTER TABLE "product_types" DROP CONSTRAINT IF EXISTS "product_types_updated_by_id_users_id_fk";
  ALTER TABLE "protocols" DROP CONSTRAINT IF EXISTS "protocols_created_by_id_users_id_fk";
  ALTER TABLE "protocols" DROP CONSTRAINT IF EXISTS "protocols_updated_by_id_users_id_fk";
  ALTER TABLE "safety_warnings" DROP CONSTRAINT IF EXISTS "safety_warnings_created_by_id_users_id_fk";
  ALTER TABLE "safety_warnings" DROP CONSTRAINT IF EXISTS "safety_warnings_updated_by_id_users_id_fk";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_created_by_id_users_id_fk";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_updated_by_id_users_id_fk";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_approved_by_id_users_id_fk";

  DROP INDEX IF EXISTS "active_ingredients_created_by_idx";
  DROP INDEX IF EXISTS "active_ingredients_updated_by_idx";
  DROP INDEX IF EXISTS "administration_routes_created_by_idx";
  DROP INDEX IF EXISTS "administration_routes_updated_by_idx";
  DROP INDEX IF EXISTS "adverse_effects_created_by_idx";
  DROP INDEX IF EXISTS "adverse_effects_updated_by_idx";
  DROP INDEX IF EXISTS "application_techniques_created_by_idx";
  DROP INDEX IF EXISTS "application_techniques_updated_by_idx";
  DROP INDEX IF EXISTS "application_zones_created_by_idx";
  DROP INDEX IF EXISTS "application_zones_updated_by_idx";
  DROP INDEX IF EXISTS "clinical_indications_created_by_idx";
  DROP INDEX IF EXISTS "clinical_indications_updated_by_idx";
  DROP INDEX IF EXISTS "contraindications_created_by_idx";
  DROP INDEX IF EXISTS "contraindications_updated_by_idx";
  DROP INDEX IF EXISTS "laboratories_created_by_idx";
  DROP INDEX IF EXISTS "laboratories_updated_by_idx";
  DROP INDEX IF EXISTS "post_care_notes_created_by_idx";
  DROP INDEX IF EXISTS "post_care_notes_updated_by_idx";
  DROP INDEX IF EXISTS "product_types_created_by_idx";
  DROP INDEX IF EXISTS "product_types_updated_by_idx";
  DROP INDEX IF EXISTS "protocols_created_by_idx";
  DROP INDEX IF EXISTS "protocols_updated_by_idx";
  DROP INDEX IF EXISTS "safety_warnings_created_by_idx";
  DROP INDEX IF EXISTS "safety_warnings_updated_by_idx";
  DROP INDEX IF EXISTS "products_created_by_idx";
  DROP INDEX IF EXISTS "products_updated_by_idx";
  DROP INDEX IF EXISTS "products_approved_by_idx";

  ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "active_ingredients" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "administration_routes" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "administration_routes" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "adverse_effects" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "adverse_effects" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "application_techniques" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "application_techniques" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "application_zones" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "application_zones" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "clinical_indications" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "clinical_indications" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "contraindications" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "contraindications" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "laboratories" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "laboratories" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "post_care_notes" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "post_care_notes" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "product_types" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "product_types" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "protocols" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "protocols" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "safety_warnings" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "safety_warnings" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "created_by_id";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "updated_by_id";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "approved_by_id";
  ALTER TABLE "products" DROP COLUMN IF EXISTS "approved_at";`)
}
