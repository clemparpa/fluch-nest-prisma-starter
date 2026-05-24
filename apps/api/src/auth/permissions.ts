import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
  user: ['read', 'update', 'delete', 'ban', 'impersonate'],
  session: ['list', 'revoke'],
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
} as const

export const ac = createAccessControl(statement)

export const orgMember = ac.newRole({
  organization: ['read'],
})

export const orgAdmin = ac.newRole({
  organization: ['read', 'update'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  user: ['read', 'update'],
})

export const orgOwner = ac.newRole({
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  user: ['read', 'update', 'delete'],
})

export const sysUser = ac.newRole({
  user: ['read'],
})

export const sysAdmin = ac.newRole({
  user: ['read', 'update', 'delete', 'ban', 'impersonate'],
  session: ['list', 'revoke'],
})
