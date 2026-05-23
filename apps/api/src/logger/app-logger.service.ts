import { ConsoleLogger, Injectable, type LogLevel } from '@nestjs/common'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { ConfigService } from '@nestjs/config'
import type { Env } from '../config/env.schema'

// Mapping LOG_LEVEL Pino-style (notre env) → LogLevel[] Nest cascading.
// Nest cascade: verbose < debug < log < warn < error < fatal.
const LEVEL_CASCADE: Record<Env['LOG_LEVEL'], LogLevel[]> = {
  trace: ['verbose', 'debug', 'log', 'warn', 'error', 'fatal'],
  debug: ['debug', 'log', 'warn', 'error', 'fatal'],
  info: ['log', 'warn', 'error', 'fatal'],
  warn: ['warn', 'error', 'fatal'],
  error: ['error', 'fatal'],
}

@Injectable()
export class AppLogger extends ConsoleLogger {
  constructor(config: ConfigService<Env, true>) {
    const isProd = config.get('NODE_ENV', { infer: true }) === 'production'
    super({
      json: isProd,
      colors: !isProd,
      logLevels: LEVEL_CASCADE[config.get('LOG_LEVEL', { infer: true })],
      timestamp: true,
    })
  }
}
