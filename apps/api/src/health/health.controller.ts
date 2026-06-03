import { Controller, Get } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime values for constructor injection metadata
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus'
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime value for constructor injection metadata
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'

@Controller('health')
@AllowAnonymous()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaClient: UnsafePrismaService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.prisma.pingCheck('db', this.prismaClient),
      () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
    ])
  }
}
