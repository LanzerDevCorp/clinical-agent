import type { CollectionConfig } from 'payload'

export const ApplicationZones: CollectionConfig = {
  slug: 'application-zones',
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
