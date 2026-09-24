import { Kysely, PostgresDialect } from 'kysely'
import { LibsqlDialect } from '@libsql/kysely-libsql'
import { Pool } from 'pg'
import path from 'path'
import fs from 'fs'
import { Database } from './schema'

// Global cache for Next.js hot module reloading
const globalForDb = globalThis as unknown as {
  kyselyDb?: Kysely<Database>
  initPromise?: Promise<void>
}

export function createDb(): Kysely<Database> {
  const dbUrl = process.env.DATABASE_URL || 'file:./data/crm.db'

  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    // Coolify Option A: Managed PostgreSQL
    const pool = new Pool({
      connectionString: dbUrl,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
    })

    return new Kysely<Database>({
      dialect: new PostgresDialect({ pool }),
    })
  }

  // Coolify Option B or Local Dev: Embedded SQLite / LibSQL
  let fileUrl = dbUrl
  if (!fileUrl.startsWith('file:') && !fileUrl.startsWith('sqlite:')) {
    fileUrl = `file:${fileUrl}`
  }

  // Extract raw path to ensure parent directory exists
  const rawPath = fileUrl.replace(/^(file:|sqlite:)\/{0,2}/, '')
  if (rawPath && !rawPath.startsWith(':memory:')) {
    try {
      const resolvedPath = path.isAbsolute(rawPath)
        ? rawPath
        : path.resolve(/*turbopackIgnore: true*/ process.cwd(), rawPath)
      const dir = path.dirname(resolvedPath)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
    } catch {
      // Ignore directory creation errors if read-only or in edge-like contexts
    }
  }

  return new Kysely<Database>({
    dialect: new LibsqlDialect({
      url: fileUrl,
    }),
  })
}

export const db: Kysely<Database> = globalForDb.kyselyDb ?? createDb()

if (process.env.NODE_ENV !== 'production') {
  globalForDb.kyselyDb = db
}
