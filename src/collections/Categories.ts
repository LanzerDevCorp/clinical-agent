import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

/**
 * The clinical category a product belongs to (Rellenos, Toxinas, Hilos PDO...).
 * A product has exactly one category, mirroring `ProductTypes` in every other
 * respect: a plain admin-editable catalogue, `slug` as the stable key.
 */
export const Categories: CollectionConfig = {
  slug: 'categories',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Categoría',
      en: 'Categoría',
    },
    plural: {
      es: 'Categorías',
      en: 'Categorías',
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
