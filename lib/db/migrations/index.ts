import { Kysely, sql } from 'kysely'
import type { Database } from '../schema'
import type { Migration } from './types'
import { m001 } from './001-baseline'
import { m002 } from './002-projects'
import { m003 } from './003-legacy-pm'
import { getDialect } from '../dialect'

export const MIGRATIONS: Migration[] = [m001, m002, m003]

export async function runMigrations(db: Kysely<Database>): Promise<void> {
  const dialect = getDialect()

  // 1. CREATE TABLE IF NOT EXISTS schema_migrations
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    );
  `.execute(db)

  // 2. Query applied migrations
  let appliedRows = await db
    .selectFrom('schema_migrations')
    .select('version')
    .execute()
  let applied = new Set(appliedRows.map((r) => r.version))

  // 3. Apply pending migrations in ascending order
  const pending = MIGRATIONS.filter((m) => !applied.has(m.version)).sort(
    (a, b) => a.version - b.version
  )

  for (const m of pending) {
    try {
      await db.transaction().execute(async (trx) => {
        await m.up(trx, dialect)
        await trx
          .insertInto('schema_migrations')
          .values({
            version: m.version,
            name: m.name,
            applied_at: new Date().toISOString(),
          })
          .execute()
      })
    } catch (err: any) {
      // Check for race condition / unique violation
      const msg = err?.message || String(err)
      if (
        msg.includes('UNIQUE constraint failed') ||
        msg.includes('duplicate key') ||
        msg.includes('23505')
      ) {
        // Re-read applied and continue
        appliedRows = await db
          .selectFrom('schema_migrations')
          .select('version')
          .execute()
        applied = new Set(appliedRows.map((r) => r.version))
        continue
      }
      console.error(`Migration ${m.name} (v${m.version}) failed:`, err)
      throw err
    }
  }
}
