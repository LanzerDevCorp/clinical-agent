import type { Access } from 'payload'

/**
 * An admin reaches every document; anyone else only their own — so a non-admin
 * keeps editing their own profile (e.g. their password) without the `users`
 * collection being open to browsing everyone else's.
 */
export const ownDocumentOrAdmin: Access = ({ req }) => {
  if (!req.user) return false
  if (req.user.collection === 'users' && req.user.role === 'admin') return true
  return { id: { equals: req.user.id } }
}
