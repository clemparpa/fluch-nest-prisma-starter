import { Global, Module } from '@nestjs/common'
import { UnsafePrismaService } from './unsafe-prisma.service'

@Global()
@Module({
  providers: [UnsafePrismaService],
  exports: [UnsafePrismaService],
})
export class PrismaModule {}
