import { z } from 'zod'

export const UserResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string(),
  image: z.url().nullable(),
  role: z.string(),
  createdAt: z.coerce.date(),
})
export type UserResponse = z.infer<typeof UserResponseSchema>

export const UpdateUserSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    image: z.url().optional(),
  })
  .strict()
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export const PaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})
export type PaginationQuery = z.infer<typeof PaginationSchema>

export const PaginatedUsersSchema = z.object({
  items: z.array(UserResponseSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})
export type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>

export const ErrorResponseSchema = z.object({
  statusCode: z.number(),
  message: z.string(),
  error: z.string().optional(),
})
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>
