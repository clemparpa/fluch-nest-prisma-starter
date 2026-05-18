import 'dotenv/config'
import { PrismaPg } from '@prisma/adapter-pg'
import { createAuth } from '../src/auth'
import { PrismaClient } from '../src/generated/prisma/client'

const ADMIN_EMAIL = 'admin@local.dev'
const ADMIN_PASSWORD = 'admin12345'
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
    if (existing) {
      console.log(`[seed] Admin user already exists (${ADMIN_EMAIL}) — no-op.`)
      return
    }

    const auth = createAuth(prisma)
    const result = await auth.api.signUpEmail({
      body: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: ADMIN_NAME },
    })
    console.log(`[seed] Admin user created: ${result.user.email} (id=${result.user.id}).`)
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((err) => {
  console.error('[seed] Failed:', err)
  process.exit(1)
})
