import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getHttpServer } from './helpers/app'
import {
  ADMIN_EMAIL,
  ADMIN_PASSWORD,
  extractAuthCookie,
  getAdminCookie,
  makeTestEmail,
} from './helpers/auth'
import { resetTestUsers } from './helpers/db'

describe('Auth e2e', () => {
  beforeAll(resetTestUsers)
  afterAll(resetTestUsers)

  it('#1 POST /api/auth/sign-up/email valide → 200 + Set-Cookie session + user.id', async () => {
    const email = makeTestEmail('signup')
    const res = await request(getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password: 'signup12345678', name: 'Sign Up User' })
      .expect(200)

    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(setCookie).toBeDefined()
    const session = extractAuthCookie(setCookie)
    expect(session).toMatch(/fluch[.-]session_token=/)
    expect(res.body.user?.id).toEqual(expect.any(String))
    expect(res.body.user?.email).toBe(email)
  })

  it('#2 POST /api/auth/sign-up/email password < 12 chars → 4xx', async () => {
    const email = makeTestEmail('short')
    const res = await request(getHttpServer())
      .post('/api/auth/sign-up/email')
      .send({ email, password: 'short1', name: 'Short PW' })
    expect(res.status).toBeGreaterThanOrEqual(400)
    expect(res.status).toBeLessThan(500)
  })

  it('#3 POST /api/auth/sign-in/email admin creds → 200 + Set-Cookie session', async () => {
    const res = await request(getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
      .expect(200)
    const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
    expect(setCookie).toBeDefined()
    expect(extractAuthCookie(setCookie)).toMatch(/fluch[.-]session_token=/)
  })

  it('#4 POST /api/auth/sign-in/email mauvais password → 401', async () => {
    const res = await request(getHttpServer())
      .post('/api/auth/sign-in/email')
      .send({ email: ADMIN_EMAIL, password: 'wrongpassword' })
    expect(res.status).toBe(401)
  })

  it('#5 GET /api/auth/get-session avec cookie admin → 200 + user.email correspond', async () => {
    const adminCookie = await getAdminCookie()
    const res = await request(getHttpServer())
      .get('/api/auth/get-session')
      .set('Cookie', adminCookie)
      .expect(200)
    expect(res.body?.user?.email).toBe(ADMIN_EMAIL)
  })
})
