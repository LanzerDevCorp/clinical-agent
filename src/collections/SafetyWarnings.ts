import type { CollectionConfig } from 'payload'

export const SafetyWarnings: CollectionConfig = {
  slug: 'safety-warnings',
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
  fields: [
    {
      name: 'description',
      label: 'Advertencia de seguridad / precaución',
      type: 'textarea',
      required: true,
      unique: true,
    },
  ],
}
