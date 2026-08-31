import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * The clinical category a product belongs to — a new `categories` collection,
 * with `products.category_id` as a nullable single relationship (a product has
 * exactly one category). Unlike the `product-types` migration, this is purely
 * additive: no existing `products` row is read, updated or dropped. The 13
 * rows seeded here come from `catalogs/indices/*.md`, confirmed with the
 * doctor; the "No Registrado" entries in those files have no corresponding
 * product and are out of scope. Assigning each product to its category is a
 * manual step in the admin (bulk edit), not part of this migration.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "categories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"created_by_id" integer,
  	"updated_by_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "products" ADD COLUMN "category_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "categories_id" integer;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "categories_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "categories_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "categories_update" boolean DEFAULT false;

  ALTER TABLE "categories" ADD CONSTRAINT "categories_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "categories" ADD CONSTRAINT "categories_updated_by_id_users_id_fk" FOREIGN KEY ("updated_by_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_category_id_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."categories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_categories_fk" FOREIGN KEY ("categories_id") REFERENCES "public"."categories"("id") ON DELETE cascade ON UPDATE no action;

  CREATE UNIQUE INDEX "categories_slug_idx" ON "categories" USING btree ("slug");
  CREATE INDEX "categories_created_by_idx" ON "categories" USING btree ("created_by_id");
  CREATE INDEX "categories_updated_by_idx" ON "categories" USING btree ("updated_by_id");
  CREATE INDEX "categories_updated_at_idx" ON "categories" USING btree ("updated_at");
  CREATE INDEX "categories_created_at_idx" ON "categories" USING btree ("created_at");
  CREATE INDEX "products_category_idx" ON "products" USING btree ("category_id");
  CREATE INDEX "payload_locked_documents_rels_categories_id_idx" ON "payload_locked_documents_rels" USING btree ("categories_id");

  INSERT INTO "categories" ("name", "slug", "updated_at", "created_at") VALUES
  	('Bioestimuladores', 'bioestimuladores', now(), now()),
  	('Dermapen', 'dermapen', now(), now()),
  	('Hilos PDO', 'hilos_pdo', now(), now()),
  	('Lipolíticos', 'lipoliticos', now(), now()),
  	('Otros Productos', 'otros_productos', now(), now()),
  	('Skin Boosters', 'skin_boosters', now(), now()),
  	('Capilar', 'capilar', now(), now()),
  	('Despigmentantes', 'despigmentantes', now(), now()),
  	('Enzimas', 'enzimas', now(), now()),
  	('Hidratantes', 'hidratantes', now(), now()),
  	('Regenerativos', 'regenerativos', now(), now()),
  	('Rellenos', 'rellenos', now(), now()),
  	('Toxinas', 'toxinas', now(), now());`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_created_by_id_users_id_fk";
  ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_updated_by_id_users_id_fk";
  ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_category_id_categories_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT IF EXISTS "payload_locked_documents_rels_categories_fk";

  DROP INDEX IF EXISTS "categories_slug_idx";
  DROP INDEX IF EXISTS "categories_created_by_idx";
  DROP INDEX IF EXISTS "categories_updated_by_idx";
  DROP INDEX IF EXISTS "categories_updated_at_idx";
  DROP INDEX IF EXISTS "categories_created_at_idx";
  DROP INDEX IF EXISTS "products_category_idx";
  DROP INDEX IF EXISTS "payload_locked_documents_rels_categories_id_idx";

  ALTER TABLE "products" DROP COLUMN IF EXISTS "category_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN IF EXISTS "categories_id";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "categories_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "categories_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN IF EXISTS "categories_update";

  DROP TABLE "categories" CASCADE;`)
}
