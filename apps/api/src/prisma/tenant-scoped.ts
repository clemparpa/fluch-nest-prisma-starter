/**
 * Tags a `data` payload for a tenant-scoped Prisma `create` / `createMany` call.
 * The tenant extension injects `organizationId` at runtime — this helper just
 * satisfies Prisma's static input type without exposing a raw `as` cast at the
 * call site.
 *
 * The generic parameter must be passed explicitly so TypeScript can validate
 * the payload against `Omit<T, 'organizationId'>` (typo detection, missing
 * required fields, type mismatches). Without it, T is inferred as the literal
 * shape of the argument and no real validation happens.
 *
 * Usage:
 *   prisma.testPost.create({
 *     data: tenantScoped<Prisma.TestPostCreateInput>({ title: body.title }),
 *   })
 *
 * Only needed for ops where `organizationId` is statically required by Prisma
 * (`create`, `createMany`, `upsert.create`). `update`, `delete`, `findMany`,
 * etc. don't require this — the extension augments their `where` transparently.
 */
export function tenantScoped<T>(data: Omit<T, 'organizationId'>): T {
  return data as T
}
