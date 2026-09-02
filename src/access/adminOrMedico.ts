import type { Access } from 'payload'

// The catalogue's own gate: a 'user' account (sales) reaches it only through
// the chat, whose repository reads bypass this with overrideAccess: true —
// direct API/panel calls stay behind admin or medico. A temporary password
// (mustChangePassword) denies even admin/medico until it's changed — the
// account is not fully "theirs" yet while the person who set it still knows it.
export const adminOrMedico: Access = ({ req }) =>
  req.user?.collection === 'users' && !req.user.mustChangePassword
    && (req.user.role === 'admin' || req.user.role === 'medico')
