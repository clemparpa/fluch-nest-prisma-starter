import { Module } from '@nestjs/common'
import { SessionActiveOrgHook } from './hooks/session-active-org.hook'
import { UserCreatedHook } from './hooks/user-created.hook'
import { CreateDefaultOrgListener } from './listeners/create-default-org.listener'
import { WelcomeEmailListener } from './listeners/welcome-email.listener'

@Module({
  providers: [
    UserCreatedHook,
    SessionActiveOrgHook,
    CreateDefaultOrgListener,
    WelcomeEmailListener,
  ],
})
export class AuthEventsModule {}
