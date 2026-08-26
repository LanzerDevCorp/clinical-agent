import path from 'node:path'

export type IngestArguments = {
  dryRun: boolean
  requestedFiles: string[]
}

export function parseIngestArguments(args: readonly string[]): IngestArguments {
  const requestedFiles: string[] = []
  let dryRun = false

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--file') {
      const file = args[index + 1]
      if (!file || file.startsWith('--')) {
        throw new Error('--file requires a basename ending in .json')
      }
      requestedFiles.push(file)
      index += 1
      continue
    }

    if (arg.startsWith('--file=')) {
      throw new Error('Use --file <basename.json>; --file= is not supported')
    }
  }

  return { dryRun, requestedFiles }
}

function assertSafeBasename(file: string) {
  if (path.isAbsolute(file) || path.win32.isAbsolute(file) || path.posix.isAbsolute(file)) {
    throw new Error(`--file must be a basename, not an absolute path: ${file}`)
  }
  if (file.includes('/') || file.includes('\\')) {
    throw new Error(`--file must not contain path separators: ${file}`)
  }
  if (file.includes('..')) {
    throw new Error(`--file must not contain '..': ${file}`)
  }
  if (!file.endsWith('.json')) {
    throw new Error(`--file must end in .json: ${file}`)
  }
}

/** Requested files retain CLI order; no selector preserves directory enumeration order. */
export function selectExtractedFiles(
  directJsonFiles: readonly string[],
  requestedFiles: readonly string[],
): string[] {
  if (requestedFiles.length === 0) return [...directJsonFiles]

  const available = new Set(directJsonFiles)
  const selected = new Set<string>()

  for (const file of requestedFiles) {
    assertSafeBasename(file)
    if (selected.has(file)) {
      throw new Error(`--file was specified more than once: ${file}`)
    }
    if (!available.has(file)) {
      throw new Error(`--file must name a direct JSON file in the extracted directory: ${file}`)
    }
    selected.add(file)
  }

  return [...requestedFiles]
}
