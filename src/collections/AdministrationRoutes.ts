import type { CollectionConfig } from 'payload'

export const AdministrationRoutes: CollectionConfig = {
  slug: 'administration-routes',
  admin: {
    useAsTitle: 'name',
    group: 'Taxonomías',
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
  ],
}
