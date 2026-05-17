import { Module } from '@nestjs/common'
import { ConfigModule } from './config/config.module'
import { AppLoggerModule } from './logger/logger.module'

@Module({
  imports: [ConfigModule, AppLoggerModule],
})
export class AppModule {}
