/**
 * Lexorank-style fractional positioning utilities per §8.5 & §9.4
 */

export const POSITION_STEP = 1024
export const MIN_POSITION_GAP = 1e-6

export function positionBetween(before: number | null, after: number | null): number {
  if (before === null && after === null) {
    return POSITION_STEP
  }
  if (before === null && after !== null) {
    if (after > POSITION_STEP) {
      return after - POSITION_STEP
    }
    if (after > 0) {
      return after / 2
    }
    return after - POSITION_STEP
  }
  if (before !== null && after === null) {
    return before + POSITION_STEP
  }
  if (before !== null && after !== null) {
    return (before + after) / 2
  }
  return POSITION_STEP
}

export function isGapTooSmall(before: number | null, after: number | null): boolean {
  if (before !== null && after !== null) {
    return Math.abs(after - before) < MIN_POSITION_GAP
  }
  if (before === null && after !== null) {
    return Math.abs(after) < MIN_POSITION_GAP
  }
  return false
}

export interface Positionable {
  id: string
  position: number
}

export function renormalisePositions<T extends Positionable>(items: T[]): Array<T & { position: number }> {
  const sorted = [...items].sort((a, b) => a.position - b.position)
  return sorted.map((item, idx) => ({
    ...item,
    position: (idx + 1) * POSITION_STEP,
  }))
}
