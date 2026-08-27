import type { FieldAccess } from 'payload'

/**
 * A field whose value the server owns end to end — written only by a
 * `beforeChange` hook, never by a client. Returning `false` for `create` and
 * `update` strips any incoming value before hooks run and makes Payload render
 * the field read-only in the admin, so "who / when" can never be typed in by
 * hand.
 */
export const systemManagedField: FieldAccess = () => false
