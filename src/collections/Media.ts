import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'
import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: {
      es: 'Archivo Multimedia',
      en: 'Archivo Multimedia',
    },
    plural: {
      es: 'Multimedia',
      en: 'Multimedia',
    },
  },
  admin: {
    group: {
      es: 'Catálogo Clínico',
      en: 'Catálogo Clínico',
    },
  },
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo (alt)',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
  ],
  upload: true,
}
