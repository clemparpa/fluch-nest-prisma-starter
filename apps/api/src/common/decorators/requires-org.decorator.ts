import {
  applyDecorators,
  BadRequestException,
  type CanActivate,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime value for constructor injection metadata
import { Reflector } from '@nestjs/core'

const REQUIRES_ORG_META = 'requires-org'

type RequestWithSession = {
  session?: { session?: { activeOrganizationId?: string | null } | null } | null
}

@Injectable()
export class RequiresOrgGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const flag = this.reflector.getAllAndOverride<boolean>(REQUIRES_ORG_META, [
      ctx.getHandler(),
      ctx.getClass(),
    ])
    if (!flag) return true

    const req = ctx.switchToHttp().getRequest<RequestWithSession>()
    if (!req.session?.session?.activeOrganizationId) {
      throw new BadRequestException('No active organization on session')
    }
    return true
  }
}

export const RequiresOrg = () =>
  applyDecorators(SetMetadata(REQUIRES_ORG_META, true), UseGuards(RequiresOrgGuard))
