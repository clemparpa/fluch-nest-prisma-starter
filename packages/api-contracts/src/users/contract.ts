import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, PaginationSchema } from '../common'
import { UserSchema } from '../generated/zod/schemas/models/User.schema'

// Input PATCH /users/me : on dérive du schema généré (pick + partial + strict).
// `strict()` rejette les clés inconnues (`unrecognized_keys` 400).
const UpdateUserSchema = UserSchema.pick({ name: true, image: true }).partial().strict()
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>

export type UserResponse = z.infer<typeof UserSchema>

const PaginatedUsersSchema = z.object({
  items: z.array(UserSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})
export type PaginatedUsers = z.infer<typeof PaginatedUsersSchema>

const c = initContract()

export const usersContract = c.router(
  {
    getMe: {
      method: 'GET',
      path: '/users/me',
      responses: {
        200: UserSchema,
        401: ErrorResponseSchema,
      },
      summary: 'Current authenticated user',
    },
    updateMe: {
      method: 'PATCH',
      path: '/users/me',
      body: UpdateUserSchema,
      responses: {
        200: UserSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
      },
      summary: 'Update current user profile',
    },
    findById: {
      method: 'GET',
      path: '/users/:id',
      pathParams: c.type<{ id: string }>(),
      responses: {
        200: UserSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: 'Find user by id (self or admin)',
    },
    list: {
      method: 'GET',
      path: '/users',
      query: PaginationSchema,
      responses: {
        200: PaginatedUsersSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      summary: 'List users (admin only, paginated)',
    },
  },
  {
    strictStatusCodes: true,
  },
)
