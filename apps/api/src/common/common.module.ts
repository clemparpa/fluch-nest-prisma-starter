import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core'
import { AppLoggerModule } from '../logger/logger.module'
import { TenantInterceptor } from '../tenant/tenant.interceptor'
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
    // Runs after the thallesp AuthGuard (guards always precede interceptors
    // in the NestJS pipeline), so req.session is populated when we read it.
    { provide: APP_INTERCEPTOR, useClass: TenantInterceptor },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
  ],
})
export class CommonModule {}
