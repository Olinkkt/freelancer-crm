import type { Transaction } from 'kysely'
import type { SqlDialect } from '../dialect'

export interface Migration {
  version: number
  name: string
  up: (trx: Transaction<any>, dialect: SqlDialect) => Promise<void>
}
