import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import { createAuth } from './auth/auth.config'
import { CommonModule } from './common/common.module'
import { ConfigModule } from './config/config.module'
import type { Env } from './config/env.schema'
import { AppLoggerModule } from './logger/logger.module'
import { PrismaModule } from './prisma/prisma.module'
import { PrismaService } from './prisma/prisma.service'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    CommonModule,
    PrismaModule,
    UsersModule,
    AuthModule.forRootAsync({
      imports: [PrismaModule, ConfigModule],
      inject: [PrismaService, ConfigService],
      useFactory: (prisma: PrismaService, config: ConfigService<Env, true>) => ({
        auth: createAuth(prisma, {
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET', { infer: true }),
          BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
          FRONTEND_URL: config.get('FRONTEND_URL', { infer: true }),
        }),
        bodyParser: {
          json: { limit: '2mb' },
          urlencoded: { limit: '2mb', extended: true },
          rawBody: true,
        },
      }),
    }),
  ],
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
  ],
})
export class AppModule {}
