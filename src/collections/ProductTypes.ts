import type { CollectionConfig } from 'payload'

/**
 * The product "type" used to be a hardcoded `select` on Products (a PG enum), so
 * adding one — "Gel", say — meant a code change, a migration and a deploy. It is
 * a plain catalogue of labels, so it belongs in a collection the admin can edit.
 *
 * `slug` is the stable key. Fixtures and the ingest script refer to a type by
 * its slug, never its id, so renaming `name` is safe but changing `slug` breaks
 * every fixture that names it.
 */
export const ProductTypes: CollectionConfig = {
  slug: 'product-types',
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
    defaultColumns: ['name', 'slug'],
    group: {
      es: 'Catálogos Maestros',
      en: 'Catálogos Maestros',
    },
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
        description:
          'Clave estable que usan las fixtures y el script de ingesta para referirse a este tipo. ' +
          'No debe cambiar una vez asignada.',
      },
      hooks: {
        beforeValidate: [
          ({ value }) =>
            typeof value === 'string'
              ? value.trim().toLowerCase().replace(/\s+/g, '_')
              : value,
        ],
      },
    },
  ],
}
