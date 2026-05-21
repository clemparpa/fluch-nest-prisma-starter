import { Body, Controller, ForbiddenException, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { CurrentUser, type CurrentUserPayload } from '@/common/decorators/current-user.decorator'
import { type PaginatedResponseDto, paginate } from '@/common/dto/paginated-response.dto'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { PaginationDto } from '@/common/dto/pagination.dto'
import type { User } from '@/generated/prisma/client'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { UpdateUserDto } from './dto/update-user.dto'
import type { UserResponseDto } from './dto/user-response.dto'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { UsersService } from './users.service'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async me(@CurrentUser() me: CurrentUserPayload): Promise<UserResponseDto> {
    return toDto(await this.usersService.findById(me.id))
  }

  @Patch('me')
  async updateMe(
    @CurrentUser() me: CurrentUserPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserResponseDto> {
    return toDto(await this.usersService.updateMe(me.id, dto))
  }

  @Get(':id')
  async findById(
    @CurrentUser() me: CurrentUserPayload,
    @Param('id') id: string,
  ): Promise<UserResponseDto> {
    if (me.role !== 'admin' && me.id !== id) {
      throw new ForbiddenException()
    }
    return toDto(await this.usersService.findById(id))
  }

  @Get()
  async list(
    @CurrentUser() me: CurrentUserPayload,
    @Query() pagination: PaginationDto,
  ): Promise<PaginatedResponseDto<UserResponseDto>> {
    if (me.role !== 'admin') throw new ForbiddenException()
    const { items, total } = await this.usersService.findMany(pagination)
    return paginate(items.map(toDto), total, pagination.page, pagination.limit)
  }
}

function toDto(u: User): UserResponseDto {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image,
    role: u.role,
    createdAt: u.createdAt,
  }
}
