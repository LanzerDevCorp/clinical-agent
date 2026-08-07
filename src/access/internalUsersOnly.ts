import type { Access } from 'payload'

export const internalUsersOnly: Access = ({ req }) => req.user?.collection === 'users'
