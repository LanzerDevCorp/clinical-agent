import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * A new enum value cannot be used in the same transaction that adds it, but it
 * can be committed and read by later statements/migrations — this migration
 * only adds the value, no row is set to it here.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_role" ADD VALUE 'medico';
  `)
}

/**
 * Postgres has no DROP VALUE for enums, so rolling back means swapping in a
 * type without it: any row already on 'medico' falls back to 'user' rather
 * than blocking the rollback.
 */
export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    ALTER TYPE "public"."enum_users_role" RENAME TO "enum_users_role_old";
    CREATE TYPE "public"."enum_users_role" AS ENUM('admin', 'user');
    ALTER TABLE "users" ALTER COLUMN "role" DROP DEFAULT;
    ALTER TABLE "users" ALTER COLUMN "role" TYPE "public"."enum_users_role" USING (
      CASE "role"::text WHEN 'medico' THEN 'user' ELSE "role"::text END
    )::"public"."enum_users_role";
    ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'admin';
    DROP TYPE "public"."enum_users_role_old";
  `)
}
