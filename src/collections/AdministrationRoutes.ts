import type { CollectionConfig } from 'payload'

export const AdministrationRoutes: CollectionConfig = {
  slug: 'administration-routes',
  labels: {
    singular: {
      es: 'Vía de Administración',
      en: 'Vía de Administración',
    },
    plural: {
      es: 'Vías de Administración',
      en: 'Vías de Administración',
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
      label: 'Nombre de la vía',
      type: 'text',
      required: true,
    },
  ],
}
