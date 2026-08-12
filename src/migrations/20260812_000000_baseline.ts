import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TYPE "public"."enum_contraindications_type" AS ENUM('absoluta', 'relativa');
  CREATE TYPE "public"."enum_products_presentations_status" AS ENUM('activa', 'descontinuada');
  CREATE TYPE "public"."enum_products_validation_status" AS ENUM('PENDING', 'APPROVED');
  CREATE TYPE "public"."enum_products_product_type" AS ENUM('liofilizado', 'liquido', 'hilos_pdo', 'dispositivo_medico', 'insumo', 'otro');
  CREATE TABLE "users_sessions" (
  	"_order" integer NOT NULL,
  	"_parent_id" integer NOT NULL,
  	"id" varchar PRIMARY KEY NOT NULL,
  	"created_at" timestamp(3) with time zone,
  	"expires_at" timestamp(3) with time zone NOT NULL
  );
  
  CREATE TABLE "users" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"email" varchar NOT NULL,
  	"reset_password_token" varchar,
  	"reset_password_expiration" timestamp(3) with time zone,
  	"salt" varchar,
  	"hash" varchar,
  	"login_attempts" numeric DEFAULT 0,
  	"lock_until" timestamp(3) with time zone
  );
  
  CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"alt" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric
  );
  
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
  
  CREATE TABLE "clinical_indications" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "post_care_notes" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "safety_warnings" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"description" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "protocols" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"client_shareable" boolean DEFAULT false NOT NULL,
  	"name" varchar NOT NULL,
  	"visible_effects_onset" varchar,
  	"effect_duration" varchar,
  	"recommended_dose" varchar,
  	"injection_depth" varchar,
  	"sessions_min" numeric,
  	"sessions_max" numeric,
  	"frequency" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "protocols_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"application_zones_id" integer,
  	"administration_routes_id" integer,
  	"application_techniques_id" integer
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
  	"characteristics" varchar,
  	"certifications" varchar,
  	"reconstitution_diluent_type" varchar,
  	"reconstitution_volume_ml" numeric,
  	"reconstitution_instructions" varchar
  );
  
  CREATE TABLE "products" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"validation_status" "enum_products_validation_status" DEFAULT 'PENDING' NOT NULL,
  	"validation_notes" varchar,
  	"canonical_name" varchar NOT NULL,
  	"description" varchar,
  	"product_type" "enum_products_product_type",
  	"laboratory_id" integer NOT NULL,
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
  	"clinical_indications_id" integer,
  	"post_care_notes_id" integer,
  	"safety_warnings_id" integer,
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
  	"clinical_indications_find" boolean DEFAULT false,
  	"clinical_indications_create" boolean DEFAULT false,
  	"clinical_indications_update" boolean DEFAULT false,
  	"post_care_notes_find" boolean DEFAULT false,
  	"post_care_notes_create" boolean DEFAULT false,
  	"post_care_notes_update" boolean DEFAULT false,
  	"safety_warnings_find" boolean DEFAULT false,
  	"safety_warnings_create" boolean DEFAULT false,
  	"safety_warnings_update" boolean DEFAULT false,
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
  
  CREATE TABLE "payload_kv" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar NOT NULL,
  	"data" jsonb NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"global_slug" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_locked_documents_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"media_id" integer,
  	"laboratories_id" integer,
  	"active_ingredients_id" integer,
  	"application_zones_id" integer,
  	"administration_routes_id" integer,
  	"application_techniques_id" integer,
  	"contraindications_id" integer,
  	"adverse_effects_id" integer,
  	"clinical_indications_id" integer,
  	"post_care_notes_id" integer,
  	"safety_warnings_id" integer,
  	"protocols_id" integer,
  	"products_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_preferences" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"key" varchar,
  	"value" jsonb,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "payload_preferences_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"users_id" integer,
  	"payload_mcp_api_keys_id" integer
  );
  
  CREATE TABLE "payload_migrations" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"name" varchar,
  	"batch" numeric,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  ALTER TABLE "users_sessions" ADD CONSTRAINT "users_sessions_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_application_zones_fk" FOREIGN KEY ("application_zones_id") REFERENCES "public"."application_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_administration_routes_fk" FOREIGN KEY ("administration_routes_id") REFERENCES "public"."administration_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_application_techniques_fk" FOREIGN KEY ("application_techniques_id") REFERENCES "public"."application_techniques"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_aliases" ADD CONSTRAINT "products_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_presentations_aliases" ADD CONSTRAINT "products_presentations_aliases_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products_presentations"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_presentations" ADD CONSTRAINT "products_presentations_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products" ADD CONSTRAINT "products_laboratory_id_laboratories_id_fk" FOREIGN KEY ("laboratory_id") REFERENCES "public"."laboratories"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_active_ingredients_fk" FOREIGN KEY ("active_ingredients_id") REFERENCES "public"."active_ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_contraindications_fk" FOREIGN KEY ("contraindications_id") REFERENCES "public"."contraindications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_adverse_effects_fk" FOREIGN KEY ("adverse_effects_id") REFERENCES "public"."adverse_effects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_clinical_indications_fk" FOREIGN KEY ("clinical_indications_id") REFERENCES "public"."clinical_indications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_post_care_notes_fk" FOREIGN KEY ("post_care_notes_id") REFERENCES "public"."post_care_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_safety_warnings_fk" FOREIGN KEY ("safety_warnings_id") REFERENCES "public"."safety_warnings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "products_rels" ADD CONSTRAINT "products_rels_protocols_fk" FOREIGN KEY ("protocols_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_mcp_api_keys" ADD CONSTRAINT "payload_mcp_api_keys_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_locked_documents"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_laboratories_fk" FOREIGN KEY ("laboratories_id") REFERENCES "public"."laboratories"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_active_ingredients_fk" FOREIGN KEY ("active_ingredients_id") REFERENCES "public"."active_ingredients"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_zones_fk" FOREIGN KEY ("application_zones_id") REFERENCES "public"."application_zones"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_administration_routes_fk" FOREIGN KEY ("administration_routes_id") REFERENCES "public"."administration_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_application_techniques_fk" FOREIGN KEY ("application_techniques_id") REFERENCES "public"."application_techniques"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_contraindications_fk" FOREIGN KEY ("contraindications_id") REFERENCES "public"."contraindications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_adverse_effects_fk" FOREIGN KEY ("adverse_effects_id") REFERENCES "public"."adverse_effects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_clinical_indications_fk" FOREIGN KEY ("clinical_indications_id") REFERENCES "public"."clinical_indications"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_post_care_notes_fk" FOREIGN KEY ("post_care_notes_id") REFERENCES "public"."post_care_notes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_safety_warnings_fk" FOREIGN KEY ("safety_warnings_id") REFERENCES "public"."safety_warnings"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_protocols_fk" FOREIGN KEY ("protocols_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_products_fk" FOREIGN KEY ("products_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."payload_preferences"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_users_fk" FOREIGN KEY ("users_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_preferences_rels" ADD CONSTRAINT "payload_preferences_rels_payload_mcp_api_keys_fk" FOREIGN KEY ("payload_mcp_api_keys_id") REFERENCES "public"."payload_mcp_api_keys"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "users_sessions_order_idx" ON "users_sessions" USING btree ("_order");
  CREATE INDEX "users_sessions_parent_id_idx" ON "users_sessions" USING btree ("_parent_id");
  CREATE INDEX "users_updated_at_idx" ON "users" USING btree ("updated_at");
  CREATE INDEX "users_created_at_idx" ON "users" USING btree ("created_at");
  CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
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
  CREATE UNIQUE INDEX "clinical_indications_name_idx" ON "clinical_indications" USING btree ("name");
  CREATE INDEX "clinical_indications_updated_at_idx" ON "clinical_indications" USING btree ("updated_at");
  CREATE INDEX "clinical_indications_created_at_idx" ON "clinical_indications" USING btree ("created_at");
  CREATE UNIQUE INDEX "post_care_notes_description_idx" ON "post_care_notes" USING btree ("description");
  CREATE INDEX "post_care_notes_updated_at_idx" ON "post_care_notes" USING btree ("updated_at");
  CREATE INDEX "post_care_notes_created_at_idx" ON "post_care_notes" USING btree ("created_at");
  CREATE UNIQUE INDEX "safety_warnings_description_idx" ON "safety_warnings" USING btree ("description");
  CREATE INDEX "safety_warnings_updated_at_idx" ON "safety_warnings" USING btree ("updated_at");
  CREATE INDEX "safety_warnings_created_at_idx" ON "safety_warnings" USING btree ("created_at");
  CREATE INDEX "protocols_updated_at_idx" ON "protocols" USING btree ("updated_at");
  CREATE INDEX "protocols_created_at_idx" ON "protocols" USING btree ("created_at");
  CREATE INDEX "protocols_rels_order_idx" ON "protocols_rels" USING btree ("order");
  CREATE INDEX "protocols_rels_parent_idx" ON "protocols_rels" USING btree ("parent_id");
  CREATE INDEX "protocols_rels_path_idx" ON "protocols_rels" USING btree ("path");
  CREATE INDEX "protocols_rels_application_zones_id_idx" ON "protocols_rels" USING btree ("application_zones_id");
  CREATE INDEX "protocols_rels_administration_routes_id_idx" ON "protocols_rels" USING btree ("administration_routes_id");
  CREATE INDEX "protocols_rels_application_techniques_id_idx" ON "protocols_rels" USING btree ("application_techniques_id");
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
  CREATE INDEX "products_rels_clinical_indications_id_idx" ON "products_rels" USING btree ("clinical_indications_id");
  CREATE INDEX "products_rels_post_care_notes_id_idx" ON "products_rels" USING btree ("post_care_notes_id");
  CREATE INDEX "products_rels_safety_warnings_id_idx" ON "products_rels" USING btree ("safety_warnings_id");
  CREATE INDEX "products_rels_protocols_id_idx" ON "products_rels" USING btree ("protocols_id");
  CREATE INDEX "payload_mcp_api_keys_user_idx" ON "payload_mcp_api_keys" USING btree ("user_id");
  CREATE INDEX "payload_mcp_api_keys_updated_at_idx" ON "payload_mcp_api_keys" USING btree ("updated_at");
  CREATE INDEX "payload_mcp_api_keys_created_at_idx" ON "payload_mcp_api_keys" USING btree ("created_at");
  CREATE UNIQUE INDEX "payload_kv_key_idx" ON "payload_kv" USING btree ("key");
  CREATE INDEX "payload_locked_documents_global_slug_idx" ON "payload_locked_documents" USING btree ("global_slug");
  CREATE INDEX "payload_locked_documents_updated_at_idx" ON "payload_locked_documents" USING btree ("updated_at");
  CREATE INDEX "payload_locked_documents_created_at_idx" ON "payload_locked_documents" USING btree ("created_at");
  CREATE INDEX "payload_locked_documents_rels_order_idx" ON "payload_locked_documents_rels" USING btree ("order");
  CREATE INDEX "payload_locked_documents_rels_parent_idx" ON "payload_locked_documents_rels" USING btree ("parent_id");
  CREATE INDEX "payload_locked_documents_rels_path_idx" ON "payload_locked_documents_rels" USING btree ("path");
  CREATE INDEX "payload_locked_documents_rels_users_id_idx" ON "payload_locked_documents_rels" USING btree ("users_id");
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");
  CREATE INDEX "payload_locked_documents_rels_laboratories_id_idx" ON "payload_locked_documents_rels" USING btree ("laboratories_id");
  CREATE INDEX "payload_locked_documents_rels_active_ingredients_id_idx" ON "payload_locked_documents_rels" USING btree ("active_ingredients_id");
  CREATE INDEX "payload_locked_documents_rels_application_zones_id_idx" ON "payload_locked_documents_rels" USING btree ("application_zones_id");
  CREATE INDEX "payload_locked_documents_rels_administration_routes_id_idx" ON "payload_locked_documents_rels" USING btree ("administration_routes_id");
  CREATE INDEX "payload_locked_documents_rels_application_techniques_id_idx" ON "payload_locked_documents_rels" USING btree ("application_techniques_id");
  CREATE INDEX "payload_locked_documents_rels_contraindications_id_idx" ON "payload_locked_documents_rels" USING btree ("contraindications_id");
  CREATE INDEX "payload_locked_documents_rels_adverse_effects_id_idx" ON "payload_locked_documents_rels" USING btree ("adverse_effects_id");
  CREATE INDEX "payload_locked_documents_rels_clinical_indications_id_idx" ON "payload_locked_documents_rels" USING btree ("clinical_indications_id");
  CREATE INDEX "payload_locked_documents_rels_post_care_notes_id_idx" ON "payload_locked_documents_rels" USING btree ("post_care_notes_id");
  CREATE INDEX "payload_locked_documents_rels_safety_warnings_id_idx" ON "payload_locked_documents_rels" USING btree ("safety_warnings_id");
  CREATE INDEX "payload_locked_documents_rels_protocols_id_idx" ON "payload_locked_documents_rels" USING btree ("protocols_id");
  CREATE INDEX "payload_locked_documents_rels_products_id_idx" ON "payload_locked_documents_rels" USING btree ("products_id");
  CREATE INDEX "payload_locked_documents_rels_payload_mcp_api_keys_id_idx" ON "payload_locked_documents_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_preferences_key_idx" ON "payload_preferences" USING btree ("key");
  CREATE INDEX "payload_preferences_updated_at_idx" ON "payload_preferences" USING btree ("updated_at");
  CREATE INDEX "payload_preferences_created_at_idx" ON "payload_preferences" USING btree ("created_at");
  CREATE INDEX "payload_preferences_rels_order_idx" ON "payload_preferences_rels" USING btree ("order");
  CREATE INDEX "payload_preferences_rels_parent_idx" ON "payload_preferences_rels" USING btree ("parent_id");
  CREATE INDEX "payload_preferences_rels_path_idx" ON "payload_preferences_rels" USING btree ("path");
  CREATE INDEX "payload_preferences_rels_users_id_idx" ON "payload_preferences_rels" USING btree ("users_id");
  CREATE INDEX "payload_preferences_rels_payload_mcp_api_keys_id_idx" ON "payload_preferences_rels" USING btree ("payload_mcp_api_keys_id");
  CREATE INDEX "payload_migrations_updated_at_idx" ON "payload_migrations" USING btree ("updated_at");
  CREATE INDEX "payload_migrations_created_at_idx" ON "payload_migrations" USING btree ("created_at");`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   DROP TABLE "users_sessions" CASCADE;
  DROP TABLE "users" CASCADE;
  DROP TABLE "media" CASCADE;
  DROP TABLE "laboratories" CASCADE;
  DROP TABLE "active_ingredients" CASCADE;
  DROP TABLE "application_zones" CASCADE;
  DROP TABLE "administration_routes" CASCADE;
  DROP TABLE "application_techniques" CASCADE;
  DROP TABLE "contraindications" CASCADE;
  DROP TABLE "adverse_effects" CASCADE;
  DROP TABLE "clinical_indications" CASCADE;
  DROP TABLE "post_care_notes" CASCADE;
  DROP TABLE "safety_warnings" CASCADE;
  DROP TABLE "protocols" CASCADE;
  DROP TABLE "protocols_rels" CASCADE;
  DROP TABLE "products_aliases" CASCADE;
  DROP TABLE "products_presentations_aliases" CASCADE;
  DROP TABLE "products_presentations" CASCADE;
  DROP TABLE "products" CASCADE;
  DROP TABLE "products_rels" CASCADE;
  DROP TABLE "payload_mcp_api_keys" CASCADE;
  DROP TABLE "payload_kv" CASCADE;
  DROP TABLE "payload_locked_documents" CASCADE;
  DROP TABLE "payload_locked_documents_rels" CASCADE;
  DROP TABLE "payload_preferences" CASCADE;
  DROP TABLE "payload_preferences_rels" CASCADE;
  DROP TABLE "payload_migrations" CASCADE;
  DROP TYPE "public"."enum_contraindications_type";
  DROP TYPE "public"."enum_products_presentations_status";
  DROP TYPE "public"."enum_products_validation_status";
  DROP TYPE "public"."enum_products_product_type";`)
}
