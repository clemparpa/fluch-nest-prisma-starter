import { Injectable, NotFoundException } from '@nestjs/common'
import type { PaginationDto } from '@/common/dto/pagination.dto'
import type { Prisma } from '@/generated/prisma/client'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { PrismaService } from '@/prisma/prisma.service'
import type { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } })
    if (!user) throw new NotFoundException('User not found')
    return user
  }

  updateMe(userId: string, dto: UpdateUserDto) {
    return this.prisma.user.update({
      where: { id: userId },
      data: dto as Prisma.UserUpdateInput,
    })
  }

  async findMany({ page, limit }: PaginationDto) {
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
