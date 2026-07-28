import type { CollectionConfig } from 'payload'

export const Laboratories: CollectionConfig = {
  slug: 'laboratories',
  labels: {
    singular: 'Laboratorio',
    plural: 'Laboratorios',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos Maestros',
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del laboratorio',
      type: 'text',
      required: true,
    },
  ],
}
