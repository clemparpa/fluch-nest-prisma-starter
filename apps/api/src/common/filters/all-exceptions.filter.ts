import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import { RequestValidationError, TsRestRequestValidationError } from '@ts-rest/nest'
import type { Request, Response } from 'express'
import type { ZodError } from 'zod'
import { Prisma } from '@/generated/prisma/client'
// biome-ignore lint/style/useImportType: needed at runtime for Nest DI (emitDecoratorMetadata)
import { AppLogger } from '../../logger/app-logger.service'

interface ErrorPayload {
  statusCode: number
  message: string
  error: string
  requestId?: string
  issues?: unknown[]
}

interface ResolvedError {
  statusCode: number
  message: string
  error: string
  errorName: string
  issues?: unknown[]
}

const PRISMA_CODE_MAP: Record<string, { status: number; message: string }> = {
  P2000: { status: HttpStatus.BAD_REQUEST, message: 'Value too long for column' },
  P2002: { status: HttpStatus.CONFLICT, message: 'Unique constraint violation' },
  P2003: { status: HttpStatus.CONFLICT, message: 'Foreign key constraint violation' },
  P2011: { status: HttpStatus.BAD_REQUEST, message: 'Null constraint violation' },
  P2012: { status: HttpStatus.BAD_REQUEST, message: 'Missing required argument' },
  P2013: { status: HttpStatus.BAD_REQUEST, message: 'Missing required value' },
  P2014: { status: HttpStatus.CONFLICT, message: 'Relation requires a non-existent record' },
  P2024: { status: HttpStatus.SERVICE_UNAVAILABLE, message: 'Database connection pool timeout' },
  P2025: { status: HttpStatus.NOT_FOUND, message: 'Record not found' },
  P2034: { status: HttpStatus.CONFLICT, message: 'Write conflict or deadlock' },
}

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly isProd = process.env.NODE_ENV === 'production'

  constructor(private readonly logger: AppLogger) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const httpCtx = host.switchToHttp()
    const req = httpCtx.getRequest<Request & { id?: string }>()
    const res = httpCtx.getResponse<Response>()
    const requestId = req.id

    const { statusCode, message, error, errorName, issues } = this.resolve(exception)

    const payload: ErrorPayload = { statusCode, message, error }
    if (requestId) payload.requestId = requestId
    if (issues) payload.issues = issues

    this.logger.error(
      `${req.method} ${req.originalUrl} → ${statusCode} ${errorName}: ${message}`,
      this.isProd || !(exception instanceof Error) ? undefined : exception.stack,
      'ExceptionFilter',
    )

    res.status(statusCode).json(payload)
  }

  private resolve(exception: unknown): ResolvedError {
    if (
      exception instanceof RequestValidationError ||
      exception instanceof TsRestRequestValidationError
    ) {
      // Aplatissement : on remonte les issues du premier ZodError non-null parmi
      // pathParams / headers / query / body — un seul est non-null à la fois en pratique.
      const firstError =
        (exception.pathParams as ZodError | null) ??
        (exception.headers as ZodError | null) ??
        (exception.query as ZodError | null) ??
        (exception.body as ZodError | null)
      return {
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Validation failed',
        error: this.statusText(HttpStatus.BAD_REQUEST),
        errorName: exception.name,
        issues: firstError?.issues ?? [],
      }
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const resp = exception.getResponse()
      const message =
        typeof resp === 'string'
          ? resp
          : ((resp as { message?: string | string[] }).message ?? exception.message)
      return {
        statusCode: status,
        message: Array.isArray(message) ? message.join(', ') : message,
        error: this.statusText(status),
        errorName: exception.name,
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      const mapped = PRISMA_CODE_MAP[exception.code]
      if (mapped) {
        return {
          statusCode: mapped.status,
          message: mapped.message,
          error: this.statusText(mapped.status),
          errorName: exception.name,
        }
      }
      return this.internalError(exception)
    }

    if (exception instanceof Prisma.PrismaClientInitializationError) {
      return {
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        message: this.isProd ? 'Database unavailable' : exception.message,
        error: this.statusText(HttpStatus.SERVICE_UNAVAILABLE),
        errorName: exception.name,
      }
    }

    if (
      exception instanceof Prisma.PrismaClientValidationError ||
      exception instanceof Prisma.PrismaClientUnknownRequestError ||
      exception instanceof Prisma.PrismaClientRustPanicError
    ) {
      return this.internalError(exception)
    }

    return this.internalError(exception)
  }

  private internalError(exception: unknown): ResolvedError {
    const message =
      exception instanceof Error
        ? this.isProd
          ? 'Internal server error'
          : exception.message
        : 'Internal server error'
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message,
      error: 'Internal Server Error',
      errorName: exception instanceof Error ? exception.name : 'UnknownError',
    }
  }

  private statusText(status: number): string {
    switch (status) {
      case 400:
        return 'Bad Request'
      case 401:
        return 'Unauthorized'
      case 403:
        return 'Forbidden'
      case 404:
        return 'Not Found'
      case 408:
        return 'Request Timeout'
      case 409:
        return 'Conflict'
      case 422:
        return 'Unprocessable Entity'
      case 429:
        return 'Too Many Requests'
      case 503:
        return 'Service Unavailable'
      default:
        return status >= 500 ? 'Internal Server Error' : 'Error'
    }
  }
}
