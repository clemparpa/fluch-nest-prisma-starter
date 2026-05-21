import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common'

export interface CurrentUserPayload {
  id: string
  email: string
  name: string
  emailVerified: boolean
  image: string | null | undefined
  role: string
  createdAt: Date
  updatedAt: Date
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CurrentUserPayload => {
    const req = ctx.switchToHttp().getRequest<{ user?: CurrentUserPayload | null }>()
    if (!req.user) {
      throw new UnauthorizedException()
    }
    return req.user
  },
)
