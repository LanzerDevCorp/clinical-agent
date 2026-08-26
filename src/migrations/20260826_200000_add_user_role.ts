import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * Existing rows backfill to 'admin', not the field's own 'user' default — every
 * account that already exists today keeps full access; only a NEW account starts
 * at the lower privilege. Someone with admin access then demotes the specific
 * accounts (e.g. the doctor's) that should not have it, by hand in the admin.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
    ALTER TABLE "users" ADD COLUMN "role" "enum_users_role" NOT NULL DEFAULT 'admin';
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TABLE "users" DROP COLUMN IF EXISTS "role";
    DROP TYPE IF EXISTS "public"."enum_users_role";
  `)
}
