import type { CollectionConfig } from 'payload'

export const ActiveIngredients: CollectionConfig = {
  slug: 'active-ingredients',
  labels: {
    singular: 'Ingrediente Activo',
    plural: 'Ingredientes Activos',
  },
  admin: {
    useAsTitle: 'name',
    group: 'Catálogos Maestros',
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
