import type { CollectionBeforeChangeHook } from 'payload'

/**
 * A password set on someone else's account (an admin creating it, or resetting
 * it because the owner forgot theirs) is temporary and must be changed; a
 * password an account sets on itself is not. `mustChangePassword` is
 * `access.update`-locked to admin (see Users.ts), so a real acting user's
 * submitted value for it never persists anyway — this hook is what actually
 * decides it.
 *
 * A request with no acting user (a script, e.g. the local seed) is trusted as
 * given: `data.mustChangePassword` already carries the field's default (create)
 * or the document's current value (update) by the time this hook runs — it is
 * never `undefined` — so "no acting user" is the only reliable signal that
 * nothing here should be recomputed.
 */
export const manageMustChangePassword: CollectionBeforeChangeHook = ({ data, operation, req, originalDoc }) => {
  if (!data.password) return data

  const actingUserId = req.user?.collection === 'users' ? String(req.user.id) : undefined
  if (actingUserId === undefined) return data

  const targetUserId = operation === 'create' ? undefined : originalDoc?.id != null ? String(originalDoc.id) : undefined
  const isSelfService = actingUserId === targetUserId

  return { ...data, mustChangePassword: !isSelfService }
}
