import { Global, Inject, Module } from '@nestjs/common'
import { tenantStorage } from '@/tenant/tenant.storage'
import { tenantExtension } from './tenant-extension'
import { UnsafePrismaService } from './unsafe-prisma.service'

export const PRISMA = Symbol('PRISMA')

export const InjectPrisma = () => Inject(PRISMA)

// Type derived from a real `$extends` application so that callers of
// @InjectPrisma() get a fully-typed client. `ReturnType<UnsafePrismaService['$extends']>`
// alone resolves to `unknown` because `$extends` is generic over its argument.
const buildTenantScopedClient = (raw: UnsafePrismaService) =>
  raw.$extends(tenantExtension(() => undefined))

export type TenantScopedPrismaClient = ReturnType<typeof buildTenantScopedClient>

@Global()
@Module({
  providers: [
    UnsafePrismaService,
    {
      provide: PRISMA,
      inject: [UnsafePrismaService],
      useFactory: (raw: UnsafePrismaService): TenantScopedPrismaClient =>
        raw.$extends(tenantExtension(() => tenantStorage.getStore()?.tenantId)),
    },
  ],
  exports: [UnsafePrismaService, PRISMA],
})
export class PrismaModule {}
