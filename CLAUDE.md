# Claude Code

## Payload skill

The Payload CMS reference lives at `.claude/skills/payload/SKILL.md`, with detail
under `.claude/skills/payload/reference/`. Note that `.claude/` is gitignored, so
a fresh clone does not have it — it is local tooling, not part of the project.

## Branches

Work happens on `dev`. `main` is what production runs, and it moves only when a
change is ready to deploy — pushing to it triggers a deployment.

```
git checkout dev            # where commits go
git checkout main && git merge --ff-only dev && git push origin main
```

Committing straight to `main` and syncing `dev` afterwards is how they drifted
apart four times in a single day, and a branch that only ever catches up is a
branch that costs attention and returns nothing.

## The database

Development runs against a local Supabase instance, never against production.
See `supabase/README.md` for what runs and why.

```
supabase start          # Postgres :54322 · API :54321 · Studio :54323
pnpm dev                # the app, against that local database
pnpm db:local:reset     # wipe, migrate and reseed
pnpm db:local:seed      # reseed only
```

`src/scripts/seed-local.ts` fills the catalogue with invented products. Production
data is never copied to a developer machine.

It also creates the admin user, so a reset never sends you back to Payload's
first-user wizard. Defaults to `dev@local.test` / `localdev`; set
`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD` in `.env` to keep your own
credentials instead. An account with that email is left untouched if it already
exists, so reseeding never rewrites a password you are logged in with.

### Two rules that are enforced, not suggested

**Payload owns the schema.** Tables come from migrations in `src/migrations/`,
generated from the collection definitions. Never run `supabase db diff` or
`supabase db push` against a table Payload manages. `supabase/migrations/` is
only for what Payload does not model: policies, functions, views.

**Local cannot reach a remote database.** `payload.config.ts` refuses to start
when `DATABASE_URL` points anywhere but localhost, unless the process is a Vercel
deployment or `ALLOW_REMOTE_DATABASE=1` is set for that one command. This is a
guard, not a convention: it stops the process before the first connection.

## Changing the schema

1. **Edit the collection** in `src/collections/`.

2. **Generate the migration.** `payload migrate:create` **does not work under
   Node 24** — the bin loads Payload through tsx, which appends a cache-busting
   query to `node:` specifiers, and the import dies with
   `ENOENT ... open 'node:crypto?tsx-namespace=...'`. Upgrading tsx to 4.23.12
   does not fix it; the failure is in `createMigration` itself, so calling it
   from a script through `payload run` fails identically. Until that is
   resolved, either:
   - run `pnpm payload migrate:create <name>` under **Node 22**, or
   - write the migration by hand. A Payload migration is an `up` and a `down`
     with raw SQL. `supabase db diff` will print the SQL for the change without
     touching anything, which is a safe way to get the statements to paste.

3. **Apply it locally**: `pnpm payload migrate`, then `pnpm payload migrate:status`.

4. **Prove it applies from nothing**: `pnpm db:local:reset`. A migration that only
   works against your current database is not a migration.

5. **Commit the collection and the migration together.** They describe the same
   change; separated, either one alone is wrong.

6. **Apply to production by hand.** The Vercel build runs `next build` only — it
   does not migrate. Production is migrated deliberately, with the production
   `DATABASE_URL` and `ALLOW_REMOTE_DATABASE=1` on that single command, after the
   deploy that carries the matching code.

## Things that have already cost a day

- `payload migrate` and `migrate:status` work fine; only `migrate:create` is broken.
- A `$` in a credential inside `.env` is eaten silently: Payload reads env through
  `@next/env`, whose expand step treats it as a variable reference. Percent-encode
  it as `%24`, the way `@` becomes `%40`.
- `pg` merges a connection string **over** explicit pool options, so any `ssl`
  parameter in `DATABASE_URL` overrides what `payload.config.ts` sets.
- Copying rows with explicit ids does not advance sequences. Every insert then
  collides and Payload reports `El siguiente campo es inválido: id`.
- After `payload run`, `importMap.js` and `payload-types.ts` may show as modified
  purely from CRLF. Compare with `git hash-object` before assuming a real change.
