import { describe, expect, it } from 'vitest'

import { parseIngestArguments, selectExtractedFiles } from '@/scripts/lib/extracted-file-selector'

const directJsonFiles = ['ALPHA.json', 'BETA.json', 'GAMMA.json']

describe('selectExtractedFiles', () => {
  it('keeps all direct JSON files when no selector is supplied', () => {
    expect(selectExtractedFiles(directJsonFiles, [])).toEqual(directJsonFiles)
  })

  it('selects one requested basename', () => {
    expect(selectExtractedFiles(directJsonFiles, ['BETA.json'])).toEqual(['BETA.json'])
  })

  it('keeps the requested order for multiple basenames', () => {
    expect(selectExtractedFiles(directJsonFiles, ['GAMMA.json', 'ALPHA.json'])).toEqual([
      'GAMMA.json',
      'ALPHA.json',
    ])
  })

  it('rejects a --file option without a value', () => {
    expect(() => parseIngestArguments(['--file'])).toThrow(/requires a basename/i)
  })

  it('rejects a basename that is not a direct JSON file', () => {
    expect(() => selectExtractedFiles(directJsonFiles, ['MISSING.json'])).toThrow(
      /direct JSON file/i,
    )
  })

  it.each(['../ALPHA.json', 'nested/ALPHA.json', 'nested\\ALPHA.json', 'C:\\batch\\ALPHA.json'])(
    'rejects traversal, separators, and absolute paths: %s',
    (file) => {
      expect(() => selectExtractedFiles(directJsonFiles, [file])).toThrow(
        /basename|separators|'\.\.'/i,
      )
    },
  )

  it('rejects a non-JSON extension', () => {
    expect(() => selectExtractedFiles(directJsonFiles, ['ALPHA.md'])).toThrow(/end in \.json/i)
  })

  it('rejects duplicate basenames', () => {
    expect(() => selectExtractedFiles(directJsonFiles, ['ALPHA.json', 'ALPHA.json'])).toThrow(
      /more than once/i,
    )
  })
})
