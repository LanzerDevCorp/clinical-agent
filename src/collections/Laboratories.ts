import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Laboratories: CollectionConfig = {
  slug: 'laboratories',
  labels: {
    singular: {
      es: 'Laboratorio',
      en: 'Laboratorio',
    },
    plural: {
      es: 'Laboratorios',
      en: 'Laboratorios',
    },
  },
  admin: {
    useAsTitle: 'name',
    group: {
      es: 'Catálogos Maestros',
      en: 'Catálogos Maestros',
    },
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del laboratorio',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
  ],
}
