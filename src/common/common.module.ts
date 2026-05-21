import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { AppLoggerModule } from '../logger/logger.module'
import { AllExceptionsFilter } from './filters/all-exceptions.filter'
import { LoggingInterceptor } from './interceptors/logging.interceptor'
import { RequestIdInterceptor } from './interceptors/request-id.interceptor'
import { TimeoutInterceptor } from './interceptors/timeout.interceptor'

@Module({
  imports: [AppLoggerModule],
  providers: [
    { provide: APP_INTERCEPTOR, useClass: RequestIdInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_INTERCEPTOR, useClass: TimeoutInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class CommonModule {}
