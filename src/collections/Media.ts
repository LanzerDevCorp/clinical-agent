import type { CollectionConfig } from 'payload'

export const Media: CollectionConfig = {
  slug: 'media',
  labels: {
    singular: 'Archivo Multimedia',
    plural: 'Multimedia',
  },
  admin: {
    group: 'Catálogo Clínico',
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
