'use client'

import { useTheme } from '@payloadcms/ui'
import { Moon, Sun } from 'lucide-react'

/**
 * Payload's own theme (light/dark/auto, from useTheme — distinct from the
 * next-themes setup that powers /agent) is otherwise only switchable from the
 * account page, so /admin/login starts and stays on whatever OS/cookie
 * default it resolved to. This is the same toggle, just reachable pre-login.
 */
export default function LoginThemeToggle() {
  const { theme, setTheme } = useTheme()
  const dark = theme === 'dark'

  return (
    <div
      style={{
        position: 'fixed',
        right: 20,
        top: 20,
        zIndex: 20,
      }}
    >
      <button
        aria-label={dark ? 'Usar tema claro' : 'Usar tema oscuro'}
        aria-pressed={dark}
        onClick={() => setTheme(dark ? 'light' : 'dark')}
        style={{
          alignItems: 'center',
          background: 'var(--theme-elevation-100)',
          border: '1px solid var(--theme-elevation-150)',
          borderRadius: 'var(--style-radius-m)',
          color: 'var(--theme-elevation-800)',
          cursor: 'pointer',
          display: 'inline-flex',
          justifyContent: 'center',
          padding: 8,
        }}
        type="button"
      >
        {dark ? <Sun size={16} /> : <Moon size={16} />}
      </button>
    </div>
  )
}
