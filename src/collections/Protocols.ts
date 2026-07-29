import type { CollectionConfig } from 'payload'

export const Protocols: CollectionConfig = {
  slug: 'protocols',
  labels: {
    singular: {
      es: 'Protocolo de Aplicación',
      en: 'Protocolo de Aplicación',
    },
    plural: {
      es: 'Protocolos de Aplicación',
      en: 'Protocolos de Aplicación',
    },
  },
  admin: {
    useAsTitle: 'name',
    group: {
      es: 'Catálogo Clínico',
      en: 'Catálogo Clínico',
    },
    defaultColumns: ['name', 'frequency'],
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre del protocolo',
      type: 'text',
      required: true,
    },
    {
      name: 'zones',
      label: 'Zonas de aplicación',
      type: 'relationship',
      relationTo: 'application-zones',
      hasMany: true,
      required: true,
    },
    {
      name: 'routes',
      label: 'Vías de administración',
      type: 'relationship',
      relationTo: 'administration-routes',
      hasMany: true,
      required: true,
    },
    {
      name: 'techniques',
      label: 'Técnicas de aplicación',
      type: 'relationship',
      relationTo: 'application-techniques',
      hasMany: true,
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
