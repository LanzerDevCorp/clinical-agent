import React from 'react'

import { ThemeProvider } from '@/components/theme-provider'

import './styles.css'

export const metadata = {
  description: 'Asistente clínico interno',
  title: 'Consulta clínica',
}

export default async function RootLayout(props: { children: React.ReactNode }) {
  const { children } = props

  return (
    <html lang="es" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
