import { Module } from '@nestjs/common'
import { AuthModule } from '@thallesp/nestjs-better-auth'
import { auth } from './auth'
import { ConfigModule } from './config/config.module'
import { AppLoggerModule } from './logger/logger.module'

@Module({
  imports: [
    ConfigModule,
    AppLoggerModule,
    AuthModule.forRoot({
      auth,
      bodyParser: {
        json: { limit: '2mb' },
        urlencoded: { limit: '2mb', extended: true },
        rawBody: true,
      },
    }),
  ],
})
export class AppModule {}
