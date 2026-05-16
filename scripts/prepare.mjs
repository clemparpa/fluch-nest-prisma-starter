import { execSync } from 'node:child_process'
import { existsSync } from 'node:fs'

if (!existsSync('.git')) {
  console.log(
    'skip husky install — not in a standalone git repo (likely a monorepo or no git context)',
  )
  process.exit(0)
}

execSync('husky', { stdio: 'inherit' })
