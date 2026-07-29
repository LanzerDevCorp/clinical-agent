import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "protocols" DROP CONSTRAINT "protocols_route_id_administration_routes_id_fk";
  
  ALTER TABLE "protocols" DROP CONSTRAINT "protocols_technique_id_application_techniques_id_fk";
  
  DROP INDEX "protocols_route_idx";
  DROP INDEX "protocols_technique_idx";
  ALTER TABLE "protocols_rels" ADD COLUMN "administration_routes_id" integer;
  ALTER TABLE "protocols_rels" ADD COLUMN "application_techniques_id" integer;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_administration_routes_fk" FOREIGN KEY ("administration_routes_id") REFERENCES "public"."administration_routes"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_application_techniques_fk" FOREIGN KEY ("application_techniques_id") REFERENCES "public"."application_techniques"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "protocols_rels_administration_routes_id_idx" ON "protocols_rels" USING btree ("administration_routes_id");
  CREATE INDEX "protocols_rels_application_techniques_id_idx" ON "protocols_rels" USING btree ("application_techniques_id");
  ALTER TABLE "protocols" DROP COLUMN "route_id";
  ALTER TABLE "protocols" DROP COLUMN "technique_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "protocols_rels" DROP CONSTRAINT "protocols_rels_administration_routes_fk";
  
  ALTER TABLE "protocols_rels" DROP CONSTRAINT "protocols_rels_application_techniques_fk";
  
  DROP INDEX "protocols_rels_administration_routes_id_idx";
  DROP INDEX "protocols_rels_application_techniques_id_idx";
  ALTER TABLE "protocols" ADD COLUMN "route_id" integer NOT NULL;
  ALTER TABLE "protocols" ADD COLUMN "technique_id" integer NOT NULL;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_route_id_administration_routes_id_fk" FOREIGN KEY ("route_id") REFERENCES "public"."administration_routes"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_technique_id_application_techniques_id_fk" FOREIGN KEY ("technique_id") REFERENCES "public"."application_techniques"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "protocols_route_idx" ON "protocols" USING btree ("route_id");
  CREATE INDEX "protocols_technique_idx" ON "protocols" USING btree ("technique_id");
  ALTER TABLE "protocols_rels" DROP COLUMN "administration_routes_id";
  ALTER TABLE "protocols_rels" DROP COLUMN "application_techniques_id";`)
}
