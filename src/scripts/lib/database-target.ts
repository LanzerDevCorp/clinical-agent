const LOCAL_DATABASE_HOSTS = ['localhost', '127.0.0.1', '::1', 'host.docker.internal']

/** Pulls the bare host out of a Postgres connection string, ignoring port and path/query. */
export function hostFromConnectionString(connectionString: string): string {
  const authority = connectionString.replace(/^[^:]+:\/\//, '').split('@').pop() ?? ''
  return (
    authority
      .split('/')[0]
      ?.split('?')[0]
      ?.replace(/:\d+$/, '') ?? ''
  )
}

export function isLocalDatabaseHost(host: string): boolean {
  return LOCAL_DATABASE_HOSTS.includes(host)
}

/**
 * Guards a script that must only ever write to a remote (production) database.
 * Two independent conditions, both required: the target is genuinely not local,
 * and the operator set ALLOW_REMOTE_DATABASE=1 on this one command.
 */
export function assertRemoteDatabase(connectionString: string, allowRemoteDatabase: string | undefined) {
  const host = hostFromConnectionString(connectionString)

  if (isLocalDatabaseHost(host)) {
    throw new Error(
      `Refusing: DATABASE_URL points at "${host}", a local host. This script only ever targets ` +
        'a remote database — point DATABASE_URL at production first.',
    )
  }

  if (allowRemoteDatabase !== '1') {
    throw new Error(
      'Refusing: set ALLOW_REMOTE_DATABASE=1 on this command to write to a remote database.',
    )
  }
}
