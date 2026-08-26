import { describe, expect, it } from 'vitest'

import {
  assertRemoteDatabase,
  hostFromConnectionString,
  isLocalDatabaseHost,
} from '@/scripts/lib/database-target'

describe('hostFromConnectionString', () => {
  it('extracts the host with a port', () => {
    expect(hostFromConnectionString('postgresql://user:pass@db.example.com:5432/prod')).toBe(
      'db.example.com',
    )
  })

  it('extracts the host without a port', () => {
    expect(hostFromConnectionString('postgresql://user:pass@127.0.0.1/postgres')).toBe(
      '127.0.0.1',
    )
  })

  it('strips query parameters', () => {
    expect(
      hostFromConnectionString('postgresql://user:pass@db.example.com:6543/prod?sslmode=require'),
    ).toBe('db.example.com')
  })

  it('handles a bracketed IPv6 host', () => {
    expect(hostFromConnectionString('postgresql://user:pass@[::1]:5432/postgres')).toBe('[::1]')
  })
})

describe('isLocalDatabaseHost', () => {
  it.each(['localhost', '127.0.0.1', '::1', 'host.docker.internal'])(
    'treats %s as local',
    (host) => {
      expect(isLocalDatabaseHost(host)).toBe(true)
    },
  )

  it('treats a real hostname as not local', () => {
    expect(isLocalDatabaseHost('db.supabase.co')).toBe(false)
  })
})

describe('assertRemoteDatabase', () => {
  it('rejects a local target even with ALLOW_REMOTE_DATABASE set', () => {
    expect(() =>
      assertRemoteDatabase('postgresql://postgres:postgres@127.0.0.1:54322/postgres', '1'),
    ).toThrow(/local host/i)
  })

  it('rejects a remote target without ALLOW_REMOTE_DATABASE', () => {
    expect(() =>
      assertRemoteDatabase('postgresql://user:pass@db.supabase.co:5432/postgres', undefined),
    ).toThrow(/ALLOW_REMOTE_DATABASE/)
  })

  it('accepts a remote target with ALLOW_REMOTE_DATABASE=1', () => {
    expect(() =>
      assertRemoteDatabase('postgresql://user:pass@db.supabase.co:5432/postgres', '1'),
    ).not.toThrow()
  })
})
