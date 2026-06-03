import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

const swcPlugin = swc.vite({ module: { type: 'es6' } })

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/users/**', 'src/auth/**', 'src/prisma/**', 'src/tenant/**'],
      exclude: ['**/*.dto.ts', '**/*.module.ts', 'src/generated/**'],
      reporter: ['text', 'html'],
      thresholds: { lines: 75, statements: 75, functions: 75, branches: 70 },
    },
    projects: [
      {
        plugins: [swcPlugin],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'unit',
          globals: true,
          environment: 'node',
          include: ['test/**/*.unit.spec.ts'],
        },
      },
      {
        plugins: [swcPlugin],
        resolve: { tsconfigPaths: true },
        test: {
          name: 'e2e',
          globals: true,
          environment: 'node',
          include: ['test/**/*.e2e.spec.ts'],
          globalSetup: ['test/globalSetup.ts'],
          setupFiles: ['test/setup.ts'],
          pool: 'forks',
          // Container Postgres unique, donc un seul fork à la fois pour éviter
          // les collisions entre fichiers (TRUNCATE concurrent + seedAdmin).
          fileParallelism: false,
          testTimeout: 10_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
})
