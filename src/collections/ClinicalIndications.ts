import type { CollectionConfig } from 'payload'

export const ClinicalIndications: CollectionConfig = {
  slug: 'clinical-indications',
  labels: {
    singular: {
      es: 'Indicación Clínica',
      en: 'Indicación Clínica',
    },
    plural: {
      es: 'Indicaciones Clínicas',
      en: 'Indicaciones Clínicas',
    },
  },
  admin: {
    useAsTitle: 'name',
    group: {
      es: 'Seguridad Clínica',
      en: 'Seguridad Clínica',
    },
  },
  fields: [
    {
      name: 'name',
      label: 'Indicación clínica',
      type: 'text',
      required: true,
      unique: true,
    },
  ],
}
