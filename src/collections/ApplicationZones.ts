import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const ApplicationZones: CollectionConfig = {
  slug: 'application-zones',
  labels: {
    singular: {
      es: 'Zona de Aplicación',
      en: 'Zona de Aplicación',
    },
    plural: {
      es: 'Zonas de Aplicación',
      en: 'Zonas de Aplicación',
    },
  },
  admin: {
    useAsTitle: 'name',
    group: {
      es: 'Catálogos Maestros',
      en: 'Catálogos Maestros',
    },
  },
  hooks: {
    beforeChange: [stampAttribution],
  },
  fields: [
    {
      name: 'name',
      label: 'Nombre de la zona',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
