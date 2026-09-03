import { type MigrateDownArgs, type MigrateUpArgs, sql } from '@payloadcms/db-postgres'

/**
 * The prior migration added must_change_password with DEFAULT true, which
 * backfills every existing row to true — including accounts that already
 * set their own real password before the field existed. Left alone, that
 * locks every current admin out of /agent and the catalogue (adminOrMedico
 * denies access while mustChangePassword is true) on their next login.
 * This backfill clears it for the accounts that existed before the column
 * did; only genuinely new temporary-password accounts should start at true.
 */
export async function up({ db }: MigrateUpArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users" SET "must_change_password" = false;
  `)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
  await db.execute(sql`
    UPDATE "users" SET "must_change_password" = true;
  `)
}
