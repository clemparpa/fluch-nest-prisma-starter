import { postsContract } from '@fluch/api-contracts'
import { Controller, Req } from '@nestjs/common'
import { MemberHasPermission } from '@thallesp/nestjs-better-auth'
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest'
import { fromNodeHeaders } from 'better-auth/node'
import type { Request } from 'express'
import { CurrentUser, type CurrentUserPayload } from '@/common/decorators/current-user.decorator'
import { RequiresOrg } from '@/common/decorators/requires-org.decorator'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { PostsService } from './posts.service'

@Controller()
@RequiresOrg()
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @TsRestHandler(postsContract.create)
  @MemberHasPermission({ permissions: { post: ['create'] } })
  create(@CurrentUser() me: CurrentUserPayload) {
    return tsRestHandler(postsContract.create, async ({ body }) => {
      const post = await this.postsService.create(me.id, body)
      return { status: 201, body: post }
    })
  }

  @TsRestHandler(postsContract.list)
  @MemberHasPermission({ permissions: { post: ['read'] } })
  list() {
    return tsRestHandler(postsContract.list, async ({ query }) => {
      const { items, total } = await this.postsService.findMany(query)
      return {
        status: 200,
        body: { items, total, page: query.page, limit: query.limit },
      }
    })
  }

  @TsRestHandler(postsContract.findById)
  @MemberHasPermission({ permissions: { post: ['read'] } })
  findById() {
    return tsRestHandler(postsContract.findById, async ({ params }) => {
      const post = await this.postsService.findById(params.id)
      return { status: 200, body: post }
    })
  }

  // No @MemberHasPermission here on purpose: orgMember has post:create+read only.
  // Decorator would block an owner editing his own post. Service distinguishes
  // ownership (`where authorId=me.id`) vs bypass (post:update/delete RBAC).
  @TsRestHandler(postsContract.update)
  update(@CurrentUser() me: CurrentUserPayload, @Req() req: Request) {
    return tsRestHandler(postsContract.update, async ({ params, body }) => {
      const updated = await this.postsService.update(
        params.id,
        me.id,
        fromNodeHeaders(req.headers),
        body,
      )
      return { status: 200, body: updated }
    })
  }

  @TsRestHandler(postsContract.delete)
  delete(@CurrentUser() me: CurrentUserPayload, @Req() req: Request) {
    return tsRestHandler(postsContract.delete, async ({ params }) => {
      await this.postsService.delete(params.id, me.id, fromNodeHeaders(req.headers))
      return { status: 204, body: null }
    })
  }
}
