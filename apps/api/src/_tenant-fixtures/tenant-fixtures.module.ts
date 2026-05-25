import { Module } from '@nestjs/common'
import { TenantFixturesController } from './tenant-fixtures.controller'

@Module({
  controllers: [TenantFixturesController],
})
export class TenantFixturesModule {}
