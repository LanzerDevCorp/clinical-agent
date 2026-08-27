import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

/**
 * Move the product "type" from a hardcoded `select` (the PG enum
 * `enum_products_product_type`) to the new `product-types` collection, so the
 * admin can add, rename and remove types without a code change and a deploy.
 *
 * The seven rows created here are the six original enum values plus the new
 * "Gel". `products.product_type_id` is backfilled by matching the old enum text
 * against `product_types.slug`, which is why the slugs are exactly the former
 * enum values.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
  CREATE TABLE "product_types" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );

  ALTER TABLE "products" ADD COLUMN "product_type_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "product_types_id" integer;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "product_types_find" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "product_types_create" boolean DEFAULT false;
  ALTER TABLE "payload_mcp_api_keys" ADD COLUMN "product_types_update" boolean DEFAULT false;

  ALTER TABLE "products" ADD CONSTRAINT "products_product_type_id_product_types_id_fk" FOREIGN KEY ("product_type_id") REFERENCES "public"."product_types"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_product_types_fk" FOREIGN KEY ("product_types_id") REFERENCES "public"."product_types"("id") ON DELETE cascade ON UPDATE no action;

  CREATE UNIQUE INDEX "product_types_slug_idx" ON "product_types" USING btree ("slug");
  CREATE INDEX "product_types_updated_at_idx" ON "product_types" USING btree ("updated_at");
  CREATE INDEX "product_types_created_at_idx" ON "product_types" USING btree ("created_at");
  CREATE INDEX "products_product_type_idx" ON "products" USING btree ("product_type_id");
  CREATE INDEX "payload_locked_documents_rels_product_types_id_idx" ON "payload_locked_documents_rels" USING btree ("product_types_id");

  INSERT INTO "product_types" ("name", "slug", "updated_at", "created_at") VALUES
  	('Liofilizado', 'liofilizado', now(), now()),
  	('Líquido', 'liquido', now(), now()),
  	('Hilos PDO', 'hilos_pdo', now(), now()),
  	('Dispositivo Médico', 'dispositivo_medico', now(), now()),
  	('Insumo de Aplicación', 'insumo', now(), now()),
  	('Otro', 'otro', now(), now()),
  	('Gel', 'gel', now(), now());

  UPDATE "products"
  	SET "product_type_id" = "product_types"."id"
  	FROM "product_types"
  	WHERE "products"."product_type" IS NOT NULL
  	  AND "product_types"."slug" = "products"."product_type"::text;

  ALTER TABLE "products" DROP COLUMN "product_type";
  DROP TYPE "public"."enum_products_product_type";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('liofilizado', 'liquido', 'hilos_pdo', 'dispositivo_medico', 'insumo', 'otro');
  ALTER TABLE "products" ADD COLUMN "product_type" "public"."enum_products_product_type";

  UPDATE "products"
  	SET "product_type" = "product_types"."slug"::"public"."enum_products_product_type"
  	FROM "product_types"
  	WHERE "product_types"."id" = "products"."product_type_id"
  	  AND "product_types"."slug" IN ('liofilizado', 'liquido', 'hilos_pdo', 'dispositivo_medico', 'insumo', 'otro');

  ALTER TABLE "products" DROP CONSTRAINT "products_product_type_id_product_types_id_fk";
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_product_types_fk";
  DROP INDEX "products_product_type_idx";
  DROP INDEX "payload_locked_documents_rels_product_types_id_idx";
  ALTER TABLE "products" DROP COLUMN "product_type_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "product_types_id";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "product_types_find";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "product_types_create";
  ALTER TABLE "payload_mcp_api_keys" DROP COLUMN "product_types_update";
  DROP TABLE "product_types" CASCADE;`)
}
