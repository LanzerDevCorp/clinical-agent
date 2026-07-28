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
