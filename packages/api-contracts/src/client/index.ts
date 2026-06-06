import { type InitClientArgs, initClient } from '@ts-rest/core'
import { allContracts } from '../all-contracts'

export type ApiClientOptions = Partial<Omit<InitClientArgs, 'baseUrl'>>

export function createApiClient(baseUrl: string, opts: ApiClientOptions = {}) {
  return initClient(allContracts, {
    baseUrl,
    baseHeaders: {},
    credentials: 'include',
    ...opts,
  })
}

export type ApiClient = ReturnType<typeof createApiClient>
