import type { CollectionConfig } from 'payload'

export const Laboratories: CollectionConfig = {
  slug: 'laboratories',
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
