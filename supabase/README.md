# Local database

The Supabase CLI runs Postgres 17 for development, matching the version in
production. Auth, storage, realtime, edge functions, analytics and SMTP are
switched off in `config.toml`: Payload owns authentication through its own
`users` collection and talks to Postgres directly, so those containers would
only cost startup time and disk.

```
supabase start          # Postgres :54322 · API :54321 · Studio :54323
supabase stop           # services bind to 0.0.0.0, so stop them off your network
pnpm db:local:reset     # wipe, migrate and reseed in one step
```

## Payload owns the schema

Every table here is created by a Payload migration in `src/migrations/`,
generated from the collection definitions and applied with `pnpm payload migrate`.

**Do not use `supabase db diff` or `supabase db push` against these tables.**
Two systems writing the same schema is how the drift that preceded this setup
happened: the database and the migration history disagreed, and neither could be
trusted to describe the other. The collections are the source of truth, and the
migrations are derived from them.

`supabase/migrations/` therefore stays empty for anything Payload models. It is
the right home only for what Payload does not: row-level security policies,
database functions, extensions, views. Such a migration may add those objects
and must never alter a table Payload manages.

Because the migrations do not live here, `supabase db reset` leaves an empty
database — it recreates the container and finds nothing to apply. Use
`pnpm db:local:reset`, which resets, runs the Payload migrations and reseeds.

## The data is invented

`src/scripts/seed-local.ts` fills the catalogue with fictional products.
Production data is not copied here and should not be: this Postgres has no
password, binds to `0.0.0.0`, and lives on a laptop. The seed is also the only
reproducible option — it gives every developer the same catalogue from one
command, which a dump of production never does.

The `users` collection is left empty on purpose. The first visit to `/admin`
creates the administrator, so nobody inherits a shared password.
