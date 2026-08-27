import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Contraindications: CollectionConfig = {
  slug: 'contraindications',
  labels: {
    singular: {
      es: 'Contraindicación',
      en: 'Contraindicación',
    },
    plural: {
      es: 'Contraindicaciones',
      en: 'Contraindicaciones',
    },
  },
  admin: {
    useAsTitle: 'description',
    group: {
      es: 'Seguridad Clínica',
      en: 'Seguridad Clínica',
    },
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
    hiddenCreatedAt,
  ],
}
