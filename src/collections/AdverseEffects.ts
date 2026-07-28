import type { CollectionConfig } from 'payload'

export const AdverseEffects: CollectionConfig = {
  slug: 'adverse-effects',
  labels: {
    singular: 'Efecto Adverso',
    plural: 'Efectos Adversos',
  },
  admin: {
    useAsTitle: 'description',
    group: 'Seguridad Clínica',
  },
  fields: [
    {
      name: 'description',
      label: 'Descripción del efecto adverso',
      type: 'textarea',
      required: true,
    },
  ],
}
