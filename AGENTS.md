# Agent context

Clinical catalogue for an aesthetic medicine practice: Payload CMS on Postgres,
a Next.js app, and a clinical agent that answers questions about the products a
doctor has validated.

**The project instructions live in [CLAUDE.md](CLAUDE.md).** Read that file —
stack, local database, the schema change cycle, and the traps that have already
cost a day are all there, and kept in one place on purpose. This file used to
carry its own copy of that content; the copy drifted until it described a
different project entirely, which is why it now points instead of repeating.

Two rules are repeated here because they are the expensive ones to miss:

- **Development never touches production.** `DATABASE_URL` points at the local
  Supabase instance. `payload.config.ts` refuses to start against a remote host
  outside a deployment, so this is enforced rather than assumed.
- **Payload owns the database schema.** Tables come from migrations in
  `src/migrations/`, generated from the collection definitions. Never run
  `supabase db diff` or `supabase db push` against a table Payload manages.
