import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAuth } from '../src/auth/auth.config'
import { PrismaClient } from '../src/generated/prisma/client'

const ADMIN_EMAIL = 'admin@local.dev'
const ADMIN_PASSWORD = 'admin12345678'
const ADMIN_NAME = 'Admin Dev'

async function main() {
  if (process.env.NODE_ENV !== 'development') {
    console.log(`[seed] NODE_ENV=${process.env.NODE_ENV ?? 'unset'} — skipping (dev-only seed).`)
    return
  }

  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('[seed] DATABASE_URL is not set.')
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  })

  try {
    const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } })

    let userId: string
    if (existing) {
      userId = existing.id
      console.log(`[seed] Admin user already exists (${ADMIN_EMAIL}) — ensuring role.`)
    } else {
      const auth = createAuth(prisma, {
        NODE_ENV: 'development',
        BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
        BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
        FRONTEND_URL: requireEnv('FRONTEND_URL'),
      })
      const result = await auth.api.signUpEmail({
        body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
      })
      userId = result.user.id
      console.log(`[seed] Admin user created: ${result.user.email} (id=${userId}).`)
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { role: 'admin' },
    })
    console.log(`[seed] Admin role ensured: ${updated.email} → role=${updated.role}.`)
  } finally {
    await prisma.$disconnect()
  }
}

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`[seed] ${key} is not set.`)
  return v
}

main().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
