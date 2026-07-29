import { MigrateUpArgs, MigrateDownArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
   CREATE TABLE "protocols_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"application_zones_id" integer
  );
  
  ALTER TABLE "protocols" DROP CONSTRAINT "protocols_zone_id_application_zones_id_fk";
  
  DROP INDEX "protocols_zone_idx";
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."protocols"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "protocols_rels" ADD CONSTRAINT "protocols_rels_application_zones_fk" FOREIGN KEY ("application_zones_id") REFERENCES "public"."application_zones"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "protocols_rels_order_idx" ON "protocols_rels" USING btree ("order");
  CREATE INDEX "protocols_rels_parent_idx" ON "protocols_rels" USING btree ("parent_id");
  CREATE INDEX "protocols_rels_path_idx" ON "protocols_rels" USING btree ("path");
  CREATE INDEX "protocols_rels_application_zones_id_idx" ON "protocols_rels" USING btree ("application_zones_id");
  ALTER TABLE "protocols" DROP COLUMN "zone_id";`)
}

export async function down({ db, payload, req }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
   ALTER TABLE "protocols_rels" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "protocols_rels" CASCADE;
  ALTER TABLE "protocols" ADD COLUMN "zone_id" integer NOT NULL;
  ALTER TABLE "protocols" ADD CONSTRAINT "protocols_zone_id_application_zones_id_fk" FOREIGN KEY ("zone_id") REFERENCES "public"."application_zones"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "protocols_zone_idx" ON "protocols" USING btree ("zone_id");`)
}
