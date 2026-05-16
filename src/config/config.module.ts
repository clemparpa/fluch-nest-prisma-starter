import { Module } from '@nestjs/common'
import { ConfigModule as NestConfigModule } from '@nestjs/config'
import { envSchema } from './env.schema'

// Usage: `constructor(private config: ConfigService<Env, true>) {}` then
// `config.get('DATABASE_URL', { infer: true })` returns the typed value (e.g. `string`).
// The `true` flag drops `| undefined`; `{ infer: true }` triggers inference from `Env`.
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      validate: (env) => envSchema.parse(env),
    }),
  ],
})
export class ConfigModule {}
