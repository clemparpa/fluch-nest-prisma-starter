import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime value for constructor injection metadata
import { ConfigService } from '@nestjs/config'
import { PrismaPg } from '@prisma/adapter-pg'
import type { Env } from '@/config/env.schema'
import { PrismaClient } from '@/generated/prisma/client'

@Injectable()
export class UnsafePrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UnsafePrismaService.name)

  constructor(config: ConfigService<Env, true>) {
    super({
      adapter: new PrismaPg({
        connectionString: config.get('DATABASE_URL', { infer: true }),
      }),
    })
  }

  async onModuleInit() {
    await this.$connect()
    this.logger.log('Prisma connected')
  }

  async onModuleDestroy() {
    this.logger.log('Prisma disconnecting')
    await this.$disconnect()
  }
}
