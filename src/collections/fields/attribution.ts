import type { Field } from 'payload'

/**
 * Shared "who touched this record" fields. Every catalogue collection carries
 * them and the `stampAttribution` hook fills them in — the admin never edits
 * them by hand, which is why both are `readOnly` and hidden from the list table.
 *
 * Both are nullable: rows created by a seed, a migration or an unauthenticated
 * request have no acting user to record, and that is a valid state rather than
 * an error.
 */
export const createdBy: Field = {
  name: 'createdBy',
  label: 'Creado por',
  type: 'relationship',
  relationTo: 'users',
  admin: {
    readOnly: true,
    position: 'sidebar',
    disableListColumn: true,
    description: 'Quién creó este registro. Se completa automáticamente.',
  },
}

export const updatedBy: Field = {
  name: 'updatedBy',
  label: 'Última modificación por',
  type: 'relationship',
  relationTo: 'users',
  admin: {
    readOnly: true,
    position: 'sidebar',
    disableListColumn: true,
    description: 'Quién hizo la última modificación a este registro. Se completa automáticamente.',
  },
}
