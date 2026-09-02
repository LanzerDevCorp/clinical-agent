import { headers as getHeaders } from 'next/headers.js'
import { redirect } from 'next/navigation'
import { getPayload } from 'payload'

import config from '@/payload.config'

import { ClinicalChat } from './ClinicalChat'

export const metadata = {
  title: 'Consulta clínica',
  description: 'Asistente clínico interno',
}

export default async function AgentPage() {
  const headers = await getHeaders()
  const payload = await getPayload({ config: await config })
  const { user } = await payload.auth({ headers })

  // The /api/chat route rejects anything that is not an authenticated `users`
  // document, so any other identity (an MCP API key, for instance) would render
  // the chat and then be denied on the first request.
  if (user?.collection !== 'users') redirect('/admin/login')

  const canViewCatalog = user.role === 'admin' || user.role === 'medico'

  return <ClinicalChat userEmail={user.email} canViewCatalog={canViewCatalog} />
}
