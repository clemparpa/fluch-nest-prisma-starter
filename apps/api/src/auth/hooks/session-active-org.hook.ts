import { Injectable } from '@nestjs/common'
import { BeforeCreate, DatabaseHook } from '@thallesp/nestjs-better-auth'
// biome-ignore lint/style/useImportType: NestJS DI requires value import for constructor metadata
import { UnsafePrismaService } from '@/prisma/unsafe-prisma.service'

/**
 * Sets `activeOrganizationId` on every new session to the user's earliest
 * Member.organizationId. Runs `before` insert so the value is part of the
 * initial row (no follow-up update needed).
 *
 * Note: at signup the default org doesn't exist yet (it's created post-commit
 * by `CreateDefaultOrgListener`), so this hook returns `undefined` for that
 * very first session — `CreateDefaultOrgListener` then patches the session
 * explicitly. From the second session onwards (signin), the org is pinned
 * automatically here.
 */
@DatabaseHook()
@Injectable()
export class SessionActiveOrgHook {
  constructor(private readonly unsafePrisma: UnsafePrismaService) {}

  @BeforeCreate('session')
  async beforeSessionCreate(session: {
    userId: string
  }): Promise<{ data: Record<string, unknown> } | undefined> {
    const member = await this.unsafePrisma.member.findFirst({
      where: { userId: session.userId },
      orderBy: { createdAt: 'asc' },
    })
    return member
      ? { data: { ...session, activeOrganizationId: member.organizationId } }
      : undefined
  }
}
