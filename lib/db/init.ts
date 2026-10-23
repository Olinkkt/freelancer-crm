import { sql } from 'kysely'
import { db } from './client'
import { MIGRATIONS, runMigrations } from './migrations'

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

const globalForInit = globalThis as unknown as {
  dbInitPromise?: Promise<void>
  dbSchemaVersion?: number
}

export async function ensureDbInitialized(force = false): Promise<void> {
  if (!force && globalForInit.dbInitPromise && globalForInit.dbSchemaVersion === SCHEMA_VERSION) {
    return globalForInit.dbInitPromise
  }

  const initPromise = (async () => {
    // 0. Enable WAL mode and busy timeout for SQLite/LibSQL to prevent database lock contention
    try {
      await sql`PRAGMA journal_mode = WAL;`.execute(db)
      await sql`PRAGMA busy_timeout = 5000;`.execute(db)
    } catch {
      // Ignore for PostgreSQL or environments where PRAGMA is unsupported
    }

    // Run migrations
    await runMigrations(db)
  })()

  globalForInit.dbInitPromise = initPromise
    .then(() => {
      globalForInit.dbSchemaVersion = SCHEMA_VERSION
    })
    .catch((err) => {
      globalForInit.dbInitPromise = undefined
      globalForInit.dbSchemaVersion = undefined
      throw err
    })

  return globalForInit.dbInitPromise
}
