import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const AdverseEffects: CollectionConfig = {
  slug: 'adverse-effects',
  labels: {
    singular: {
      es: 'Efecto Adverso',
      en: 'Efecto Adverso',
    },
    plural: {
      es: 'Efectos Adversos',
      en: 'Efectos Adversos',
    },
  },
  admin: {
    useAsTitle: 'description',
    group: {
      es: 'Seguridad Clínica',
      en: 'Seguridad Clínica',
    },
  },
  hooks: {
    beforeChange: [stampAttribution],
  },
  fields: [
    {
      name: 'description',
      label: 'Descripción del efecto adverso',
      type: 'textarea',
      required: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
