import type { CollectionConfig } from 'payload'

export const ApplicationTechniques: CollectionConfig = {
  slug: 'application-techniques',
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
