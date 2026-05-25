import { betterAuth } from 'better-auth'
import { prismaAdapter } from 'better-auth/adapters/prisma'
import { admin, organization } from 'better-auth/plugins'
import type { Env } from '@/config/env.schema'
import type { PrismaClient } from '@/generated/prisma/client'
import { ac, orgAdmin, orgMember, orgOwner, sysAdmin, sysUser } from './permissions'

type AuthEnv = Pick<Env, 'NODE_ENV' | 'BETTER_AUTH_SECRET' | 'BETTER_AUTH_URL' | 'FRONTEND_URL'>

export function createAuth(prisma: PrismaClient, env: AuthEnv) {
  const isProd = env.NODE_ENV === 'production'
  return betterAuth({
    database: prismaAdapter(prisma, { provider: 'postgresql' }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    trustedOrigins: [env.BETTER_AUTH_URL, env.FRONTEND_URL],
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      minPasswordLength: 12,
    },
    user: {
      additionalFields: {
        role: { type: 'string', defaultValue: 'user', input: false },
      },
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: { enabled: true, maxAge: 5 * 60 },
    },
    advanced: {
      cookiePrefix: 'fluch',
      useSecureCookies: isProd,
      defaultCookieAttributes: {
        httpOnly: true,
        secure: isProd,
        sameSite: 'lax',
      },
    },
    plugins: [
      admin({ ac, roles: { user: sysUser, admin: sysAdmin } }),
      organization({ ac, roles: { member: orgMember, admin: orgAdmin, owner: orgOwner } }),
    ],
    // Placeholder required by @thallesp/nestjs-better-auth: when any provider
    // carries `@DatabaseHook()`, the lib expects `databaseHooks` to be set
    // here so it can mutate it at NestJS onModuleInit. The actual hooks live
    // in `apps/api/src/auth/hooks/` (UserCreatedHook, SessionActiveOrgHook).
    databaseHooks: {},
  })
}

export type Auth = ReturnType<typeof createAuth>
