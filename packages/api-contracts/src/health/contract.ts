import { initContract } from '@ts-rest/core'
import { z } from 'zod'

const HealthIndicatorSchema = z.record(
  z.string(),
  z
    .object({
      status: z.enum(['up', 'down']),
    })
    .catchall(z.unknown()),
)

const HealthCheckResultSchema = z.object({
  status: z.enum(['ok', 'error', 'shutting_down']),
  info: HealthIndicatorSchema.optional(),
  error: HealthIndicatorSchema.optional(),
  details: HealthIndicatorSchema,
})

export type HealthCheckResult = z.infer<typeof HealthCheckResultSchema>

const c = initContract()

// Health stays version-neutral by design: orchestrators (k8s, LBs) target
// static probe paths. No pathPrefix on this router.
export const healthContract = c.router(
  {
    check: {
      method: 'GET',
      path: '/health',
      responses: {
        200: HealthCheckResultSchema,
        503: HealthCheckResultSchema,
      },
      summary: 'Liveness/readiness probe (DB + memory heap)',
    },
  },
  { strictStatusCodes: true },
)
