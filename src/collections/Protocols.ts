import type { CollectionConfig } from 'payload'

export const Protocols: CollectionConfig = {
  slug: 'protocols',
  labels: {
    singular: 'Protocolo de Aplicación',
    plural: 'Protocolos de Aplicación',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogo Clínico',
    defaultColumns: ['name', 'zone', 'route', 'technique', 'frequency'],
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del protocolo',
      type: 'text',
      required: true,
    },
    {
      name: 'zone',
      label: 'Zona de aplicación',
      type: 'relationship',
      relationTo: 'application-zones',
      required: true,
    },
    {
      name: 'route',
      label: 'Vía de administración',
      type: 'relationship',
      relationTo: 'administration-routes',
      required: true,
    },
    {
      name: 'technique',
      label: 'Técnica de aplicación',
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
      label: 'Frecuencia de aplicación',
      type: 'text',
    },
  ],
}
