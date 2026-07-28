import type { CollectionConfig } from 'payload'

export const AdministrationRoutes: CollectionConfig = {
  slug: 'administration-routes',
  labels: {
    singular: 'Vía de Administración',
    plural: 'Vías de Administración',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos Maestros',
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
