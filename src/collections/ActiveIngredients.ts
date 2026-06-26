import type { CollectionConfig } from 'payload'

export const ActiveIngredients: CollectionConfig = {
  slug: 'active-ingredients',
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
