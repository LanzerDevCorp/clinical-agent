import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

/**
 * A 'user' (sales) account has no reason to land on the Dashboard — every
 * catalogue collection denies it, so the cards would be empty anyway. Its own
 * profile is the only thing it can reach, so send it straight there.
 *
 * Runs as a `beforeDashboard` root component specifically because that slot
 * renders additively, ahead of the real Dashboard — admin and medico keep the
 * stock Dashboard completely untouched.
 */
export default async function RedirectSalesToAccount() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers })

  if (user?.collection === 'users' && user.role === 'user') redirect('/admin/account')

  return null
}
