import { Module } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { EventEmitterModule } from '@nestjs/event-emitter'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { TsRestModule } from '@ts-rest/nest'
import { RbacFixturesModule } from './_rbac-fixtures/rbac-fixtures.module'
import { createAuth } from './auth/auth.config'
import { AuthEventsModule } from './auth/auth-events.module'
import { CommonModule } from './common/common.module'
import { ConfigModule } from './config/config.module'
import type { Env } from './config/env.schema'
import { HealthModule } from './health/health.module'
import { AppLoggerModule } from './logger/logger.module'
import { PostsModule } from './posts/posts.module'
import { PrismaModule } from './prisma/prisma.module'
import { UnsafePrismaService } from './prisma/unsafe-prisma.service'
import { UsersModule } from './users/users.module'

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    CommonModule,
    PrismaModule,
    UsersModule,
    HealthModule,
    PostsModule,
    EventEmitterModule.forRoot(),
    TsRestModule.register({ validateResponses: true, isGlobal: true }),
    AuthModule.forRootAsync({
      imports: [PrismaModule, ConfigModule],
      inject: [UnsafePrismaService, ConfigService],
      useFactory: (prisma: UnsafePrismaService, config: ConfigService<Env, true>) => ({
        auth: createAuth(prisma, {
          NODE_ENV: config.get('NODE_ENV', { infer: true }),
          BETTER_AUTH_SECRET: config.get('BETTER_AUTH_SECRET', { infer: true }),
          BETTER_AUTH_URL: config.get('BETTER_AUTH_URL', { infer: true }),
          FRONTEND_URL: config.get('FRONTEND_URL', { infer: true }),
        }),
        bodyParser: {
          json: { limit: '1mb' },
          urlencoded: { limit: '1mb', extended: true },
          rawBody: true,
        },
      }),
    }),
    AuthEventsModule,
    ...(process.env.NODE_ENV !== 'production' ? [RbacFixturesModule] : []),
  ],
})
export class AppModule {}
