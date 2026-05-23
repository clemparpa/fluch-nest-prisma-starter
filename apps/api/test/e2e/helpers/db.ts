import { PrismaService } from '@/prisma/prisma.service'
import { getApp } from './app'

export async function resetTestUsers(): Promise<void> {
  const prisma = getApp().get(PrismaService)
  await prisma.user.deleteMany({ where: { email: { endsWith: '@test.local' } } })
}
