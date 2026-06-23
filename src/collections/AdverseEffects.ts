import type { CollectionConfig } from 'payload'

export const AdverseEffects: CollectionConfig = {
  slug: 'adverse-effects',
  admin: {
    useAsTitle: 'description',
    group: 'Contenido Clínico',
  },
  fields: [
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
  ],
}
