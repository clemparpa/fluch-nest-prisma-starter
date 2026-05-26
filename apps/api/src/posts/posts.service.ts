import type { CreatePostInput, PaginationQuery, UpdatePostInput } from '@fluch/api-contracts'
import { Injectable, Logger, NotFoundException } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { AuthService } from '@thallesp/nestjs-better-auth'
import type { Auth } from '@/auth/auth.config'
import { Prisma } from '@/generated/prisma/client'
import { InjectPrisma, type TenantScopedPrismaClient } from '@/prisma/prisma.module'
import { tenantScoped } from '@/prisma/tenant-scoped'

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(
    @InjectPrisma() private readonly prisma: TenantScopedPrismaClient,
    private readonly authService: AuthService<Auth>,
  ) {}

  create(authorId: string, dto: CreatePostInput) {
    return this.prisma.post.create({
      data: tenantScoped<Prisma.PostUncheckedCreateInput>({
        title: dto.title,
        content: dto.content,
        published: dto.published ?? false,
        authorId,
      }),
    })
  }

  async findMany({ page, limit }: PaginationQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.post.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.post.count(),
    ])
    return { items, total }
  }

  async findById(id: string) {
    const post = await this.prisma.post.findUnique({ where: { id } })
    if (!post) throw new NotFoundException('Post not found')
    return post
  }

  async update(id: string, authorId: string, headers: Headers, dto: UpdatePostInput) {
    if (await this.canBypassOwnership(headers, 'update')) {
      try {
        return await this.prisma.post.update({
          where: { id },
          data: dto as Prisma.PostUpdateInput,
        })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new NotFoundException('Post not found')
        }
        throw err
      }
    }
    const [updated] = await this.prisma.post.updateManyAndReturn({
      where: { id, authorId },
      data: dto as Prisma.PostUpdateManyMutationInput,
    })
    if (!updated) throw new NotFoundException('Post not found')
    return updated
  }

  async delete(id: string, authorId: string, headers: Headers): Promise<void> {
    if (await this.canBypassOwnership(headers, 'delete')) {
      try {
        await this.prisma.post.delete({ where: { id } })
      } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
          throw new NotFoundException('Post not found')
        }
        throw err
      }
      return
    }
    const { count } = await this.prisma.post.deleteMany({ where: { id, authorId } })
    if (count === 0) throw new NotFoundException('Post not found')
  }

  /**
   * Checks whether the caller carries the org-level RBAC permission for the
   * given action on `post`. Used to let admin/owner roles bypass row-level
   * ownership filtering on update/delete.
   *
   * Defensive: any thrown error from better-auth is logged and treated as a
   * no-bypass, so the request falls back to ownership checks.
   */
  private async canBypassOwnership(
    headers: Headers,
    action: 'update' | 'delete',
  ): Promise<boolean> {
    try {
      const res = await this.authService.api.hasPermission({
        body: { permissions: { post: [action] } },
        headers,
      })
      return res?.success === true
    } catch (err) {
      this.logger.warn(`hasPermission(post:${action}) threw — falling back to ownership`, err)
      return false
    }
  }
}
