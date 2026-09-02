import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const ApplicationTechniques: CollectionConfig = {
  slug: 'application-techniques',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Técnica de Aplicación',
      en: 'Técnica de Aplicación',
    },
    plural: {
      es: 'Técnicas de Aplicación',
      en: 'Técnicas de Aplicación',
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
      label: 'Nombre de la técnica',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
