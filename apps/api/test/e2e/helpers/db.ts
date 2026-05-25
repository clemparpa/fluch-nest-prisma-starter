import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp } from './app'

export async function resetTestUsers(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } })
}

export async function resetTestOrgs(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  // Legacy explicit cleanup: orgs created with `test-*` slugs by helpers.
  await prisma.organization.deleteMany({ where: { slug: { startsWith: 'test-' } } })
  // Orphan cleanup: default orgs auto-created at signup get a `<name>-<hex>`
  // slug that doesn't match the prefix above. Once `resetTestUsers` has run,
  // their Member rows cascade-delete and the org is left member-less.
  await prisma.organization.deleteMany({ where: { members: { none: {} } } })
}

export async function resetTestPosts(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.testPost.deleteMany({})
}
