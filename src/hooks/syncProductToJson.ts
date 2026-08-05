import type { CollectionAfterChangeHook } from 'payload'

export const syncProductToJson: CollectionAfterChangeHook = async ({ doc }) => {
  // Los productos cargados viven exclusivamente en Payload. No se crean ni actualizan archivos JSON en disco.
  return doc
}
