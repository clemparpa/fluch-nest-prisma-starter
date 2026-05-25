import { Module } from '@nestjs/common'
import { SessionActiveOrgHook } from './hooks/session-active-org.hook'
import { UserCreatedHook } from './hooks/user-created.hook'
import { CreateDefaultOrgListener } from './listeners/create-default-org.listener'

@Module({
  providers: [UserCreatedHook, SessionActiveOrgHook, CreateDefaultOrgListener],
})
export class AuthEventsModule {}
