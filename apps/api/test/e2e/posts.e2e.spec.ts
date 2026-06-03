import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { PostsService } from '@/posts/posts.service'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './helpers/app'
import {
  addOrgMember,
  createOrgAndActivate,
  makeTestEmail,
  signUp,
  unsetActiveOrg,
} from './helpers/auth'
import { resetPosts, resetTestOrgs, resetTestUsers } from './helpers/db'

async function setActive(cookie: string, organizationId: string): Promise<string> {
  const res = await request(getHttpServer())
    .post('/api/auth/organization/set-active')
    .set('Cookie', cookie)
    .send({ organizationId })
    .expect(200)
  const setCookie = res.headers['set-cookie'] as unknown as string[] | undefined
  if (!setCookie) return cookie
  return setCookie[0]?.split(';')[0] ?? cookie
}

describe('Posts e2e (S8.8)', () => {
  beforeAll(async () => {
    await resetPosts()
    await resetTestUsers()
    await resetTestOrgs()
  })

  afterAll(async () => {
    await resetPosts()
    await resetTestUsers()
    await resetTestOrgs()
  })

  it('#1 Member creates a post → 201, DB row carries authorId + organizationId', async () => {
    const alice = await signUp(makeTestEmail('post-alice'), 'posts123456789012', 'Alice')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-posts-1`)

    const res = await request(getHttpServer())
      .post('/posts')
      .set('Cookie', aliceOrg.cookie)
      .send({ title: 'Hello', content: 'World' })
      .expect(201)

    expect(res.body).toMatchObject({
      title: 'Hello',
      content: 'World',
      published: false,
      authorId: alice.userId,
      organizationId: aliceOrg.orgId,
    })

    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.post.findUnique({ where: { id: res.body.id } })
    expect(row?.authorId).toBe(alice.userId)
    expect(row?.organizationId).toBe(aliceOrg.orgId)
  })

  it('#2 List is paginated and scoped to the active organization', async () => {
    const alice = await signUp(makeTestEmail('post-alice-list'), 'posts123456789012', 'Alice')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-posts-2a`)
    const bob = await signUp(makeTestEmail('post-bob-list'), 'posts123456789012', 'Bob')
    const bobOrg = await createOrgAndActivate(bob.cookie, `test-${Date.now()}-posts-2b`)

    await request(getHttpServer())
      .post('/posts')
      .set('Cookie', aliceOrg.cookie)
      .send({ title: 'A-1', content: 'a1' })
      .expect(201)
    await request(getHttpServer())
      .post('/posts')
      .set('Cookie', aliceOrg.cookie)
      .send({ title: 'A-2', content: 'a2' })
      .expect(201)
    await request(getHttpServer())
      .post('/posts')
      .set('Cookie', bobOrg.cookie)
      .send({ title: 'B-1', content: 'b1' })
      .expect(201)

    const aliceList = await request(getHttpServer())
      .get('/posts')
      .set('Cookie', aliceOrg.cookie)
      .expect(200)
    expect(aliceList.body.total).toBe(2)
    expect(aliceList.body.items).toHaveLength(2)
    for (const p of aliceList.body.items) expect(p.organizationId).toBe(aliceOrg.orgId)

    const bobList = await request(getHttpServer())
      .get('/posts')
      .set('Cookie', bobOrg.cookie)
      .expect(200)
    expect(bobList.body.total).toBe(1)
    expect(bobList.body.items[0]).toMatchObject({ title: 'B-1', organizationId: bobOrg.orgId })
  })

  it('#3 Non-author member PATCH → 404 (row-level ownership)', async () => {
    const alice = await signUp(makeTestEmail('post-alice-own'), 'posts123456789012', 'Alice')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-posts-3`)

    const carol = await signUp(makeTestEmail('post-carol-own'), 'posts123456789012', 'Carol')
    await addOrgMember(aliceOrg.orgId, carol.userId, 'member')
    const carolInOrg = await setActive(carol.cookie, aliceOrg.orgId)

    const created = await request(getHttpServer())
      .post('/posts')
      .set('Cookie', aliceOrg.cookie)
      .send({ title: 'Alice secret', content: 'top' })
      .expect(201)
    const postId = created.body.id

    await request(getHttpServer())
      .patch(`/posts/${postId}`)
      .set('Cookie', carolInOrg)
      .send({ title: 'hijacked' })
      .expect(404)

    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.post.findUnique({ where: { id: postId } })
    expect(row?.title).toBe('Alice secret')
  })

  it('#4 Org owner PATCHes any post in the org (bypass via post:update RBAC)', async () => {
    const alice = await signUp(makeTestEmail('post-alice-owner'), 'posts123456789012', 'Alice')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-posts-4`)

    const carol = await signUp(makeTestEmail('post-carol-owner'), 'posts123456789012', 'Carol')
    await addOrgMember(aliceOrg.orgId, carol.userId, 'member')
    const carolInOrg = await setActive(carol.cookie, aliceOrg.orgId)

    const carolPost = await request(getHttpServer())
      .post('/posts')
      .set('Cookie', carolInOrg)
      .send({ title: 'Carol original', content: 'c' })
      .expect(201)

    await request(getHttpServer())
      .patch(`/posts/${carolPost.body.id}`)
      .set('Cookie', aliceOrg.cookie)
      .send({ title: 'Edited by owner' })
      .expect(200)

    const raw = getApp().get(UnsafePrismaService)
    const row = await raw.post.findUnique({ where: { id: carolPost.body.id } })
    expect(row?.title).toBe('Edited by owner')
    expect(row?.authorId).toBe(carol.userId)
  })

  it('#5 Org owner DELETEs any post in the org (bypass via post:delete RBAC)', async () => {
    const alice = await signUp(makeTestEmail('post-alice-del'), 'posts123456789012', 'Alice')
    const aliceOrg = await createOrgAndActivate(alice.cookie, `test-${Date.now()}-posts-5`)

    const carol = await signUp(makeTestEmail('post-carol-del'), 'posts123456789012', 'Carol')
    await addOrgMember(aliceOrg.orgId, carol.userId, 'member')
    const carolInOrg = await setActive(carol.cookie, aliceOrg.orgId)

    const carolPost = await request(getHttpServer())
      .post('/posts')
      .set('Cookie', carolInOrg)
      .send({ title: 'To delete', content: 'x' })
      .expect(201)

    await request(getHttpServer())
      .delete(`/posts/${carolPost.body.id}`)
      .set('Cookie', aliceOrg.cookie)
      .expect(204)

    const raw = getApp().get(UnsafePrismaService)
    const gone = await raw.post.findUnique({ where: { id: carolPost.body.id } })
    expect(gone).toBeNull()
  })

  it('#6 No active org on /posts → 403 (MemberHasPermission rejects)', async () => {
    // GET /posts carries @MemberHasPermission({ post: ['read'] }). With no
    // activeOrgId the guard returns false → 403. (For routes without that
    // decorator, @RequiresOrg() at class level would throw 400 instead.)
    const { cookie } = await signUp(makeTestEmail('post-noorg'), 'posts123456789012', 'NoOrg')
    const cleared = await unsetActiveOrg(cookie)
    await request(getHttpServer()).get('/posts').set('Cookie', cleared).expect(403)
  })

  it('#7 fail-loud: PostsService called without tenant context → throws', async () => {
    const svc = getApp().get(PostsService)
    await expect(svc.findMany({ page: 1, limit: 10 })).rejects.toThrow(/No tenant context/)
  })
})
