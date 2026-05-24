import { z } from 'zod'

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationQuery = z.infer<typeof PaginationSchema>

export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
