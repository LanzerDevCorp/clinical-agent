import type { CollectionConfig } from 'payload'
import { adminOnly, adminOnlyField } from '../access/adminOnly'
import { ownDocumentOrAdmin } from '../access/ownDocumentOrAdmin'
import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Users: CollectionConfig = {
  slug: 'users',
  access: {
    // A non-admin still edits their own account (e.g. their password) — the
    // collection is hidden from their nav, not locked to them entirely.
    read: ownDocumentOrAdmin,
    update: ownDocumentOrAdmin,
    create: adminOnly,
    delete: adminOnly,
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
  fields: [
    // Email added by default
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
        { label: 'Usuario', value: 'user' },
      ],
      access: {
        // Otherwise ownDocumentOrAdmin's "edit your own account" would let a
        // "user" promote themselves through their own profile page.
        update: adminOnlyField,
      },
      admin: {
        position: 'sidebar',
      },
    },
    hiddenCreatedAt,
  ],
}
