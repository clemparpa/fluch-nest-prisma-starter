import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import { Observable } from 'rxjs'
import { tenantStorage } from './tenant.storage'

type RequestWithSession = {
  session?: { session?: { activeOrganizationId?: string | null } | null } | null
}

@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest<RequestWithSession>()
    const orgId = req.session?.session?.activeOrganizationId

    // No active org → no store. tenant-extension will throw if any
    // tenant-scoped model is touched (defensive). Never coerce to null.
    if (!orgId) {
      return next.handle()
    }

    // Wrap the subscription inside ALS so that all async work performed
    // by the handler observes the tenant context.
    return new Observable((subscriber) => {
      tenantStorage.run({ tenantId: orgId }, () => {
        next.handle().subscribe(subscriber)
      })
    })
  }
}
