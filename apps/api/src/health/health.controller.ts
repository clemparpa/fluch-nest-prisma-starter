import { healthContract } from '@fluch/api-contracts'
import { Controller } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime values for constructor injection metadata
import {
  HealthCheck,
  HealthCheckService,
  MemoryHealthIndicator,
  PrismaHealthIndicator,
} from '@nestjs/terminus'
import { AllowAnonymous } from '@thallesp/nestjs-better-auth'
import { TsRestHandler, tsRestHandler } from '@ts-rest/nest'
// biome-ignore lint/style/useImportType: NestJS DI needs runtime value for constructor injection metadata
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'

@Controller()
@AllowAnonymous()
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prisma: PrismaHealthIndicator,
    private readonly memory: MemoryHealthIndicator,
    private readonly prismaClient: UnsafePrismaService,
  ) {}

  @TsRestHandler(healthContract.check)
  @HealthCheck()
  check() {
    return tsRestHandler(healthContract.check, async () => {
      try {
        const result = await this.health.check([
          () => this.prisma.pingCheck('db', this.prismaClient),
          () => this.memory.checkHeap('memory_heap', 300 * 1024 * 1024),
        ])
        // Terminus' return type uses string-keyed Partial which is structurally
        // wider than our contract Zod schema — the runtime shape matches, but
        // TS can't prove it. Cast through `as never` (same trick @ts-rest doc uses).
        return { status: 200, body: result as never }
      } catch (err) {
        // Terminus throws HealthCheckError when an indicator fails. Re-emit as
        // a 503 ts-rest response carrying the same shape the contract describes.
        if (err && typeof err === 'object' && 'causes' in err) {
          const causes = (err as { causes: Record<string, { status: 'up' | 'down' }> }).causes
          return {
            status: 503,
            body: { status: 'error', error: causes, details: causes },
          }
        }
        throw err
      }
    })
  }
}
