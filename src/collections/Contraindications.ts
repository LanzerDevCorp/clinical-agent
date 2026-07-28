import type { CollectionConfig } from 'payload'

export const Contraindications: CollectionConfig = {
  slug: 'contraindications',
  labels: {
    singular: 'Contraindicación',
    plural: 'Contraindicaciones',
  },
  admin: {
    useAsTitle: 'description',
    group: 'Seguridad Clínica',
  },
  fields: [
    {
      name: 'description',
      label: 'Descripción de la contraindicación',
      type: 'textarea',
      required: true,
    },
    {
      name: 'type',
      label: 'Tipo de contraindicación',
      type: 'select',
      required: true,
      options: [
        { label: 'Absoluta', value: 'absoluta' },
        { label: 'Relativa', value: 'relativa' },
      ],
    },
  ],
}
