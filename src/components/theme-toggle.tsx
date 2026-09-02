'use client'

import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

import { Button } from '@/components/ui/button'

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) {
    return <Button type="button" variant="ghost" size="sm" aria-hidden className="invisible" />
  }

  const dark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      aria-pressed={dark}
      aria-label={dark ? 'Usar tema claro' : 'Usar tema oscuro'}
      onClick={() => setTheme(dark ? 'light' : 'dark')}
    >
      {dark ? 'Tema claro' : 'Tema oscuro'}
    </Button>
  )
}
