import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { allContracts } from '@fluch/api-contracts'
import { RequestMethod } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule } from '@nestjs/swagger'
import { generateOpenApi } from '@ts-rest/open-api'
import compression from 'compression'
import cookieParser from 'cookie-parser'
import type { Express } from 'express'
import helmet from 'helmet'
import { AppModule } from './app.module'
import { AppLogger } from './logger/app-logger.service'
import { initSentry } from './observability/sentry'

async function bootstrap() {
  initSentry()

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
    // bodyParser disabled here — AuthModule.forRootAsync installs the express
    // body parsers globally (1mb json/urlencoded). See app.module.ts.
    bodyParser: false,
  })

  app.useLogger(app.get(AppLogger))
  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(compression())
  app.use(cookieParser())

  // All Nest routes live under /api. Health stays at root (LB-friendly,
  // version-neutral). better-auth mounts /api/auth/* via raw express
  // middleware before Nest's router, so setGlobalPrefix doesn't touch it.
  app.setGlobalPrefix('api', {
    exclude: [{ path: 'health', method: RequestMethod.GET }],
  })

  app.enableCors({
    origin: process.env.CORS_ORIGIN?.split(',') ?? false,
    credentials: true,
  })

  // OpenAPI doc derived from ts-rest contracts (Zod schemas → OpenAPI).
  // @nestjs/swagger native decorators don't understand our generated Zod
  // schemas, so we route the spec through @ts-rest/open-api instead.
  const openApiDoc = generateOpenApi(allContracts, {
    info: { title: 'fluch-api', version: '1.0' },
  })
  // Mirror Nest's setGlobalPrefix: prefix every path with /api except /health.
  openApiDoc.paths = Object.fromEntries(
    Object.entries(openApiDoc.paths ?? {}).map(([path, pathItem]) => [
      path === '/health' ? path : `/api${path}`,
      pathItem,
    ]),
  )
  if (process.env.NODE_ENV !== 'production') {
    SwaggerModule.setup('docs', app, openApiDoc as never)
  }
  // /docs-json stays exposed in prod for front codegen & observability tools.
  // Mount via the raw express instance — Nest's HttpAdapter.get() handler types
  // diverge from express' RequestHandler signature.
  const express = app.getHttpAdapter().getInstance() as Express
  express.get('/docs-json', (_req, res) => {
    res.json(openApiDoc)
  })

  // SPA fallback : refresh sur une route client React Router (/dashboard, etc.)
  // renvoie index.html. Skip /api/*, /health, /docs*, et tout path avec extension
  // (assets déjà servis par @nestjs/serve-static avec fallthrough true).
  const indexHtml = join(__dirname, '..', 'public', 'index.html')
  if (existsSync(indexHtml)) {
    express.use((req, res, next) => {
      if (req.method !== 'GET') return next()
      if (
        req.path.startsWith('/api/') ||
        req.path === '/health' ||
        req.path.startsWith('/docs') ||
        req.path.includes('.')
      ) {
        return next()
      }
      res.sendFile(indexHtml)
    })
  }

  app.enableShutdownHooks()

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
