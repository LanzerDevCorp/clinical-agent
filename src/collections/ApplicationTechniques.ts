import type { CollectionConfig } from 'payload'

export const ApplicationTechniques: CollectionConfig = {
  slug: 'application-techniques',
  labels: {
    singular: 'Técnica de Aplicación',
    plural: 'Técnicas de Aplicación',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos Maestros',
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre de la técnica',
      type: 'text',
      required: true,
    },
  ],
}
