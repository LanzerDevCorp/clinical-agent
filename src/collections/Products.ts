import type { CollectionConfig } from 'payload'
import { internalUsersOnly } from '../access/internalUsersOnly'
import { systemManagedField } from '../access/systemManaged'
import { syncProductToJson } from '../hooks/syncProductToJson'
import { createdBy, updatedBy } from './fields/attribution'
import { stampApproval } from './hooks/stampApproval'
import { stampAttribution } from './hooks/stampAttribution'
import { hiddenCreatedAt } from './fields/hiddenCreatedAt'

export const Products: CollectionConfig = {
  slug: 'products',
  access: {
    read: internalUsersOnly,
  },
  labels: {
    singular: {
      es: 'Producto',
      en: 'Producto',
    },
    plural: {
      es: 'Productos',
      en: 'Productos',
    },
  },
  hooks: {
    beforeChange: [stampAttribution, stampApproval],
    afterChange: [syncProductToJson],
  },
  admin: {
    useAsTitle: 'canonicalName',
    group: {
      es: 'Catálogo Clínico',
      en: 'Catálogo Clínico',
    },
    defaultColumns: ['canonicalName', 'productType', 'category', 'laboratory', 'validationStatus'],
    components: {
      edit: {
        beforeDocumentControls: ['@/components/ProductPdfAction'],
      },
    },
  },
  endpoints: [
    {
      path: '/:id/pdf',
      method: 'get',
      handler: async (req) => {
        const { createProductPdfResponse } = await import('@/lib/product-pdf/endpoint')
        return createProductPdfResponse(req, String(req.routeParams?.id ?? ''))
      },
    },
  ],
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
      name: 'approvedBy',
      label: 'Aprobado por',
      type: 'relationship',
      relationTo: 'users',
      access: {
        create: systemManagedField,
        update: systemManagedField,
      },
      admin: {
        hidden: true,
        disableListColumn: true,
      },
    },
    {
      name: 'approvedAt',
      label: 'Fecha de aprobación',
      type: 'date',
      access: {
        create: systemManagedField,
        update: systemManagedField,
      },
      admin: {
        hidden: true,
        disableListColumn: true,
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
              name: 'description',
              label: 'Descripción del producto',
              type: 'textarea',
            },
            {
              name: 'productType',
              label: 'Tipo de producto',
              type: 'relationship',
              relationTo: 'product-types',
            },
            {
              name: 'category',
              label: 'Categoría',
              type: 'relationship',
              relationTo: 'categories',
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
                  name: 'characteristics',
                  label: 'Características',
                  type: 'text',
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
                  name: 'certifications',
                  label: 'Certificaciones / Registros sanitarios',
                  type: 'text',
                },
                {
                  label: 'Seguridad Clínica',
                  type: 'collapsible',
                  admin: {
                    initCollapsed: false,
                  },
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
                    {
                      name: 'clinicalIndications',
                      label: 'Indicaciones clínicas',
                      type: 'relationship',
                      relationTo: 'clinical-indications',
                      hasMany: true,
                    },
                    {
                      name: 'postCareNotes',
                      label: 'Cuidados post-aplicación',
                      type: 'relationship',
                      relationTo: 'post-care-notes',
                      hasMany: true,
                    },
                    {
                      name: 'safetyWarnings',
                      label: 'Advertencias de seguridad',
                      type: 'relationship',
                      relationTo: 'safety-warnings',
                      hasMany: true,
                    },
                    {
                      name: 'protocols',
                      label: 'Protocolos de aplicación',
                      type: 'relationship',
                      relationTo: 'protocols',
                      hasMany: true,
                    },
                  ],
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
        {
          label: 'Ficha Técnica',
          fields: [],
        },
      ],
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
