import type { CollectionConfig } from 'payload'

export const Protocols: CollectionConfig = {
  slug: 'protocols',
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo Clínico',
    defaultColumns: ['name', 'zone', 'route', 'technique', 'frequency'],
  },
  fields: [
    {
      name: 'name',
      type: 'text',
      required: true,
    },
    {
      name: 'zone',
      type: 'relationship',
      relationTo: 'application-zones',
      required: true,
    },
    {
      name: 'route',
      type: 'relationship',
      relationTo: 'administration-routes',
      required: true,
    },
    {
      name: 'technique',
      type: 'relationship',
      relationTo: 'application-techniques',
      required: true,
    },
    {
      name: 'sessionsMin',
      label: 'Sesiones mínimas',
      type: 'number',
    },
    {
      name: 'sessionsMax',
      label: 'Sesiones máximas',
      type: 'number',
    },
    {
      name: 'frequency',
      label: 'Frecuencia',
      type: 'text',
    },
  ],
}
