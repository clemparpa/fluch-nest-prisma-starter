import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp } from './app'

export async function resetTestUsers(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } })
}

export async function resetTestOrgs(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.organization.deleteMany({ where: { slug: { startsWith: 'test-' } } })
}
