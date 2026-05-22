import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'
import { UserResponseSchema } from './user-response.dto'

export const PaginatedUsersSchema = z.object({
  items: z.array(UserResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})

export class PaginatedUsersDto extends createZodDto(PaginatedUsersSchema) {}
