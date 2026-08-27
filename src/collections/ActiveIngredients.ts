import type { CollectionConfig } from 'payload'

import { hiddenCreatedAt } from './fields/hiddenCreatedAt'
import { createdBy, updatedBy } from './fields/attribution'
import { stampAttribution } from './hooks/stampAttribution'

export const ActiveIngredients: CollectionConfig = {
  slug: 'active-ingredients',
  labels: {
    singular: {
      es: 'Ingrediente Activo',
      en: 'Ingrediente Activo',
    },
    plural: {
      es: 'Ingredientes Activos',
      en: 'Ingredientes Activos',
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
      label: 'Nombre del ingrediente activo',
      type: 'text',
      required: true,
    },
    hiddenCreatedAt,
    createdBy,
    updatedBy,
  ],
}
