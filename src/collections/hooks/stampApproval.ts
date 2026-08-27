import type { CollectionBeforeChangeHook } from 'payload'

/**
 * Records who approved a product and when, alongside `validationStatus`.
 *
 * The collection `beforeChange` hook only receives the fields the caller sent,
 * so the current status is `data.validationStatus` when the caller changed it,
 * otherwise whatever `originalDoc` already held.
 *
 * Rules:
 * - Resolved status `PENDING` clears both fields — a product that is not
 *   approved has no approver.
 * - Resolved status neither `APPROVED` nor `PENDING` — leave the data untouched.
 * - A product that was already `APPROVED` before this save is left completely
 *   untouched. An edit is never a re-approval: later changes are tracked by
 *   `updatedAt`, never by `approvedAt`, and the original approver is permanent
 *   even when it was never recorded.
 * - Otherwise this save is the `PENDING` → `APPROVED` transition (including a
 *   create that lands directly on `APPROVED`): `approvedAt` is always stamped
 *   with the current time — the approval time is known — and `approvedBy` is the
 *   acting `users` principal, or `null` when there is no acting user.
 */
export const stampApproval: CollectionBeforeChangeHook = ({ data, originalDoc, req }) => {
  const nextStatus = (data.validationStatus ?? originalDoc?.validationStatus) as string | undefined

  if (nextStatus === 'PENDING') {
    return { ...data, approvedBy: null, approvedAt: null }
  }

  if (nextStatus !== 'APPROVED') return data

  if (originalDoc?.validationStatus === 'APPROVED') return data

  const approverId = req.user?.collection === 'users' ? req.user.id : null

  return { ...data, approvedBy: approverId, approvedAt: new Date().toISOString() }
}
