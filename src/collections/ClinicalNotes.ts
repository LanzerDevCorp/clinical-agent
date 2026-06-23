import type { CollectionConfig } from 'payload'

export const ClinicalNotes: CollectionConfig = {
  slug: 'clinical-notes',
  admin: {
    useAsTitle: 'description',
    group: 'Contenido Clínico',
  },
  fields: [
    {
      name: 'type',
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
      type: 'textarea',
      required: true,
    },
  ],
}
