import type { CollectionConfig } from 'payload'

export const ApplicationZones: CollectionConfig = {
  slug: 'application-zones',
  labels: {
    singular: 'Zona de Aplicación',
    plural: 'Zonas de Aplicación',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos Maestros',
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre de la zona',
      type: 'text',
      required: true,
    },
  ],
}
