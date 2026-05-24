import request from 'supertest'
import { afterAll, beforeAll, describe, it } from 'vitest'
import { getHttpServer } from './helpers/app'
import {
  addOrgMember,
  createOrgAndActivate,
  getAdminCookie,
  makeTestEmail,
  signUp,
} from './helpers/auth'
import { resetTestOrgs, resetTestUsers } from './helpers/db'

describe('RBAC e2e', () => {
  // Order matters: delete users first (cascades members/invitations),
  // then orgs (RESTRICT on Member.organization needs an empty org).
  beforeAll(async () => {
    await resetTestUsers()
    await resetTestOrgs()
  })
  afterAll(async () => {
    await resetTestUsers()
    await resetTestOrgs()
  })

  it('#1 system admin → @Roles([admin]) → 200', async () => {
    const cookie = await getAdminCookie()
    await request(getHttpServer())
      .get('/_rbac/system-admin')
      .set('Cookie', cookie)
      .expect(200)
      .expect({ ok: true, route: 'system-admin' })
  })

  it('#2 lambda user → @Roles([admin]) → 403', async () => {
    const { cookie } = await signUp(makeTestEmail('rbac1'), 'rbac12345678')
    await request(getHttpServer()).get('/_rbac/system-admin').set('Cookie', cookie).expect(403)
  })

  it('#3 org owner (active org set) → @OrgRoles([owner]) → 200', async () => {
    const { cookie: signupCookie } = await signUp(makeTestEmail('rbac-owner'), 'rbac12345678')
    const { cookie } = await createOrgAndActivate(signupCookie, `test-${Date.now()}-owner`)
    await request(getHttpServer())
      .get('/_rbac/org-owner')
      .set('Cookie', cookie)
      .expect(200)
      .expect({ ok: true, route: 'org-owner' })
  })

  it('#4 org member (non-owner) → @OrgRoles([owner]) → 403', async () => {
    const { cookie: ownerCookie } = await signUp(makeTestEmail('rbac-own4'), 'rbac12345678')
    const { orgId } = await createOrgAndActivate(ownerCookie, `test-${Date.now()}-shared`)
    const { cookie: memberSignupCookie, userId: memberId } = await signUp(
      makeTestEmail('rbac-mem4'),
      'rbac12345678',
    )
    await addOrgMember(orgId, memberId, 'member')
    // setActive for the member on this org
    const setActive = await request(getHttpServer())
      .post('/api/auth/organization/set-active')
      .set('Cookie', memberSignupCookie)
      .send({ organizationId: orgId })
      .expect(200)
    const memberCookie =
      (setActive.headers['set-cookie'] as unknown as string[] | undefined)?.[0]?.split(';')[0] ??
      memberSignupCookie
    await request(getHttpServer()).get('/_rbac/org-owner').set('Cookie', memberCookie).expect(403)
  })

  it('#5 anti privilege-escalation: org owner with user.role=user → @Roles([admin]) → 403', async () => {
    const { cookie: signupCookie } = await signUp(makeTestEmail('rbac-esc'), 'rbac12345678')
    const { cookie } = await createOrgAndActivate(signupCookie, `test-${Date.now()}-esc`)
    // user has user.role='user' by default; even being org owner, must NOT pass @Roles(['admin'])
    await request(getHttpServer()).get('/_rbac/system-admin').set('Cookie', cookie).expect(403)
  })

  it('#6 lambda → @UserHasPermission({ user: [delete] }) → 403', async () => {
    const { cookie } = await signUp(makeTestEmail('rbac-perm'), 'rbac12345678')
    await request(getHttpServer()).get('/_rbac/user-delete-perm').set('Cookie', cookie).expect(403)
  })

  it('#7 no active org → @OrgRoles([owner]) → 403', async () => {
    const { cookie } = await signUp(makeTestEmail('rbac-noorg'), 'rbac12345678')
    await request(getHttpServer()).get('/_rbac/org-owner').set('Cookie', cookie).expect(403)
  })

  it('#8 @AllowAnonymous() route accessible sans cookie → 200', async () => {
    await request(getHttpServer())
      .get('/_rbac/public')
      .expect(200)
      .expect({ ok: true, route: 'public' })
  })
})
