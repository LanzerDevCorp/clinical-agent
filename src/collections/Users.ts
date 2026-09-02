import type { CollectionConfig } from 'payload'
import { adminOnly, adminOnlyField } from '../access/adminOnly'
import { canAccessAdminPanel } from '../access/canAccessAdminPanel'
import { ownDocumentOrAdmin } from '../access/ownDocumentOrAdmin'
import { manageMustChangePassword } from './hooks/manageMustChangePassword'
import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // Any authenticated account may open the panel shell — a 'user' (sales)
    // account still needs the built-in Account view to reach its own profile.
    // What each role actually sees inside is decided per collection instead
    // (every catalogue collection is admin-or-medico only).
    admin: canAccessAdminPanel,
    // A non-admin still edits their own account (e.g. their password) — the
    // collection is hidden from their nav, not locked to them entirely.
    read: ownDocumentOrAdmin,
    update: ownDocumentOrAdmin,
    create: adminOnly,
    delete: adminOnly,
    // Otherwise any authenticated account's own Account view shows "Forzar
    // Desbloqueo" for every account, including its own — Payload's default
    // when unlock is left unset is any authenticated user, not just admin.
    unlock: adminOnly,
  },
  labels: {
    singular: {
      es: 'Usuario',
      en: 'Usuario',
    },
    plural: {
      es: 'Usuarios',
      en: 'Usuarios',
    },
  },
  admin: {
    useAsTitle: 'email',
    group: {
      es: 'Administración',
      en: 'Administración',
    },
    hidden: ({ user }) => user?.role !== 'admin',
  },
  auth: true,
  hooks: {
    beforeChange: [manageMustChangePassword],
  },
  fields: [
    // Email added by default
    {
      name: 'mustChangePassword',
      label: 'Debe cambiar la contraseña',
      type: 'checkbox',
      defaultValue: true,
      access: {
        // manageMustChangePassword is what actually sets this on a real
        // password change — locking client updates keeps a 'user' or 'medico'
        // account from clearing it on its own document without one.
        update: adminOnlyField,
      },
      admin: {
        position: 'sidebar',
        description: 'Se activa solo al crear la cuenta o al resetear la contraseña de otra persona.',
      },
    },
    {
      name: 'role',
      label: 'Rol',
      type: 'select',
      required: true,
      // New accounts default to the lower privilege on purpose — an admin has to
      // deliberately promote someone, never the other way around by omission.
      defaultValue: 'user',
      options: [
        { label: 'Administrador', value: 'admin' },
        { label: 'Médico', value: 'medico' },
        { label: 'Usuario', value: 'user' },
      ],
      access: {
        // Otherwise ownDocumentOrAdmin's "edit your own account" would let a
        // "user" promote themselves through their own profile page.
        update: adminOnlyField,
      },
      admin: {
        position: 'sidebar',
        // Hidden, not just read-only, on a user/medico's own Account view —
        // their role is not theirs to see change, so there is nothing to show.
        condition: (_data, _siblingData, { user }) => Boolean(user && 'role' in user && user.role === 'admin'),
      },
    },
    hiddenCreatedAt,
  ],
}
