import { Body, Controller, Get, NotFoundException, Param, Patch, Post } from '@nestjs/common'
import { RequiresOrg } from '@/common/decorators/requires-org.decorator'
import { Prisma } from '@/generated/prisma/client'
import { InjectPrisma, type TenantScopedPrismaClient } from '@/prisma/prisma.module'
import { tenantScoped } from '@/prisma/tenant-scoped'

/**
 * Dev-only fixtures used by `tenant-isolation.e2e.spec.ts` to prove end-to-end
 * that the TenantInterceptor → ALS → tenant-extension chain isolates queries
 * by `organizationId`. Loaded by AppModule only when NODE_ENV !== 'production'.
 */
@Controller('_tenant')
export class TenantFixturesController {
  constructor(@InjectPrisma() private readonly prisma: TenantScopedPrismaClient) {}

  @Post('posts')
  @RequiresOrg()
  create(@Body() body: { title: string }) {
    return this.prisma.testPost.create({
      data: tenantScoped<Prisma.TestPostCreateInput>({ title: body.title }),
    })
  }

  @Get('posts')
  @RequiresOrg()
  list() {
    return this.prisma.testPost.findMany({ orderBy: { createdAt: 'asc' } })
  }

  @Patch('posts/:id')
  @RequiresOrg()
  async update(@Param('id') id: string, @Body() body: { title: string }) {
    try {
      return await this.prisma.testPost.update({
        where: { id },
        data: { title: body.title },
      })
    } catch (err) {
      // P2025 = record not found — the tenant filter prevented the match
      // (either the id doesn't exist, or it belongs to a different org).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
        throw new NotFoundException('Post not found')
      }
      throw err
    }
  }
}
