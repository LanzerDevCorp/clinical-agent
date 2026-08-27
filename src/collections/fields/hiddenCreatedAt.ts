import type { Field } from 'payload'

/**
 * `createdAt` is added automatically by `timestamps: true` (the default). When a
 * collection declares a field named `createdAt` itself, Payload's `sanitize`
 * step sees it and skips generating its own — so this definition REPLACES the
 * generated one rather than merging with it. It therefore mirrors every property
 * of the generated field (`type: 'date'`, `index: true`, the same `admin` flags
 * and label) and adds exactly one thing: `disableListColumn: true`.
 *
 * Net effect: same `created_at` column, same index, same edit-view behaviour —
 * the field just disappears from the list table and its column selector, while
 * `updatedAt` is left exactly as Payload generates it.
 *
 * See `node_modules/payload/dist/collections/config/sanitize.js` (the
 * `sanitized.timestamps !== false` block) for the generated shape this copies.
 */
export const hiddenCreatedAt: Field = {
  name: 'createdAt',
  type: 'date',
  index: true,
  label: ({ t }) => t('general:createdAt'),
  admin: {
    disableBulkEdit: true,
    disableListColumn: true,
    hidden: true,
  },
}
