import { AsyncLocalStorage } from 'node:async_hooks'

export type TenantContext = { tenantId: string | null }

export const tenantStorage = new AsyncLocalStorage<TenantContext>()

export function runAsAdmin<T>(fn: () => Promise<T>): Promise<T> {
  return tenantStorage.run({ tenantId: null }, fn)
}
