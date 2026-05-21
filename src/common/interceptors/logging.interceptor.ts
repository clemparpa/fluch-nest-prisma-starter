import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import { type Observable, tap } from 'rxjs'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { AppLogger } from '../../logger/app-logger.service'

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLogger) {}

  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { id?: string }>()
    const res = ctx.switchToHttp().getResponse<Response>()
    const { method, originalUrl } = req
    const start = Date.now()

    return next.handle().pipe(
      tap({
        next: () => {
          const ms = Date.now() - start
          this.logger.log(`${method} ${originalUrl} ${res.statusCode} ${ms}ms`, 'HTTP')
        },
        error: (err: unknown) => {
          const ms = Date.now() - start
          const status =
            err instanceof Error && 'status' in err ? (err as { status: number }).status : 500
          this.logger.error(`${method} ${originalUrl} ${status} ${ms}ms`, undefined, 'HTTP')
        },
      }),
    )
  }
}
