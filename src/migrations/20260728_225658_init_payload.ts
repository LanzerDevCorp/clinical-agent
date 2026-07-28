import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_products_product_type" ADD VALUE 'liofilizado' BEFORE 'otro';
  ALTER TYPE "public"."enum_products_product_type" ADD VALUE 'liquido' BEFORE 'otro';
  ALTER TYPE "public"."enum_products_product_type" ADD VALUE 'hilos_pdo' BEFORE 'otro';
  ALTER TYPE "public"."enum_products_product_type" ADD VALUE 'dispositivo_medico' BEFORE 'otro';
  ALTER TYPE "public"."enum_products_product_type" ADD VALUE 'insumo' BEFORE 'otro';
  ALTER TABLE "products" ALTER COLUMN "validation_status" SET DATA TYPE text;
  ALTER TABLE "products" ALTER COLUMN "validation_status" SET DEFAULT 'PENDING'::text;
  DROP TYPE "public"."enum_products_validation_status";
  CREATE TYPE "public"."enum_products_validation_status" AS ENUM('PENDING', 'APPROVED');
  ALTER TABLE "products" ALTER COLUMN "validation_status" SET DEFAULT 'PENDING'::"public"."enum_products_validation_status";
  ALTER TABLE "products" ALTER COLUMN "validation_status" SET DATA TYPE "public"."enum_products_validation_status" USING "validation_status"::"public"."enum_products_validation_status";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TYPE "public"."enum_products_validation_status" ADD VALUE 'NEEDS_CLINICAL_REVIEW' BEFORE 'APPROVED';
  ALTER TABLE "products" ALTER COLUMN "product_type" SET DATA TYPE text;
  DROP TYPE "public"."enum_products_product_type";
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('otro');
  ALTER TABLE "products" ALTER COLUMN "product_type" SET DATA TYPE "public"."enum_products_product_type" USING "product_type"::"public"."enum_products_product_type";`)
}
