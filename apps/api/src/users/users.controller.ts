import { Body, Controller, ForbiddenException, Get, Param, Patch, Query } from '@nestjs/common'
import { ApiTags } from '@nestjs/swagger'
import { ZodSerializerDto } from 'nestjs-zod'
import { CurrentUser, type CurrentUserPayload } from '@/common/decorators/current-user.decorator'
import { paginate } from '@/common/dto/paginated-response.dto'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { PaginationDto } from '@/common/dto/pagination.dto'
import { PaginatedUsersDto } from './dto/paginated-users.dto'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { UpdateUserDto } from './dto/update-user.dto'
import { UserResponseDto } from './dto/user-response.dto'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { UsersService } from './users.service'

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ZodSerializerDto(UserResponseDto)
  me(@CurrentUser() me: CurrentUserPayload) {
    return this.usersService.findById(me.id)
  }

  @Patch('me')
  @ZodSerializerDto(UserResponseDto)
  updateMe(@CurrentUser() me: CurrentUserPayload, @Body() dto: UpdateUserDto) {
    return this.usersService.updateMe(me.id, dto)
  }

  @Get(':id')
  @ZodSerializerDto(UserResponseDto)
  findById(@CurrentUser() me: CurrentUserPayload, @Param('id') id: string) {
    if (me.role !== 'admin' && me.id !== id) {
      throw new ForbiddenException()
    }
    return this.usersService.findById(id)
  }

  @Get()
  @ZodSerializerDto(PaginatedUsersDto)
  async list(@CurrentUser() me: CurrentUserPayload, @Query() pagination: PaginationDto) {
    if (me.role !== 'admin') throw new ForbiddenException()
    const { items, total } = await this.usersService.findMany(pagination)
    return paginate(items, total, pagination.page, pagination.limit)
  }
}
