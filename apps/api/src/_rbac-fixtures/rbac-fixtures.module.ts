import { Module } from '@nestjs/common'
import { RbacFixturesController } from './rbac-fixtures.controller'

@Module({
  controllers: [RbacFixturesController],
})
export class RbacFixturesModule {}
