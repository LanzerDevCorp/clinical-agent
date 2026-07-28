import type { CollectionConfig } from 'payload'

export const ClinicalNotes: CollectionConfig = {
  slug: 'clinical-notes',
  labels: {
    singular: 'Nota Clínica',
    plural: 'Notas Clínicas',
  },
  admin: {
    useAsTitle: 'description',
    group: 'Seguridad Clínica',
  },
  fields: [
    {
      name: 'type',
      label: 'Tipo de nota clínica',
      type: 'select',
      required: true,
      options: [
        { label: 'Indicación clínica', value: 'indicacion_clinica' },
        { label: 'Cuidado post-aplicación', value: 'cuidado_post_aplicacion' },
        { label: 'Advertencia de seguridad', value: 'advertencia_seguridad' },
      ],
    },
    {
      name: 'description',
      label: 'Descripción',
      type: 'textarea',
      required: true,
    },
  ],
}
