import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Records who created and who last modified a record.
 *
 * Only a real `users`-collection principal is stamped — mirroring
 * `isInternalUserRequest` in the clinical repository. An MCP api-key request
 * (`req.user.collection === 'payload-mcp-api-keys'`), a seed, a migration or an
 * unauthenticated call leaves the fields untouched: there is no person to
 * attribute the change to, and inventing one would be worse than a null.
 *
 * `createdBy` is written once, on create. `updatedBy` is rewritten on every
 * change and never carries over an older creator.
 */
export const stampAttribution: CollectionBeforeChangeHook = ({ data, operation, req }) => {
  if (req.user?.collection !== 'users') return data

  const userId = req.user.id

  if (operation === 'create') {
    return { ...data, createdBy: userId, updatedBy: userId }
  }

  if (operation === 'update') {
    return { ...data, updatedBy: userId }
  }

  return data
}
