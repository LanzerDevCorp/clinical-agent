import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const PostCareNotes: CollectionConfig = {
  slug: 'post-care-notes',
  labels: {
    singular: {
      es: 'Cuidado Post-Aplicación',
      en: 'Cuidado Post-Aplicación',
    },
    plural: {
      es: 'Cuidados Post-Aplicación',
      en: 'Cuidados Post-Aplicación',
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
      label: 'Cuidado / Recomendación post-aplicación',
      type: 'textarea',
      required: true,
      unique: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
