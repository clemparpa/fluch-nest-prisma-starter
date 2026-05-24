import type { UserResponse } from '@fluch/api-contracts'
import type { User } from '@/generated/prisma/client'

export function toUserResponse(user: User): UserResponse {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    image: user.image ?? null,
    role: user.role ?? 'user',
    createdAt: user.createdAt,
  }
}
