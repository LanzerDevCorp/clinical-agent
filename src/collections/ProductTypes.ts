import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

/**
 * The product "type" used to be a hardcoded `select` on Products (a PG enum), so
 * adding one — "Gel", say — meant a code change, a migration and a deploy. It is
 * a plain catalogue of labels, so it belongs in a collection the admin can edit.
 *
 * `slug` is the stable key. Fixtures and the ingest script refer to a type by
 * its slug, never its id, so renaming `name` is safe but changing `slug` breaks
 * every fixture that names it.
 *
 * The doctor only ever fills in "Nombre". `slug` is derived from it automatically
 * by a `beforeValidate` hook and shown read-only — it is normalised on the way
 * in when present, and generated from `name` when left blank, so a create with
 * just a name still satisfies `required`.
 */
export const ProductTypes: CollectionConfig = {
  slug: 'product-types',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Tipo de producto',
      en: 'Tipo de producto',
    },
    plural: {
      es: 'Tipos de producto',
      en: 'Tipos de producto',
    },
  },
  admin: {
    useAsTitle: 'name',
    defaultColumns: ['name'],
    group: {
      es: 'Catálogos Maestros',
      en: 'Catálogos Maestros',
    },
  },
  hooks: {
    beforeChange: [stampAttribution],
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre',
      type: 'text',
      required: true,
    },
    {
      name: 'slug',
      label: 'Identificador',
      type: 'text',
      required: true,
      unique: true,
      index: true,
      admin: {
        readOnly: true,
        disableListColumn: true,
        description:
          'Se genera automáticamente a partir del nombre. Clave estable que usan ' +
          'las fixtures y la ingesta.',
      },
      hooks: {
        beforeValidate: [
          ({ value, siblingData }) => {
            const raw =
              typeof value === 'string' && value.trim() !== ''
                ? value
                : typeof siblingData?.name === 'string'
                  ? siblingData.name
                  : ''

            const normalized = raw
              .normalize('NFD')
              .replace(/[̀-ͯ]/g, '')
              .trim()
              .toLowerCase()
              .replace(/\s+/g, '_')
              .replace(/[^a-z0-9_]/g, '')

            return normalized === '' ? value : normalized
          },
        ],
      },
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
