import type { CollectionConfig } from 'payload'

export const Users: CollectionConfig = {
  slug: 'users',
  labels: {
    singular: {
      es: 'Usuario',
      en: 'Usuario',
    },
    plural: {
      es: 'Usuarios',
      en: 'Usuarios',
    },
  },
  admin: {
    useAsTitle: 'email',
    group: {
      es: 'Administración',
      en: 'Administración',
    },
  },
  auth: true,
  fields: [
    // Email added by default
    // Add more fields as needed
  ],
}
