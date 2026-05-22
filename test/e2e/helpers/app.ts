import type { INestApplication } from '@nestjs/common'

export function getApp(): INestApplication {
  const app = (globalThis as Record<string, unknown>).__APP__ as INestApplication | undefined
  if (!app) throw new Error('App not bootstrapped — check test/setup.ts')
  return app
}

export function getHttpServer() {
  return getApp().getHttpServer()
}
