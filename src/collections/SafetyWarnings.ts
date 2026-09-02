import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const SafetyWarnings: CollectionConfig = {
  slug: 'safety-warnings',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Advertencia de Seguridad',
      en: 'Advertencia de Seguridad',
    },
    plural: {
      es: 'Advertencias de Seguridad',
      en: 'Advertencias de Seguridad',
    },
  },
  admin: {
    useAsTitle: 'description',
    group: {
      es: 'Seguridad Clínica',
      en: 'Seguridad Clínica',
    },
  },
  hooks: {
    beforeChange: [stampAttribution],
  },
  fields: [
    {
      name: 'description',
      label: 'Advertencia de seguridad / precaución',
      type: 'textarea',
      required: true,
      unique: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
