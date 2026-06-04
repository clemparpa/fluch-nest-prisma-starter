import { allContracts } from '@fluch/api-contracts'
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

  app.enableShutdownHooks()

  await app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
