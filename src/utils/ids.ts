import type { EntityId } from '@/domain/types'

export function normalizeId(value: unknown): EntityId {
  return String(value ?? '')
}

export function sameId(first: unknown, second: unknown): boolean {
  return normalizeId(first) === normalizeId(second)
}
