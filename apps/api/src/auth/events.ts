import type { User } from '@/generated/prisma/client'

export const USER_CREATED = 'user.created' as const

export type UserCreatedEvent = { user: User }
