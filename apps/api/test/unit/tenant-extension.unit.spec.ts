import { describe, expect, it } from 'vitest'
import { applyTenantFilter } from '@/prisma/tenant-extension'

const models = new Set(['Post'])

describe('applyTenantFilter — strict ALS states', () => {
  it('throws when tenantId is undefined on a tenant-scoped model', () => {
    expect(() =>
      applyTenantFilter('Post', 'findMany', { where: {} }, () => undefined, models),
    ).toThrow(/No tenant context/)
  })

  it('throws when tenantId is empty string (defensive)', () => {
    expect(() => applyTenantFilter('Post', 'create', { data: {} }, () => '', models)).toThrow(
      /No tenant context/,
    )
  })

  it('passes args through unchanged when tenantId === null (admin bypass)', () => {
    const args = { where: { title: 'x' } }
    const out = applyTenantFilter('Post', 'findMany', args, () => null, models)
    expect(out).toBe(args)
  })

  it('passes args through unchanged for models outside the allowlist', () => {
    const args = { where: { email: 'a@b.c' } }
    const out = applyTenantFilter('User', 'findMany', args, () => 'org-1', models)
    expect(out).toBe(args)
  })
})

describe('applyTenantFilter — read & targeted-write ops inject organizationId in where', () => {
  it.each([
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
  ])('%s', (op) => {
    const out = applyTenantFilter('Post', op, { where: { title: 'x' } }, () => 'org-1', models) as {
      where: Record<string, unknown>
    }
    expect(out.where).toEqual({ title: 'x', organizationId: 'org-1' })
  })

  it('preserves other args (orderBy, take, ...)', () => {
    const out = applyTenantFilter(
      'Post',
      'findMany',
      { where: { title: 'x' }, orderBy: { createdAt: 'desc' }, take: 10 },
      () => 'org-1',
      models,
    ) as { where: unknown; orderBy: unknown; take: unknown }
    expect(out.orderBy).toEqual({ createdAt: 'desc' })
    expect(out.take).toBe(10)
  })

  it('does not mutate the input args', () => {
    const args = { where: { title: 'x' } }
    applyTenantFilter('Post', 'findMany', args, () => 'org-1', models)
    expect(args).toEqual({ where: { title: 'x' } })
  })
})

describe('applyTenantFilter — create & upsert inject organizationId in data', () => {
  it.each(['create', 'upsert'])('%s', (op) => {
    const out = applyTenantFilter(
      'Post',
      op,
      { data: { title: 'new' } },
      () => 'org-1',
      models,
    ) as { data: Record<string, unknown> }
    expect(out.data).toEqual({ title: 'new', organizationId: 'org-1' })
  })
})

describe('applyTenantFilter — createMany handles both array and single forms', () => {
  it('createMany with array data injects tenant on each item', () => {
    const out = applyTenantFilter(
      'Post',
      'createMany',
      { data: [{ title: 'a' }, { title: 'b' }] },
      () => 'org-1',
      models,
    ) as { data: Array<Record<string, unknown>> }
    expect(out.data).toEqual([
      { title: 'a', organizationId: 'org-1' },
      { title: 'b', organizationId: 'org-1' },
    ])
  })

  it('createMany with single-object data injects tenant', () => {
    const out = applyTenantFilter(
      'Post',
      'createMany',
      { data: { title: 'one' } },
      () => 'org-1',
      models,
    ) as { data: Record<string, unknown> }
    expect(out.data).toEqual({ title: 'one', organizationId: 'org-1' })
  })

  it('createManyAndReturn behaves identically', () => {
    const out = applyTenantFilter(
      'Post',
      'createManyAndReturn',
      { data: [{ title: 'a' }] },
      () => 'org-1',
      models,
    ) as { data: Array<Record<string, unknown>> }
    expect(out.data).toEqual([{ title: 'a', organizationId: 'org-1' }])
  })
})
