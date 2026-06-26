import type { CollectionConfig } from 'payload'

export const Contraindications: CollectionConfig = {
  slug: 'contraindications',
  admin: {
    useAsTitle: 'description',
    group: 'Catálogo Clínico',
  },
  fields: [
    {
      name: 'description',
      type: 'textarea',
      required: true,
    },
    {
      name: 'type',
      type: 'select',
      required: true,
      options: [
        { label: 'Absoluta', value: 'absoluta' },
        { label: 'Relativa', value: 'relativa' },
      ],
    },
  ],
}
