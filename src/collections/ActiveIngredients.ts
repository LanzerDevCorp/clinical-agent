import type { CollectionConfig } from 'payload'

export const ActiveIngredients: CollectionConfig = {
  slug: 'active-ingredients',
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
