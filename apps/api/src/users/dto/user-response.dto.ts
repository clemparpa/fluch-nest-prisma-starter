import { createZodDto } from 'nestjs-zod'
import { UserSchema } from '@/generated/zod/schemas/models/User.schema'

export const UserResponseSchema = UserSchema.pick({
  id: true,
  email: true,
  name: true,
  image: true,
  role: true,
  createdAt: true,
})

export class UserResponseDto extends createZodDto(UserResponseSchema) {}
