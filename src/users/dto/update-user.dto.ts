import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    image: z.url().optional(),
  })
  .strict()

export class UpdateUserDto extends createZodDto(UpdateUserSchema) {}
