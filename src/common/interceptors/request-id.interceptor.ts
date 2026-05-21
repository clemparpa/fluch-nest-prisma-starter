import { randomUUID } from 'node:crypto'
import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import type { Request, Response } from 'express'
import type { Observable } from 'rxjs'

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<Request & { id?: string }>()
    const res = ctx.switchToHttp().getResponse<Response>()
    const incoming = req.headers['x-request-id']
    const id = (typeof incoming === 'string' && incoming) || randomUUID()
    req.id = id
    res.setHeader('x-request-id', id)
    return next.handle()
  }
}
