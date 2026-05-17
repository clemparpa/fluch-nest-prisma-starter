import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import type { PrismaClient } from '@/generated/prisma/client'

export function createAuth(prisma: PrismaClient) {
  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),
    emailAndPassword: {
      enabled: true,
    },
  })
}

export type Auth = ReturnType<typeof createAuth>
