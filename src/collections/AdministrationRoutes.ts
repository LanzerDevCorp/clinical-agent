import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const AdministrationRoutes: CollectionConfig = {
  slug: 'administration-routes',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Vía de Administración',
      en: 'Vía de Administración',
    },
    plural: {
      es: 'Vías de Administración',
      en: 'Vías de Administración',
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
      label: 'Nombre de la vía',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
