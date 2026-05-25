import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './app'

export const ADMIN_EMAIL = 'admin@local.dev'
export const ADMIN_PASSWORD = 'admin12345678'

export function makeTestEmail(prefix = 'test'): string {
  return `${prefix}-${randomUUID()}@test.local`
}

export function extractAuthCookie(setCookie: string[] | undefined): string {
  if (!setCookie) throw new Error('No Set-Cookie header')
  const session = setCookie.find((c) => /fluch[.-]session_token=/.test(c))
  if (!session) throw new Error(`No session cookie in: ${setCookie.join(' | ')}`)
  return session.split(';')[0] as string
}

export async function signUp(
  email: string,
  password: string,
  name = 'Test User',
): Promise<{ cookie: string; userId: string }> {
  const res = await request(getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ email, password, name })
    .expect(200)
  return {
    cookie: extractAuthCookie(res.headers['set-cookie'] as unknown as string[] | undefined),
    userId: res.body.user.id,
  }
}

export async function signIn(email: string, password: string): Promise<string> {
  const res = await request(getHttpServer())
    .post('/api/auth/sign-in/email')
    .send({ email, password })
    .expect(200)
  return extractAuthCookie(res.headers['set-cookie'] as unknown as string[] | undefined)
}

export function getAdminCookie(): Promise<string> {
  return signIn(ADMIN_EMAIL, ADMIN_PASSWORD)
}

export async function createOrgAndActivate(
  cookie: string,
  slug: string,
): Promise<{ orgId: string; cookie: string }> {
  const create = await request(getHttpServer())
    .post('/api/auth/organization/create')
    .set('Cookie', cookie)
    .send({ name: `Org ${slug}`, slug })
    .expect(200)
  const orgId = create.body.id as string
  const setActive = await request(getHttpServer())
    .post('/api/auth/organization/set-active')
    .set('Cookie', cookie)
    .send({ organizationId: orgId })
    .expect(200)
  const refreshed = extractAuthCookie(
    setActive.headers['set-cookie'] as unknown as string[] | undefined,
  )
  return { orgId, cookie: refreshed }
}

/**
 * Resets `activeOrganizationId` on the user's session.
 *
 * Since S8.7, signup automatically creates a default org and pins it as active
 * on the new session. Tests that exercise the "no active org" branch use this
 * helper to clear it. Returns the refreshed cookie (the `/set-active` call
 * issues a new Set-Cookie).
 */
export async function unsetActiveOrg(cookie: string): Promise<string> {
  const res = await request(getHttpServer())
    .post('/api/auth/organization/set-active')
    .set('Cookie', cookie)
    .send({ organizationId: null })
    .expect(200)
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
  return setCookie ? extractAuthCookie(setCookie) : cookie
}

/**
 * Direct DB insert — bypass the invitation flow for speed in unit-ish tests.
 * The invitation flow itself is covered separately when relevant.
 */
export async function addOrgMember(
  organizationId: string,
  userId: string,
  role: 'member' | 'admin' | 'owner',
): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.member.create({
    data: { id: randomUUID(), organizationId, userId, role, createdAt: new Date() },
  })
}
