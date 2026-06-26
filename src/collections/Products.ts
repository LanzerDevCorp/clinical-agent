import type { CollectionConfig } from 'payload'

export const Products: CollectionConfig = {
  slug: 'products',
  admin: {
    useAsTitle: 'canonicalName',
    group: 'Catálogo Clínico',
    defaultColumns: ['canonicalName', 'productType', 'laboratory', 'validationStatus'],
  },
  fields: [
    {
      name: 'validationStatus',
      label: 'Estado de validación',
      type: 'select',
      required: true,
      defaultValue: 'PENDING',
      options: [
        { label: 'Pendiente', value: 'PENDING' },
        { label: 'Aprobado', value: 'APPROVED' },
      ],
      admin: {
        position: 'sidebar',
      },
    },
    {
      name: 'validationNotes',
      label: 'Notas de validación',
      type: 'textarea',
      admin: {
        position: 'sidebar',
      },
    },
    {
      type: 'tabs',
      tabs: [
        {
          label: 'General',
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
          ],
        },
        {
          label: 'Seguridad Clínica',
          fields: [
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
          ],
        },
        {
          label: 'Presentaciones',
          fields: [
            {
              name: 'presentations',
              label: 'Presentaciones comerciales',
              type: 'array',
              admin: {
                initCollapsed: true,
                components: {
                  RowLabel: '@/components/PresentationRowLabel',
                },
              },
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
        },
      ],
    },
  ],
}
