import type { PayloadRequest } from 'payload'

/**
 * Payload calls this before any admin-panel route, server function, etc.
 * renders (see `payload/dist/utilities/canAccessAdmin.js`). Any authenticated
 * `users` account may open the panel shell — the built-in Account view is
 * where a 'user' (sales) account reaches its own profile; every catalogue
 * collection's own access (see `adminOrMedico`) is what actually keeps that
 * role from seeing anything else once inside.
 */
export const canAccessAdminPanel = ({ req }: { req: PayloadRequest }): boolean =>
  req.user?.collection === 'users'
