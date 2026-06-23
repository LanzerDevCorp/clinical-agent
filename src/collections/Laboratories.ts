import type { CollectionConfig } from 'payload'

export const Laboratories: CollectionConfig = {
  slug: 'laboratories',
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
