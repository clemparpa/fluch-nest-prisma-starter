import swc from 'unplugin-swc'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [swc.vite({ module: { type: 'es6' } })],
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.e2e.spec.ts'],
    setupFiles: ['test/setup.ts'],
    pool: 'forks',
    fileParallelism: false,
    testTimeout: 10_000,
    hookTimeout: 30_000,
    coverage: {
      provider: 'v8',
      include: ['src/users/**', 'src/auth/**'],
      exclude: ['**/*.dto.ts', '**/*.module.ts', 'src/generated/**'],
      reporter: ['text', 'html'],
      thresholds: { lines: 75, statements: 75, functions: 75, branches: 70 },
    },
  },
})
