import request from 'supertest'
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'
import { getApp, getHttpServer } from './app'
import { ADMIN_EMAIL, ADMIN_PASSWORD } from './auth'

const TABLES = [
  'post',
  'invitation',
  'organizationRole',
  'teamMember',
  'team',
  'member',
  'organization',
  'session',
  'verification',
  'account',
  'user',
] as const

export async function resetDb(): Promise<void> {
  const prisma = getApp().get(UnsafePrismaService)
  const list = TABLES.map((t) => `"${t}"`).join(', ')
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`)
  await seedAdmin()
}

async function seedAdmin(): Promise<void> {
  await request(getHttpServer())
    .post('/api/auth/sign-up/email')
    .send({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD, name: 'Admin Dev' })
    .expect(200)
  const prisma = getApp().get(UnsafePrismaService)
  await prisma.user.update({ where: { email: ADMIN_EMAIL }, data: { role: 'admin' } })
}
