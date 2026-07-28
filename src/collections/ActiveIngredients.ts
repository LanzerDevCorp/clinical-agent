import type { CollectionConfig } from 'payload'

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
  fields: [
    {
      name: 'name',
      label: 'Nombre del ingrediente activo',
      type: 'text',
      required: true,
    },
  ],
}
