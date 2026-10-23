import type { SqlDialect } from '../dialect'

export const floatType = (d: SqlDialect): string => (d === 'postgres' ? 'DOUBLE PRECISION' : 'REAL')
