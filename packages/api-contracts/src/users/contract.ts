import { initContract } from '@ts-rest/core'
import {
  ErrorResponseSchema,
  PaginatedUsersSchema,
  PaginationSchema,
  UpdateUserSchema,
  UserResponseSchema,
} from './schemas'

const c = initContract()

export const usersContract = c.router(
  {
    getMe: {
      method: 'GET',
      path: '/users/me',
      responses: {
        200: UserResponseSchema,
        401: ErrorResponseSchema,
      },
      summary: 'Current authenticated user',
    },
    updateMe: {
      method: 'PATCH',
      path: '/users/me',
      body: UpdateUserSchema,
      responses: {
        200: UserResponseSchema,
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
        200: UserResponseSchema,
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
