import type { Access, FieldAccess } from 'payload'

// req.user is a union across every auth-enabled collection (users and the MCP
// API keys), so the 'users' check narrows it before .role is reachable.
export const adminOnly: Access = ({ req }) =>
  req.user?.collection === 'users' && req.user.role === 'admin'

export const adminOnlyField: FieldAccess = ({ req }) =>
  req.user?.collection === 'users' && req.user.role === 'admin'
