import { initContract } from '@ts-rest/core'
import { z } from 'zod'
import { ErrorResponseSchema, PaginationSchema } from '../common'
import { PostSchema } from '../generated/zod/schemas/models/Post.schema'

const CreatePostSchema = PostSchema.pick({ title: true, content: true, published: true })
  .partial({ published: true })
  .strict()
export type CreatePostInput = z.infer<typeof CreatePostSchema>

const UpdatePostSchema = PostSchema.pick({ title: true, content: true, published: true })
  .partial()
  .strict()
export type UpdatePostInput = z.infer<typeof UpdatePostSchema>

export type PostResponse = z.infer<typeof PostSchema>

const PaginatedPostsSchema = z.object({
  items: z.array(PostSchema),
  total: z.number().int(),
  page: z.number().int(),
  limit: z.number().int(),
})
export type PaginatedPosts = z.infer<typeof PaginatedPostsSchema>

const c = initContract()

export const postsContract = c.router(
  {
    create: {
      method: 'POST',
      path: '/posts',
      body: CreatePostSchema,
      responses: {
        201: PostSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      summary: 'Create a post in the active organization',
    },
    list: {
      method: 'GET',
      path: '/posts',
      query: PaginationSchema,
      responses: {
        200: PaginatedPostsSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
      },
      summary: 'List posts in the active organization (paginated)',
    },
    findById: {
      method: 'GET',
      path: '/posts/:id',
      pathParams: c.type<{ id: string }>(),
      responses: {
        200: PostSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: 'Get a post by id (scoped to active organization)',
    },
    update: {
      method: 'PATCH',
      path: '/posts/:id',
      pathParams: c.type<{ id: string }>(),
      body: UpdatePostSchema,
      responses: {
        200: PostSchema,
        400: ErrorResponseSchema,
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: 'Update a post (author or org admin/owner)',
    },
    delete: {
      method: 'DELETE',
      path: '/posts/:id',
      pathParams: c.type<{ id: string }>(),
      body: c.type<null>(),
      responses: {
        204: c.type<null>(),
        401: ErrorResponseSchema,
        403: ErrorResponseSchema,
        404: ErrorResponseSchema,
      },
      summary: 'Delete a post (author or org admin/owner)',
    },
  },
  {
    strictStatusCodes: true,
  },
)
