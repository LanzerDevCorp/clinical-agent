import type { CollectionConfig } from 'payload'

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
    read: () => true,
  },
  fields: [
    {
      name: 'alt',
      label: 'Texto alternativo (alt)',
      type: 'text',
      required: true,
    },
  ],
  upload: true,
}
