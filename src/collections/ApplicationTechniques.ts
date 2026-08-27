import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const ApplicationTechniques: CollectionConfig = {
  slug: 'application-techniques',
  labels: {
    singular: {
      es: 'Técnica de Aplicación',
      en: 'Técnica de Aplicación',
    },
    plural: {
      es: 'Técnicas de Aplicación',
      en: 'Técnicas de Aplicación',
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
      label: 'Nombre de la técnica',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
  ],
}
