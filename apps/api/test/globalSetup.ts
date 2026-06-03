import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

let container: StartedPostgreSqlContainer | undefined

export async function setup(): Promise<void> {
  // Image épinglée pour parité avec docker-compose.dev.yml.
  container = await new PostgreSqlContainer('postgres:18-alpine')
    .withDatabase('fluch_test')
    .withUsername('fluch')
    .withPassword('fluch')
    .start()

  const databaseUrl = container.getConnectionUri()
  process.env.DATABASE_URL = databaseUrl
  // Le seed (prisma/seed.ts) bail si NODE_ENV !== 'development'.
  process.env.NODE_ENV = 'development'

  const env = { ...process.env, DATABASE_URL: databaseUrl, NODE_ENV: 'development' }
  execFileSync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    cwd: apiRoot,
    env,
    stdio: 'inherit',
  })
  execFileSync('pnpm', ['exec', 'prisma', 'db', 'seed'], {
    cwd: apiRoot,
    env,
    stdio: 'inherit',
  })
}

export async function teardown(): Promise<void> {
  await container?.stop({ remove: true })
}
