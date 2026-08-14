import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'node:path'

export default defineConfig({
  resolve: {
    alias: {
      'server-only': path.resolve(process.cwd(), 'tests/stubs/server-only.ts'),
    },
  },
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    // Two lanes on purpose. `tests/unit` holds specs with no database and no
    // Payload import, so they can be run at any time; `tests/int` cannot.
    include: ['tests/int/**/*.int.spec.{ts,tsx}', 'tests/unit/**/*.spec.{ts,tsx}'],
    // Integration specs talk to a remote managed Postgres, so a single test can
    // chain ~30 sequential round trips. Vitest's 5s default leaves no headroom.
    testTimeout: 20_000,
  },
})
