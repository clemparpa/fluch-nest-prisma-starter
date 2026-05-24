import { usersContract } from '@fluch/api-contracts'
import { Controller, ForbiddenException } from '@nestjs/common'
import { Roles } from '@thallesp/nestjs-better-auth'
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest'
import { CurrentUser, type CurrentUserPayload } from '@/common/decorators/current-user.decorator'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { UsersService } from './users.service'

@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @TsRestHandler(usersContract.getMe)
  getMe(@CurrentUser() me: CurrentUserPayload) {
    return tsRestHandler(usersContract.getMe, async () => {
      const user = await this.usersService.findById(me.id)
      return { status: 200, body: user }
    })
  }

  @TsRestHandler(usersContract.updateMe)
  updateMe(@CurrentUser() me: CurrentUserPayload) {
    return tsRestHandler(usersContract.updateMe, async ({ body }) => {
      const updated = await this.usersService.updateMe(me.id, body)
      return { status: 200, body: updated }
    })
  }

  // "self OR admin" — not expressible as a single decorator; check stays inline.
  @TsRestHandler(usersContract.findById)
  findById(@CurrentUser() me: CurrentUserPayload) {
    return tsRestHandler(usersContract.findById, async ({ params }) => {
      if (me.role !== 'admin' && me.id !== params.id) {
        throw new ForbiddenException()
      }
      const user = await this.usersService.findById(params.id)
      return { status: 200, body: user }
    })
  }

  @TsRestHandler(usersContract.list)
  @Roles(['admin'])
  list() {
    return tsRestHandler(usersContract.list, async ({ query }) => {
      const { items, total } = await this.usersService.findMany(query)
      return {
        status: 200,
        body: { items, total, page: query.page, limit: query.limit },
      }
    })
  }
}
