import { Module } from '@nestjs/common'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { createAuth } from './auth'
import { CommonModule } from './common/common.module'
import { ConfigModule } from './config/config.module'
import { AppLoggerModule } from './logger/logger.module'
import { PrismaModule } from './prisma/prisma.module'
import { PrismaService } from './prisma/prisma.service'

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    CommonModule,
    PrismaModule,
    AuthModule.forRootAsync({
      inject: [PrismaService],
      useFactory: (prisma: PrismaService) => ({
        auth: createAuth(prisma),
        bodyParser: {
          json: { limit: '2mb' },
          urlencoded: { limit: '2mb', extended: true },
          rawBody: true,
        },
      }),
    }),
  ],
})
export class AppModule {}
