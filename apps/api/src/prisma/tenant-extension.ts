import { Prisma } from '@/generated/prisma/client'

/**
 * Allowlist of tenant-scoped business models. The tenant extension auto-injects
 * `organizationId` (in `where` for reads / targeted writes, in `data` for creates)
 * on every query against these models.
 *
 * CONVENTION: when you add a model with `organizationId String` to schema.prisma,
 * add its name to this Set.
 *
 * EXCLUDED ON PURPOSE: the better-auth models (Member, Invitation, Team,
 * OrganizationRole, TeamMember) also carry `organizationId` but are managed
 * internally by the `organization` plugin. Auto-filtering them would break the
 * auth flow.
 *
 * Why a static list and not DMMF-derived: Prisma 7 + the new `prisma-client`
 * generator no longer expose `Prisma.dmmf` publicly — see
 * https://github.com/prisma/prisma/issues/27028. A typed allowlist is also more
 * defensive: it forces us to explicitly opt-in models, which sidesteps the
 * better-auth exclusion problem entirely.
 */
export const MODELS_WITH_TENANT: ReadonlySet<string> = new Set<string>([
  // 'TestPost' added in S8.6.4 alongside the e2e isolation suite.
  // 'Post' will be added in S8.8 when the first real tenant-scoped business module ships.
])

const READ_OPS = new Set([
  'findUnique',
  'findUniqueOrThrow',
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'count',
  'aggregate',
  'groupBy',
])

const TARGETED_WRITE_OPS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'delete',
  'deleteMany',
])

const CREATE_OPS = new Set(['create', 'upsert'])
const CREATE_MANY_OPS = new Set(['createMany', 'createManyAndReturn'])

/**
 * Pure injection logic — testable without spinning up a Prisma client.
 * Returns the (possibly modified) args, never mutates the input.
 */
export function applyTenantFilter(
  model: string,
  operation: string,
  args: unknown,
  getTenantId: () => string | null | undefined,
  models: ReadonlySet<string> = MODELS_WITH_TENANT,
): unknown {
  if (!models.has(model)) return args

  const tenantId = getTenantId()
  // strict null = explicit admin bypass, e.g. via runAsAdmin()
  if (tenantId === null) return args
  // covers undefined + empty string — never coerce one into the other.
  if (!tenantId) {
    throw new Error(
      `No tenant context — refusing ${operation} on tenant-scoped model "${model}". ` +
        'Either set an active organization on the session, or wrap the call in runAsAdmin().',
    )
  }

  const a = args as Record<string, unknown>

  if (READ_OPS.has(operation) || TARGETED_WRITE_OPS.has(operation)) {
    return {
      ...a,
      where: { ...(a.where as Record<string, unknown> | undefined), organizationId: tenantId },
    }
  }
  if (CREATE_OPS.has(operation)) {
    return {
      ...a,
      data: { ...(a.data as Record<string, unknown> | undefined), organizationId: tenantId },
    }
  }
  if (CREATE_MANY_OPS.has(operation)) {
    const data = a.data
    return {
      ...a,
      data: Array.isArray(data)
        ? data.map((d: Record<string, unknown>) => ({ ...d, organizationId: tenantId }))
        : { ...(data as Record<string, unknown> | undefined), organizationId: tenantId },
    }
  }

  return args
}

export function tenantExtension(
  getTenantId: () => string | null | undefined,
  models: ReadonlySet<string> = MODELS_WITH_TENANT,
) {
  return Prisma.defineExtension({
    name: 'tenant-extension',
    query: {
      $allModels: {
        $allOperations({ model, operation, args, query }) {
          const next = applyTenantFilter(model, operation, args, getTenantId, models)
          return query(next as typeof args)
        },
      },
    },
  })
}
