import { randomBytes } from 'node:crypto'
import { Injectable, Logger } from '@nestjs/common'
import { OnEvent } from '@nestjs/event-emitter'
import { USER_CREATED, type UserCreatedEvent } from '@/auth/events'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)
}

/**
 * Creates a default organization at signup, with the new user as `owner`.
 *
 * Direct Prisma INSERTs (not `auth.api.createOrganization`) because of
 * better-auth bug #7260: the API path fails with `member_userId_fkey`
 * FK violation even when the user is fully committed. The workaround
 * recommended by the issue maintainers uses direct Prisma inserts.
 *
 * IDs are auto-generated via Prisma's `@default(cuid(2))` on Organization
 * and Member, matching better-auth's own id format.
 */
@Injectable()
export class CreateDefaultOrgListener {
  private readonly logger = new Logger(CreateDefaultOrgListener.name)

  constructor(private readonly unsafePrisma: UnsafePrismaService) {}

  @OnEvent(USER_CREATED, { promisify: true })
  async handle({ user }: UserCreatedEvent): Promise<void> {
    const base = slugify(user.name || user.email.split('@')[0] || 'workspace') || 'workspace'
    const slug = `${base}-${randomBytes(4).toString('hex')}`
    const name = `${user.name || 'My'}'s workspace`

    const now = new Date()
    const org = await this.unsafePrisma.organization.create({
      data: { name, slug, createdAt: now },
    })
    await this.unsafePrisma.member.create({
      data: { userId: user.id, organizationId: org.id, role: 'owner', createdAt: now },
    })
    // `databaseHooks.session.create.before` runs at signup BEFORE the org
    // exists (user.create.after is queued post-commit, runs after the session
    // row was already inserted with activeOrganizationId=null). Pin it now so
    // the user lands in their workspace immediately.
    await this.unsafePrisma.session.updateMany({
      where: { userId: user.id, activeOrganizationId: null },
      data: { activeOrganizationId: org.id },
    })
    this.logger.log(`Default org "${slug}" (id=${org.id}) created for user=${user.id}`)
  }
}
