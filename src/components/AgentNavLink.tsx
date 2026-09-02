'use client'

import { Button } from '@payloadcms/ui'

/**
 * Every role reaches /agent — admin, medico and the sales 'user' role alike —
 * so this carries no access check, unlike RedirectSalesToAccount.
 */
export default function AgentNavLink() {
  return (
    <Button buttonStyle="pill" el="link" size="medium" url="/agent">
      Consulta clínica
    </Button>
  )
}
