'use client'
import { useRowLabel } from '@payloadcms/ui'

export const PresentationRowLabel = () => {
  const { data, rowNumber } = useRowLabel<{ canonicalName?: string }>()
  const index = typeof rowNumber === 'number' ? rowNumber + 1 : ''
  return data?.canonicalName || `Presentación ${index}`
}
