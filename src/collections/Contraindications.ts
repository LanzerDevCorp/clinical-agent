import type { CollectionConfig } from 'payload'
import { adminOrMedico } from '../access/adminOrMedico'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const Contraindications: CollectionConfig = {
  slug: 'contraindications',
  access: {
    read: adminOrMedico,
    create: adminOrMedico,
    update: adminOrMedico,
    delete: adminOrMedico,
  },
  labels: {
    singular: {
      es: 'Contraindicación',
      en: 'Contraindicación',
    },
    plural: {
      es: 'Contraindicaciones',
      en: 'Contraindicaciones',
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
      label: 'Descripción de la contraindicación',
      type: 'textarea',
      required: true,
    },
    {
      name: 'type',
      label: 'Tipo de contraindicación',
      type: 'select',
      required: true,
      options: [
        { label: 'Absoluta', value: 'absoluta' },
        { label: 'Relativa', value: 'relativa' },
      ],
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
