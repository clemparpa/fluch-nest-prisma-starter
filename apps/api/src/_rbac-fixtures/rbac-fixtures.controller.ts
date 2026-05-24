import { Controller, Get } from '@nestjs/common'
import {
  AllowAnonymous,
  MemberHasPermission,
  OrgRoles,
  Roles,
  UserHasPermission,
} from '@thallesp/nestjs-better-auth'

/**
 * Dev-only fixtures used by `auth-rbac.e2e.spec.ts` to exercise each thallesp
 * RBAC decorator on a trivial handler. Loaded by AppModule only when
 * NODE_ENV !== 'production'.
 */
@Controller('_rbac')
export class RbacFixturesController {
  @Get('system-admin')
  @Roles(['admin'])
  systemAdmin() {
    return { ok: true, route: 'system-admin' }
  }

  @Get('org-owner')
  @OrgRoles(['owner'])
  orgOwner() {
    return { ok: true, route: 'org-owner' }
  }

  @Get('user-delete-perm')
  @UserHasPermission({ permission: { user: ['delete'] } })
  userDeletePerm() {
    return { ok: true, route: 'user-delete-perm' }
  }

  @Get('member-create-perm')
  @MemberHasPermission({ permissions: { member: ['create'] } })
  memberCreatePerm() {
    return { ok: true, route: 'member-create-perm' }
  }

  @Get('public')
  @AllowAnonymous()
  publicRoute() {
    return { ok: true, route: 'public' }
  }
}
