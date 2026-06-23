import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'canonicalName',
    group: 'Catálogo',
    defaultColumns: ['canonicalName', 'productType', 'laboratory', 'validationStatus'],
  },
  fields: [
    {
      name: 'canonicalName',
      label: 'Nombre canónico',
      type: 'text',
      required: true,
    },
    {
      name: 'productType',
      label: 'Tipo de producto',
      type: 'select',
      options: [
        { label: 'Otro', value: 'otro' },
      ],
    },
    {
      name: 'laboratory',
      label: 'Laboratorio',
      type: 'relationship',
      relationTo: 'laboratories',
      required: true,
    },
    {
      name: 'activeIngredients',
      label: 'Ingredientes activos',
      type: 'relationship',
      relationTo: 'active-ingredients',
      hasMany: true,
    },
    {
      name: 'contraindications',
      label: 'Contraindicaciones',
      type: 'relationship',
      relationTo: 'contraindications',
      hasMany: true,
    },
    {
      name: 'adverseEffects',
      label: 'Efectos adversos',
      type: 'relationship',
      relationTo: 'adverse-effects',
      hasMany: true,
    },
    {
      name: 'aliases',
      label: 'Sinónimos del producto',
      type: 'array',
      fields: [
        {
          name: 'term',
          type: 'text',
          required: true,
        },
      ],
    },
    {
      name: 'validationStatus',
      label: 'Estado de validación',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Requiere revisión clínica', value: 'NEEDS_CLINICAL_REVIEW' },
        { label: 'Aprobado', value: 'APPROVED' },
      ],
    },
    {
      name: 'validationNotes',
      label: 'Notas de validación',
      type: 'textarea',
      admin: {
        condition: (data) => data?.validationStatus === 'NEEDS_CLINICAL_REVIEW',
      },
    },
    {
      name: 'presentations',
      label: 'Presentaciones comerciales',
      type: 'array',
      fields: [
        {
          name: 'canonicalName',
          label: 'Nombre canónico',
          type: 'text',
          required: true,
        },
        {
          name: 'status',
          label: 'Estado',
          type: 'select',
          options: [
            { label: 'Activa', value: 'activa' },
            { label: 'Descontinuada', value: 'descontinuada' },
          ],
          defaultValue: 'activa',
        },
        {
          name: 'aliases',
          label: 'Sinónimos de la presentación',
          type: 'array',
          fields: [
            {
              name: 'term',
              type: 'text',
              required: true,
            },
          ],
        },
        {
          name: 'clinicalNotes',
          label: 'Notas clínicas',
          type: 'relationship',
          relationTo: 'clinical-notes',
          hasMany: true,
        },
        {
          name: 'protocols',
          label: 'Protocolos de aplicación',
          type: 'relationship',
          relationTo: 'protocols',
          hasMany: true,
        },
        {
          name: 'reconstitution',
          label: 'Reconstitución / Dilución',
          type: 'group',
          fields: [
            {
              name: 'diluentType',
              label: 'Tipo de diluyente',
              type: 'text',
            },
            {
              name: 'volumeMl',
              label: 'Volumen (mL)',
              type: 'number',
            },
            {
              name: 'instructions',
              label: 'Instrucciones',
              type: 'textarea',
            },
          ],
        },
      ],
    },
  ],
}
