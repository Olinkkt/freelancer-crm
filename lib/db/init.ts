import { sql } from 'kysely'
import { db } from './client'

const globalForInit = globalThis as unknown as {
  dbInitPromise?: Promise<void>
}

export async function ensureDbInitialized(): Promise<void> {
  if (globalForInit.dbInitPromise) {
    return globalForInit.dbInitPromise
  }

  globalForInit.dbInitPromise = (async () => {
    // 1. Companies
    await sql`
      CREATE TABLE IF NOT EXISTS companies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL DEFAULT 'Client',
        contact TEXT NOT NULL DEFAULT '',
        email TEXT NOT NULL DEFAULT '',
        deals INTEGER NOT NULL DEFAULT 0,
        value TEXT NOT NULL DEFAULT '0 Kč',
        status TEXT NOT NULL DEFAULT 'Active',
        color TEXT NOT NULL DEFAULT 'blue',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(db)

    // 2. Contacts
    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL,
        company_id TEXT,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT,
        deals INTEGER NOT NULL DEFAULT 0,
        last_touch TEXT NOT NULL DEFAULT 'Recently',
        color TEXT NOT NULL DEFAULT 'blue',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(db)

    // 3. Deals
    await sql`
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        company TEXT NOT NULL,
        company_id TEXT,
        value TEXT NOT NULL DEFAULT '0 Kč',
        raw_amount INTEGER NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'Lead',
        probability TEXT NOT NULL DEFAULT '30%',
        next TEXT NOT NULL DEFAULT '',
        next_due_date TEXT,
        color TEXT NOT NULL DEFAULT 'blue',
        contact_name TEXT,
        contact_email TEXT,
        notes TEXT,
        start_date TEXT,
        end_date TEXT,
        deliverables TEXT,
        invoices TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(db)

    // 4. Activities
    await sql`
      CREATE TABLE IF NOT EXISTS activities (
        id TEXT PRIMARY KEY,
        deal_id TEXT,
        type TEXT NOT NULL DEFAULT 'Note',
        title TEXT NOT NULL,
        person TEXT NOT NULL DEFAULT '',
        company TEXT NOT NULL DEFAULT '',
        date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'Upcoming',
        color TEXT NOT NULL DEFAULT 'blue',
        summary TEXT,
        created_at TEXT NOT NULL
      );
    `.execute(db)

    // 5. Follow-ups
    await sql`
      CREATE TABLE IF NOT EXISTS follow_ups (
        id TEXT PRIMARY KEY,
        deal_id TEXT,
        day TEXT NOT NULL DEFAULT 'Today',
        company TEXT NOT NULL,
        action TEXT NOT NULL,
        time TEXT NOT NULL DEFAULT '12:00',
        tone TEXT NOT NULL DEFAULT 'normal',
        completed INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL
      );
    `.execute(db)

    // Helpful query indexes for fast lookups
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_deals_company ON deals(company);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_follow_ups_deal ON follow_ups(deal_id);`.execute(db)
    } catch {
      // Ignore index creation errors if dialect differs
    }
  })()

  return globalForInit.dbInitPromise
}
