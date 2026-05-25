import type { PaginationQuery, UpdateUserInput } from '@fluch/api-contracts'
import { Injectable, NotFoundException } from '@nestjs/common'
import type { Prisma } from '@/generated/prisma/client'
import { InjectPrisma, type TenantScopedPrismaClient } from '@/prisma/prisma.module'

@Injectable()
export class UsersService {
  constructor(@InjectPrisma() private readonly prisma: TenantScopedPrismaClient) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  updateMe(userId: string, dto: UpdateUserInput) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto as Prisma.UserUpdateInput,
    })
  }

  async findMany({ page, limit }: PaginationQuery) {
    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count(),
    ])
    return { items, total }
  }
}
