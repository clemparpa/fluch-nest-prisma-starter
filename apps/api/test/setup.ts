import { type INestApplication, RequestMethod } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { afterAll, beforeAll } from 'vitest'
import { AppModule } from '@/app.module'

let app: INestApplication | undefined

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile()
  app = moduleRef.createNestApplication({ bodyParser: false })
  // Mirror main.ts: routes live under /api except /health.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  })
  await app.init()
  ;(globalThis as Record<string, unknown>).__APP__ = app
})

afterAll(async () => {
  await app?.close()
})
