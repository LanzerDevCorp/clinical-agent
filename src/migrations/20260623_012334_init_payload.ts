import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contraindications_type" AS ENUM('absoluta', 'relativa');
  CREATE TYPE "public"."enum_clinical_notes_type" AS ENUM('indicacion_clinica', 'cuidado_post_aplicacion', 'advertencia_seguridad');
  CREATE TYPE "public"."enum_products_presentations_status" AS ENUM('activa', 'descontinuada');
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('otro');
  CREATE TYPE "public"."enum_products_validation_status" AS ENUM('PENDING', 'NEEDS_CLINICAL_REVIEW', 'APPROVED');
  CREATE TABLE "laboratories" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "active_ingredients" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "application_zones" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "administration_routes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "application_techniques" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "contraindications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"type" "enum_contraindications_type" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "adverse_effects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "clinical_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"type" "enum_clinical_notes_type" NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "protocols" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"zone_id" integer NOT NULL,
  	"route_id" integer NOT NULL,
  	"technique_id" integer NOT NULL,
  	"sessions_min" numeric,
  	"sessions_max" numeric,
  	"frequency" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL
  );
  
  CREATE TABLE "products_presentations_aliases" (
  	"_order" integer NOT NULL,
  	"_parent_id" varchar NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"term" varchar NOT NULL
  );
  
  CREATE TABLE "products_presentations" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"canonical_name" varchar NOT NULL,
  	"status" "enum_products_presentations_status" DEFAULT 'activa',
  	"reconstitution_diluent_type" varchar,
  	"reconstitution_volume_ml" numeric,
  	"reconstitution_instructions" varchar
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"canonical_name" varchar NOT NULL,
  	"product_type" "enum_products_product_type",
  	"laboratory_id" integer NOT NULL,
  	"validation_status" "enum_products_validation_status" DEFAULT 'PENDING' NOT NULL,
  	"validation_notes" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "products_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"active_ingredients_id" integer,
  	"contraindications_id" integer,
  	"adverse_effects_id" integer,
  	"clinical_notes_id" integer,
  	"protocols_id" integer
  );
  
  CREATE TABLE "payload_mcp_api_keys" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"user_id" integer NOT NULL,
  	"label" varchar,
  	"description" varchar,
  	"users_find" boolean DEFAULT false,
  	"media_find" boolean DEFAULT false,
  	"media_create" boolean DEFAULT false,
  	"laboratories_find" boolean DEFAULT false,
  	"laboratories_create" boolean DEFAULT false,
  	"laboratories_update" boolean DEFAULT false,
  	"active_ingredients_find" boolean DEFAULT false,
  	"active_ingredients_create" boolean DEFAULT false,
  	"active_ingredients_update" boolean DEFAULT false,
  	"application_zones_find" boolean DEFAULT false,
  	"application_zones_create" boolean DEFAULT false,
  	"application_zones_update" boolean DEFAULT false,
  	"administration_routes_find" boolean DEFAULT false,
  	"administration_routes_create" boolean DEFAULT false,
  	"administration_routes_update" boolean DEFAULT false,
  	"application_techniques_find" boolean DEFAULT false,
  	"application_techniques_create" boolean DEFAULT false,
  	"application_techniques_update" boolean DEFAULT false,
  	"contraindications_find" boolean DEFAULT false,
  	"contraindications_create" boolean DEFAULT false,
  	"contraindications_update" boolean DEFAULT false,
  	"adverse_effects_find" boolean DEFAULT false,
  	"adverse_effects_create" boolean DEFAULT false,
  	"adverse_effects_update" boolean DEFAULT false,
  	"clinical_notes_find" boolean DEFAULT false,
  	"clinical_notes_create" boolean DEFAULT false,
  	"clinical_notes_update" boolean DEFAULT false,
  	"protocols_find" boolean DEFAULT false,
  	"protocols_create" boolean DEFAULT false,
  	"protocols_update" boolean DEFAULT false,
  	"products_find" boolean DEFAULT false,
  	"products_create" boolean DEFAULT false,
  	"products_update" boolean DEFAULT false,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"enable_a_p_i_key" boolean,
  	"api_key" varchar,
  	"api_key_index" varchar
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "laboratories_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "active_ingredients_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "application_zones_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "administration_routes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "application_techniques_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "contraindications_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "adverse_effects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "clinical_notes_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "protocols_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "products_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "payload_preferences_rels" ADD COLUMN "payload_mcp_api_keys_id" integer;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_zone_id_application_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."application_zones"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_route_id_administration_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."administration_routes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_technique_id_application_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."application_techniques"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_aliases" ADD CONSTRAINT "products_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_presentations_aliases" ADD CONSTRAINT "products_presentations_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_presentations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_presentations" ADD CONSTRAINT "products_presentations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_laboratory_id_laboratories_id_fk" FOREIGN KEY ("laboratory_id") REFERENCES "public"."laboratories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_active_ingredients_fk" FOREIGN KEY ("active_ingredients_id") REFERENCES "public"."active_ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_contraindications_fk" FOREIGN KEY ("contraindications_id") REFERENCES "public"."contraindications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_adverse_effects_fk" FOREIGN KEY ("adverse_effects_id") REFERENCES "public"."adverse_effects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_clinical_notes_fk" FOREIGN KEY ("clinical_notes_id") REFERENCES "public"."clinical_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_protocols_fk" FOREIGN KEY ("protocols_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "laboratories_updated_at_idx" ON "laboratories" USING btree ("updated_at");
  CREATE INDEX "laboratories_created_at_idx" ON "laboratories" USING btree ("created_at");
  CREATE INDEX "active_ingredients_updated_at_idx" ON "active_ingredients" USING btree ("updated_at");
  CREATE INDEX "active_ingredients_created_at_idx" ON "active_ingredients" USING btree ("created_at");
  CREATE INDEX "application_zones_updated_at_idx" ON "application_zones" USING btree ("updated_at");
  CREATE INDEX "application_zones_created_at_idx" ON "application_zones" USING btree ("created_at");
  CREATE INDEX "administration_routes_updated_at_idx" ON "administration_routes" USING btree ("updated_at");
  CREATE INDEX "administration_routes_created_at_idx" ON "administration_routes" USING btree ("created_at");
  CREATE INDEX "application_techniques_updated_at_idx" ON "application_techniques" USING btree ("updated_at");
  CREATE INDEX "application_techniques_created_at_idx" ON "application_techniques" USING btree ("created_at");
  CREATE INDEX "contraindications_updated_at_idx" ON "contraindications" USING btree ("updated_at");
  CREATE INDEX "contraindications_created_at_idx" ON "contraindications" USING btree ("created_at");
  CREATE INDEX "adverse_effects_updated_at_idx" ON "adverse_effects" USING btree ("updated_at");
  CREATE INDEX "adverse_effects_created_at_idx" ON "adverse_effects" USING btree ("created_at");
  CREATE INDEX "clinical_notes_updated_at_idx" ON "clinical_notes" USING btree ("updated_at");
  CREATE INDEX "clinical_notes_created_at_idx" ON "clinical_notes" USING btree ("created_at");
  CREATE INDEX "protocols_zone_idx" ON "protocols" USING btree ("zone_id");
  CREATE INDEX "protocols_route_idx" ON "protocols" USING btree ("route_id");
  CREATE INDEX "protocols_technique_idx" ON "protocols" USING btree ("technique_id");
  CREATE INDEX "protocols_updated_at_idx" ON "protocols" USING btree ("updated_at");
  CREATE INDEX "protocols_created_at_idx" ON "protocols" USING btree ("created_at");
  CREATE INDEX "products_aliases_order_idx" ON "products_aliases" USING btree ("_order");
  CREATE INDEX "products_aliases_parent_id_idx" ON "products_aliases" USING btree ("_parent_id");
  CREATE INDEX "products_presentations_aliases_order_idx" ON "products_presentations_aliases" USING btree ("_order");
  CREATE INDEX "products_presentations_aliases_parent_id_idx" ON "products_presentations_aliases" USING btree ("_parent_id");
  CREATE INDEX "products_presentations_order_idx" ON "products_presentations" USING btree ("_order");
  CREATE INDEX "products_presentations_parent_id_idx" ON "products_presentations" USING btree ("_parent_id");
  CREATE INDEX "products_laboratory_idx" ON "products" USING btree ("laboratory_id");
  CREATE INDEX "products_updated_at_idx" ON "products" USING btree ("updated_at");
  CREATE INDEX "products_created_at_idx" ON "products" USING btree ("created_at");
  CREATE INDEX "products_rels_order_idx" ON "products_rels" USING btree ("order");
  CREATE INDEX "products_rels_parent_idx" ON "products_rels" USING btree ("parent_id");
  CREATE INDEX "products_rels_path_idx" ON "products_rels" USING btree ("path");
  CREATE INDEX "products_rels_active_ingredients_id_idx" ON "products_rels" USING btree ("active_ingredients_id");
  CREATE INDEX "products_rels_contraindications_id_idx" ON "products_rels" USING btree ("contraindications_id");
  CREATE INDEX "products_rels_adverse_effects_id_idx" ON "products_rels" USING btree ("adverse_effects_id");
  CREATE INDEX "products_rels_clinical_notes_id_idx" ON "products_rels" USING btree ("clinical_notes_id");
  CREATE INDEX "products_rels_protocols_id_idx" ON "products_rels" USING btree ("protocols_id");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_laboratories_fk" FOREIGN KEY ("laboratories_id") REFERENCES "public"."laboratories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_active_ingredients_fk" FOREIGN KEY ("active_ingredients_id") REFERENCES "public"."active_ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_zones_fk" FOREIGN KEY ("application_zones_id") REFERENCES "public"."application_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_administration_routes_fk" FOREIGN KEY ("administration_routes_id") REFERENCES "public"."administration_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_techniques_fk" FOREIGN KEY ("application_techniques_id") REFERENCES "public"."application_techniques"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contraindications_fk" FOREIGN KEY ("contraindications_id") REFERENCES "public"."contraindications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_adverse_effects_fk" FOREIGN KEY ("adverse_effects_id") REFERENCES "public"."adverse_effects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinical_notes_fk" FOREIGN KEY ("clinical_notes_id") REFERENCES "public"."clinical_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_protocols_fk" FOREIGN KEY ("protocols_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_laboratories_id_idx" ON "payload_locked_documents_rels" USING btree ("laboratories_id");
  CREATE INDEX "payload_locked_documents_rels_active_ingredients_id_idx" ON "payload_locked_documents_rels" USING btree ("active_ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_application_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("application_zones_id");
  CREATE INDEX "payload_locked_documents_rels_administration_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("administration_routes_id");
  CREATE INDEX "payload_locked_documents_rels_application_techniques_id_idx" ON "payload_locked_documents_rels" USING btree ("application_techniques_id");
  CREATE INDEX "payload_locked_documents_rels_contraindications_id_idx" ON "payload_locked_documents_rels" USING btree ("contraindications_id");
  CREATE INDEX "payload_locked_documents_rels_adverse_effects_id_idx" ON "payload_locked_documents_rels" USING btree ("adverse_effects_id");
  CREATE INDEX "payload_locked_documents_rels_clinical_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("clinical_notes_id");
  CREATE INDEX "payload_locked_documents_rels_protocols_id_idx" ON "payload_locked_documents_rels" USING btree ("protocols_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "laboratories" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "active_ingredients" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "application_zones" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "administration_routes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "application_techniques" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "contraindications" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "adverse_effects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "clinical_notes" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "protocols" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_presentations_aliases" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_presentations" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "products_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "payload_mcp_api_keys" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "laboratories" CASCADE;
  DROP TABLE "active_ingredients" CASCADE;
  DROP TABLE "application_zones" CASCADE;
  DROP TABLE "administration_routes" CASCADE;
  DROP TABLE "application_techniques" CASCADE;
  DROP TABLE "contraindications" CASCADE;
  DROP TABLE "adverse_effects" CASCADE;
  DROP TABLE "clinical_notes" CASCADE;
  DROP TABLE "protocols" CASCADE;
  DROP TABLE "products_aliases" CASCADE;
  DROP TABLE "products_presentations_aliases" CASCADE;
  DROP TABLE "products_presentations" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_laboratories_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_active_ingredients_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_application_zones_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_administration_routes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_application_techniques_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_contraindications_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_adverse_effects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_clinical_notes_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_protocols_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_products_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk";
  
  ALTER TABLE "payload_preferences_rels" DROP CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk";
  
  DROP INDEX "payload_locked_documents_rels_laboratories_id_idx";
  DROP INDEX "payload_locked_documents_rels_active_ingredients_id_idx";
  DROP INDEX "payload_locked_documents_rels_application_zones_id_idx";
  DROP INDEX "payload_locked_documents_rels_administration_routes_id_idx";
  DROP INDEX "payload_locked_documents_rels_application_techniques_id_idx";
  DROP INDEX "payload_locked_documents_rels_contraindications_id_idx";
  DROP INDEX "payload_locked_documents_rels_adverse_effects_id_idx";
  DROP INDEX "payload_locked_documents_rels_clinical_notes_id_idx";
  DROP INDEX "payload_locked_documents_rels_protocols_id_idx";
  DROP INDEX "payload_locked_documents_rels_products_id_idx";
  DROP INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx";
  DROP INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "laboratories_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "active_ingredients_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "application_zones_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "administration_routes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "application_techniques_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "contraindications_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "adverse_effects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "clinical_notes_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "protocols_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "products_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "payload_mcp_api_keys_id";
  ALTER TABLE "payload_preferences_rels" DROP COLUMN "payload_mcp_api_keys_id";
  DROP TYPE "public"."enum_contraindications_type";
  DROP TYPE "public"."enum_clinical_notes_type";
  DROP TYPE "public"."enum_products_presentations_status";
  DROP TYPE "public"."enum_products_product_type";
  DROP TYPE "public"."enum_products_validation_status";`)
}
