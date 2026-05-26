import { createAccessControl } from 'better-auth/plugins/access'

const statement = {
  user: ['read', 'update', 'delete', 'ban', 'impersonate'],
  session: ['list', 'revoke'],
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  post: ['create', 'read', 'update', 'delete'],
} as const

export const ac = createAccessControl(statement)

export const orgMember = ac.newRole({
  organization: ['read'],
  post: ['create', 'read'],
})

export const orgAdmin = ac.newRole({
  organization: ['read', 'update'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  user: ['read', 'update'],
  post: ['create', 'read', 'update', 'delete'],
})

export const orgOwner = ac.newRole({
  organization: ['read', 'update', 'delete'],
  member: ['create', 'read', 'update', 'delete'],
  invitation: ['create', 'read', 'cancel'],
  user: ['read', 'update', 'delete'],
  post: ['create', 'read', 'update', 'delete'],
})

export const sysUser = ac.newRole({
  user: ['read'],
})

export const sysAdmin = ac.newRole({
  user: ['read', 'update', 'delete', 'ban', 'impersonate'],
  session: ['list', 'revoke'],
})
