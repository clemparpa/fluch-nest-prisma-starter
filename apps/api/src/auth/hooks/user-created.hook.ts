import { Injectable, Logger } from '@nestjs/common'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { EventEmitter2 } from '@nestjs/event-emitter'
import { AfterCreate, DatabaseHook } from '@thallesp/nestjs-better-auth'
import { USER_CREATED, type UserCreatedEvent } from '@/auth/events'
import type { User } from '@/generated/prisma/client'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'

/**
 * Fires once the freshly created user row is committed (better-auth queues
 * `@AfterCreate('user')` callbacks post-transaction). Dispatches the
 * `user.created` event so downstream listeners stay pluggable.
 *
 * If a listener throws, the user is deleted to avoid orphans (session +
 * account cascade automatically via FK).
 *
 * NOTE: listeners MUST use direct Prisma inserts via `UnsafePrismaService`,
 * not `auth.api.createOrganization` — that API path triggers FK violations
 * even post-commit (better-auth issue #7260).
 */
@DatabaseHook()
@Injectable()
export class UserCreatedHook {
  private readonly logger = new Logger(UserCreatedHook.name)

  constructor(
    private readonly events: EventEmitter2,
    private readonly unsafePrisma: UnsafePrismaService,
  ) {}

  @AfterCreate('user')
  async afterUserCreate(rawUser: unknown): Promise<void> {
    // better-auth narrows the user type to its base shape + Record<string, unknown>
    // for additionalFields (`role`). At runtime the row is the full Prisma User.
    const user = rawUser as User
    try {
      await this.events.emitAsync(USER_CREATED, { user } satisfies UserCreatedEvent)
    } catch (err) {
      this.logger.error(
        `user.created listener failed for user=${user.id} — rolling back`,
        err instanceof Error ? err.stack : err,
      )
      await this.unsafePrisma.user.delete({ where: { id: user.id } }).catch((rollbackErr) => {
        this.logger.error(`Rollback failed for user=${user.id}`, rollbackErr)
      })
      throw err
    }
  }
}
