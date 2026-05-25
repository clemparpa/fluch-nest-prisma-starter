import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { getHttpServer } from './helpers/app'
import { ADMIN_EMAIL, getAdminCookie, makeTestEmail, signUp } from './helpers/auth'
import { resetTestUsers } from './helpers/db'

describe('Users e2e (S8.1 DoD)', () => {
  let adminCookie: string
  let lambdaCookie: string
  let lambdaUserId: string
  let adminUserId: string

  beforeAll(async () => {
    await resetTestUsers()
    adminCookie = await getAdminCookie()
    const adminRes = await request(getHttpServer())
      .get('/users/me')
      .set('Cookie', adminCookie)
      .expect(200)
    adminUserId = adminRes.body.id
    const lambda = await signUp(makeTestEmail(), 'lambda12345678', 'Lambda User')
    lambdaCookie = lambda.cookie
    lambdaUserId = lambda.userId
  })

  afterAll(resetTestUsers)

  it('#1 GET /users/me sans cookie → 401', async () => {
    await request(getHttpServer()).get('/users/me').expect(401)
  })

  it('#2 GET /users/me admin → 200 + shape User complet (sans password/accounts/sessions)', async () => {
    const res = await request(getHttpServer())
      .get('/users/me')
      .set('Cookie', adminCookie)
      .expect(200)

    expect(res.body).toMatchObject({
      id: expect.any(String),
      email: ADMIN_EMAIL,
      role: 'admin',
      createdAt: expect.any(String),
    })
    expect(Object.keys(res.body).sort()).toEqual(
      [
        'banExpires',
        'banReason',
        'banned',
        'createdAt',
        'email',
        'emailVerified',
        'id',
        'image',
        'name',
        'role',
        'updatedAt',
      ].sort(),
    )
    expect(res.body).not.toHaveProperty('password')
    expect(res.body).not.toHaveProperty('accounts')
    expect(res.body).not.toHaveProperty('sessions')
  })

  it('#3 GET /users/:adminId par lambda → 403', async () => {
    await request(getHttpServer())
      .get(`/users/${adminUserId}`)
      .set('Cookie', lambdaCookie)
      .expect(403)
  })

  it('#4 GET /users/:lambdaId par admin → 200', async () => {
    const res = await request(getHttpServer())
      .get(`/users/${lambdaUserId}`)
      .set('Cookie', adminCookie)
      .expect(200)
    expect(res.body.id).toBe(lambdaUserId)
  })

  it('#5 PATCH /users/me {name:"Nouveau"} → 200 + name updated', async () => {
    const res = await request(getHttpServer())
      .patch('/users/me')
      .set('Cookie', adminCookie)
      .send({ name: 'Nouveau' })
      .expect(200)
    expect(res.body.name).toBe('Nouveau')

    // Revert pour ne pas polluer le seed entre runs
    await request(getHttpServer())
      .patch('/users/me')
      .set('Cookie', adminCookie)
      .send({ name: 'Admin Dev' })
      .expect(200)
  })

  it('#6 PATCH /users/me {} (empty body) → 200', async () => {
    await request(getHttpServer())
      .patch('/users/me')
      .set('Cookie', adminCookie)
      .send({})
      .expect(200)
  })

  it('#7 PATCH /users/me {email:"x@x.com"} → 400 + unrecognized_keys', async () => {
    const res = await request(getHttpServer())
      .patch('/users/me')
      .set('Cookie', adminCookie)
      .send({ email: 'x@x.com' })
      .expect(400)
    expect(res.body.issues).toBeDefined()
    expect(res.body.issues[0].code).toBe('unrecognized_keys')
  })

  it('#10 GET /users par lambda → 403', async () => {
    await request(getHttpServer()).get('/users').set('Cookie', lambdaCookie).expect(403)
  })

  it('#11 GET /users?page=1&limit=10 par admin → 200 + shape paginé + items filtrés', async () => {
    const res = await request(getHttpServer())
      .get('/users?page=1&limit=10')
      .set('Cookie', adminCookie)
      .expect(200)
    expect(res.body).toMatchObject({
      total: expect.any(Number),
      page: 1,
      limit: 10,
      items: expect.any(Array),
    })
    if (res.body.items.length > 0) {
      const first = res.body.items[0]
      expect(Object.keys(first).sort()).toEqual(
        [
          'banExpires',
          'banReason',
          'banned',
          'createdAt',
          'email',
          'emailVerified',
          'id',
          'image',
          'name',
          'role',
          'updatedAt',
        ].sort(),
      )
    }
  })

  it('#12 GET /users?limit=200 → 400 + too_big', async () => {
    const res = await request(getHttpServer())
      .get('/users?limit=200')
      .set('Cookie', adminCookie)
      .expect(400)
    expect(res.body.issues[0].code).toBe('too_big')
  })

  it('#13 GET /users?limit=abc → 400 + invalid_type (coercion zod)', async () => {
    const res = await request(getHttpServer())
      .get('/users?limit=abc')
      .set('Cookie', adminCookie)
      .expect(400)
    expect(res.body.issues[0].code).toBe('invalid_type')
  })

  it('#14 GET /users/non-existent-id par admin → 404', async () => {
    await request(getHttpServer())
      .get('/users/non-existent-id')
      .set('Cookie', adminCookie)
      .expect(404)
  })
})
