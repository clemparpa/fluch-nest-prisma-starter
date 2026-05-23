import { randomUUID } from 'node:crypto'
import request from 'supertest'
import { getHttpServer } from './app'

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
