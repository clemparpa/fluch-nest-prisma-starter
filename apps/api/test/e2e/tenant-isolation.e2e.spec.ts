import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './helpers/app'
import { createOrgAndActivate, makeTestEmail, signUp, unsetActiveOrg } from './helpers/auth'
import { resetPosts, resetTestOrgs, resetTestUsers } from './helpers/db'

// Re-enabled in S8.8.2 once /v1/posts is wired up.
describe.skip('Tenant isolation e2e', () => {
  let aliceCookie: string
  let aliceOrgId: string
  let bobCookie: string
  let bobOrgId: string
  let aliceOnlyPostId: string

  beforeAll(async () => {
    await resetPosts()
    await resetTestUsers()
    await resetTestOrgs()

    const alice = await signUp(makeTestEmail('alice-iso'), 'iso123456789012')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-iso-a`)
    aliceCookie = aliceOrg.cookie
    aliceOrgId = aliceOrg.orgId

    const bob = await signUp(makeTestEmail('bob-iso'), 'iso123456789012')
    const bobOrg = await createOrgAndActivate(bob.cookie, `test-${Date.now()}-iso-b`)
    bobCookie = bobOrg.cookie
    bobOrgId = bobOrg.orgId
  })

  afterAll(async () => {
    await resetPosts()
    await resetTestUsers()
    await resetTestOrgs()
  })

  it('#1 Alice creates a Post → DB row carries her organizationId', async () => {
    const res = await request(getHttpServer())
      .post('/v1/posts')
      .set('Cookie', aliceCookie)
      .send({ title: 'Alice top secret', content: 'alice body' })
      .expect(201)
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.title).toBe('Alice top secret')
    aliceOnlyPostId = res.body.id

    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.post.findUnique({ where: { id: aliceOnlyPostId } })
    expect(row?.organizationId).toBe(aliceOrgId)
  })

  it("#2 Bob lists /v1/posts → does not see Alice's post", async () => {
    const res = await request(getHttpServer()).get('/v1/posts').set('Cookie', bobCookie).expect(200)
    expect(res.body.items).toEqual([])
    expect(res.body.total).toBe(0)

    const aliceList = await request(getHttpServer())
      .get('/v1/posts')
      .set('Cookie', aliceCookie)
      .expect(200)
    expect(aliceList.body.items).toHaveLength(1)
    expect(aliceList.body.items[0].id).toBe(aliceOnlyPostId)
  })

  it("#3 Bob PATCH on Alice's post → 404 (tenant filter blocks the match)", async () => {
    await request(getHttpServer())
      .patch(`/v1/posts/${aliceOnlyPostId}`)
      .set('Cookie', bobCookie)
      .send({ title: 'hijacked' })
      .expect(404)

    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.post.findUnique({ where: { id: aliceOnlyPostId } })
    expect(row?.title).toBe('Alice top secret')
  })

  it('#4 user without active org on /v1/posts → 400 (RequiresOrgGuard)', async () => {
    const { cookie: rawCookie } = await signUp(makeTestEmail('noorg-iso'), 'iso123456789012')
    const cookie = await unsetActiveOrg(rawCookie)
    await request(getHttpServer()).get('/v1/posts').set('Cookie', cookie).expect(400)
  })

  it('#5 ALS concurrency: 10 interleaved requests never leak tenant context', async () => {
    await request(getHttpServer())
      .post('/v1/posts')
      .set('Cookie', bobCookie)
      .send({ title: 'Bob only', content: 'bob body' })
      .expect(201)

    const calls = Array.from({ length: 10 }, (_, i) =>
      request(getHttpServer())
        .get('/v1/posts')
        .set('Cookie', i % 2 === 0 ? aliceCookie : bobCookie),
    )
    const results = await Promise.all(calls)

    results.forEach((res, i) => {
      expect(res.status).toBe(200)
      const expectedOrgId = i % 2 === 0 ? aliceOrgId : bobOrgId
      for (const post of res.body.items) {
        expect(post.organizationId).toBe(expectedOrgId)
      }
    })
  })
})
