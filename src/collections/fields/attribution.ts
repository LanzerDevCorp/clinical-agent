import type { Field } from 'payload'

import { systemManagedField } from '../../access/systemManaged'

/**
 * Shared "who touched this record" fields. Every catalogue collection carries
 * them and the `stampAttribution` hook fills them in.
 *
 * They are pure audit metadata: hidden from the admin entirely (`admin.hidden`)
 * and write-locked at the field level (`access`), so no one sees or edits them
 * in the panel — the value is only ever set by the server hook and read back
 * from the database when an attribution question actually comes up.
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
  access: {
    create: systemManagedField,
    update: systemManagedField,
  },
  admin: {
    hidden: true,
    disableListColumn: true,
  },
}

export const updatedBy: Field = {
  name: 'updatedBy',
  label: 'Última modificación por',
  type: 'relationship',
  relationTo: 'users',
  access: {
    create: systemManagedField,
    update: systemManagedField,
  },
  admin: {
    hidden: true,
    disableListColumn: true,
  },
}
