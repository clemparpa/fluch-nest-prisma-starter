import { initContract } from '@ts-rest/core'
import { healthContract } from './health'
import { postsContract } from './posts'
import { usersContract } from './users'

// Aggregate consumed by @ts-rest/open-api at boot (apps/api/src/main.ts) to
// produce the single OpenAPI document served on /docs-json and /docs (UI).
// Every applicative contract added here must set { pathPrefix: '/v1' } in its
// own c.router(...) options bag — health is the documented exception.
const c = initContract()

export const allContracts = c.router({
  users: usersContract,
  posts: postsContract,
  health: healthContract,
})
