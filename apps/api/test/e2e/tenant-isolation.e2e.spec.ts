import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './helpers/app'
import { createOrgAndActivate, makeTestEmail, signUp } from './helpers/auth'
import { resetTestOrgs, resetTestPosts, resetTestUsers } from './helpers/db'

describe('Tenant isolation e2e', () => {
  let aliceCookie: string
  let aliceOrgId: string
  let bobCookie: string
  let bobOrgId: string
  let aliceOnlyPostId: string

  beforeAll(async () => {
    await resetTestPosts()
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
    await resetTestPosts()
    await resetTestUsers()
    await resetTestOrgs()
  })

  it('#1 Alice creates a TestPost → DB row carries her organizationId', async () => {
    const res = await request(getHttpServer())
      .post('/_tenant/posts')
      .set('Cookie', aliceCookie)
      .send({ title: 'Alice top secret' })
      .expect(201)
    expect(res.body.id).toEqual(expect.any(String))
    expect(res.body.title).toBe('Alice top secret')
    aliceOnlyPostId = res.body.id

    // Verify directly in DB via the unsafe (unfiltered) client
    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.testPost.findUnique({ where: { id: aliceOnlyPostId } })
    expect(row?.organizationId).toBe(aliceOrgId)
  })

  it("#2 Bob lists /_tenant/posts → does not see Alice's post", async () => {
    // Bob has his own org active. List should be empty since he has no posts.
    const res = await request(getHttpServer())
      .get('/_tenant/posts')
      .set('Cookie', bobCookie)
      .expect(200)
    expect(res.body).toEqual([])

    // Sanity: Alice does see it on her side
    const aliceList = await request(getHttpServer())
      .get('/_tenant/posts')
      .set('Cookie', aliceCookie)
      .expect(200)
    expect(aliceList.body).toHaveLength(1)
    expect(aliceList.body[0].id).toBe(aliceOnlyPostId)
  })

  it("#3 Bob PATCH on Alice's post → 404 (tenant filter blocks the match)", async () => {
    await request(getHttpServer())
      .patch(`/_tenant/posts/${aliceOnlyPostId}`)
      .set('Cookie', bobCookie)
      .send({ title: 'hijacked' })
      .expect(404)

    // Verify directly: Alice's title is unchanged
    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.testPost.findUnique({ where: { id: aliceOnlyPostId } })
    expect(row?.title).toBe('Alice top secret')
  })

  it('#4 user without active org on /_tenant/posts → 400 (RequiresOrgGuard)', async () => {
    const { cookie } = await signUp(makeTestEmail('noorg-iso'), 'iso123456789012')
    await request(getHttpServer()).get('/_tenant/posts').set('Cookie', cookie).expect(400)
  })

  it('#5 ALS concurrency: 10 interleaved requests never leak tenant context', async () => {
    // Bob creates one post in his org so each side has data.
    await request(getHttpServer())
      .post('/_tenant/posts')
      .set('Cookie', bobCookie)
      .send({ title: 'Bob only' })
      .expect(201)

    // Fire 10 alternating concurrent requests
    const calls = Array.from({ length: 10 }, (_, i) =>
      request(getHttpServer())
        .get('/_tenant/posts')
        .set('Cookie', i % 2 === 0 ? aliceCookie : bobCookie),
    )
    const results = await Promise.all(calls)

    results.forEach((res, i) => {
      expect(res.status).toBe(200)
      const expectedOrgId = i % 2 === 0 ? aliceOrgId : bobOrgId
      for (const post of res.body) {
        expect(post.organizationId).toBe(expectedOrgId)
      }
    })
  })
})
