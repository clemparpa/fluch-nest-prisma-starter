export class PaginatedResponseDto<T> {
  items!: T[]
  total!: number
  page!: number
  limit!: number
}

export function paginate<T>(
  items: T[],
  total: number,
  page: number,
  limit: number,
): PaginatedResponseDto<T> {
  return { items, total, page, limit }
}
