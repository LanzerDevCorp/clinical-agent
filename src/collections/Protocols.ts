import type { CollectionConfig } from 'payload'
import { internalUsersOnly } from '../access/internalUsersOnly'

export const Protocols: CollectionConfig = {
  slug: 'protocols',
  access: {
    read: internalUsersOnly,
  },
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
      name: 'clientShareable',
      label: 'Autorizado para compartir con clientes',
      type: 'checkbox',
      required: true,
      defaultValue: false,
      admin: {
        position: 'sidebar',
      },
    },
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
      name: 'visibleEffectsOnset',
      label: 'Inicio de efectos visibles',
      type: 'text',
    },
    {
      name: 'effectDuration',
      label: 'Duración del efecto',
      type: 'text',
    },
    {
      name: 'recommendedDose',
      label: 'Dosis recomendada y calibre de aguja',
      type: 'textarea',
    },
    {
      name: 'injectionDepth',
      label: 'Profundidad de inyección',
      type: 'text',
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
