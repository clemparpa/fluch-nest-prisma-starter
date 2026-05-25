import { Logger } from '@nestjs/common'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './helpers/app'
import { makeTestEmail, signUp } from './helpers/auth'
import { resetTestOrgs, resetTestUsers } from './helpers/db'

describe('Auth hooks e2e (S8.7 — user.created → default org)', () => {
  beforeAll(async () => {
    await resetTestUsers()
    await resetTestOrgs()
  })

  afterAll(async () => {
    await resetTestUsers()
    await resetTestOrgs()
  })

  it('#1 Signup creates a default org and adds the user as owner', async () => {
    const { userId, cookie } = await signUp(makeTestEmail('hook'), 'hooks12345678', 'Alice Hook')

    const prisma = getApp().get(UnsafePrismaService)
    const memberships = await prisma.member.findMany({
      where: { userId },
      include: { organization: true },
    })

    expect(memberships).toHaveLength(1)
    expect(memberships[0].role).toBe('owner')
    expect(memberships[0].organization.name).toContain('Alice Hook')
    expect(memberships[0].organization.slug).toMatch(/^alice-hook-[a-f0-9]{8}$/)

    // Session should already be tied to the default org (databaseHooks.session.create.before)
    const sessionRes = await request(getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', cookie)
      .expect(200)
    expect(sessionRes.body.session.activeOrganizationId).toBe(memberships[0].organizationId)
  })

  it('#2 Signup with a name made of only symbols still produces a usable slug', async () => {
    // Edge case: slugify("???") → "" → listener falls back to "workspace"
    const { userId } = await signUp(makeTestEmail('symbols'), 'hooks12345678', '???')

    const prisma = getApp().get(UnsafePrismaService)
    const membership = await prisma.member.findFirst({
      where: { userId },
      include: { organization: true },
    })
    expect(membership).not.toBeNull()
    expect(membership?.organization.slug).toMatch(/^workspace-[a-f0-9]{8}$/)
  })

  it('#3 Adding a second listener (welcome-email) runs on signup without touching the hook', async () => {
    // Proves the event-emitter pattern's pluggability: adding a side effect
    // = adding a listener provider. The hook stays untouched.
    const logSpy = vi.spyOn(Logger.prototype, 'log')

    const email = makeTestEmail('welcome')
    await signUp(email, 'hooks12345678', 'Welcome User')

    const welcomeCall = logSpy.mock.calls.find(
      ([msg]) => typeof msg === 'string' && msg.includes(`Would send welcome email to ${email}`),
    )
    expect(welcomeCall, 'WelcomeEmailListener should have logged the placeholder').toBeDefined()

    logSpy.mockRestore()
  })
})
