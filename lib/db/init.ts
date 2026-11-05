import { sql } from 'kysely'
import { normalizeDueDate } from '@/lib/due-date'
import { db } from './client'

const SCHEMA_VERSION = 13

const globalForInit = globalThis as unknown as {
  dbInitPromise?: Promise<void>
  dbSchemaVersion?: number
}

export async function ensureDbInitialized(force = false): Promise<void> {
  if (!force && globalForInit.dbInitPromise && globalForInit.dbSchemaVersion === SCHEMA_VERSION) {
    return globalForInit.dbInitPromise
  }

  const initPromise = (async () => {
    // -1. Enable WAL mode and busy timeout for SQLite/LibSQL to prevent database lock contention
    try {
      await sql`PRAGMA journal_mode = WAL;`.execute(db)
      await sql`PRAGMA busy_timeout = 5000;`.execute(db)
    } catch {
      // Ignore for PostgreSQL or environments where PRAGMA is unsupported
    }

    // Migration (v5): companies table removed. Company is a plain name on deals/contacts.
    await sql`DROP TABLE IF EXISTS companies;`.execute(db)
    for (const table of ['contacts', 'deals']) {
      try {
        await sql`ALTER TABLE ${sql.table(table)} DROP COLUMN company_id;`.execute(db)
      } catch {
        // Column already dropped or never existed
      }
    }

    // 1. Contacts
    await sql`
      CREATE TABLE IF NOT EXISTS contacts (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL DEFAULT '',
        phone TEXT,
        notes TEXT,
        deals INTEGER NOT NULL DEFAULT 0,
        last_touch TEXT NOT NULL DEFAULT 'Recently',
        color TEXT NOT NULL DEFAULT 'blue',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(db)

    // 2. Deals
    await sql`
      CREATE TABLE IF NOT EXISTS deals (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        value TEXT NOT NULL DEFAULT '0',
        raw_amount INTEGER NOT NULL DEFAULT 0,
        stage TEXT NOT NULL DEFAULT 'Lead',
        next TEXT NOT NULL DEFAULT '',
        next_due_date TEXT,
        color TEXT NOT NULL DEFAULT 'blue',
        contact_id TEXT,
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

    // Migration (v6): clients are people, deals hang off a client.
    await migrateToClientsOnly()

    // v13: deals can be "waiting on client" (chase date instead of a to-do)
    await addColumnIfMissing('deals', 'waiting', 'INTEGER NOT NULL DEFAULT 0')

    // Migration (v8): next-action due dates are stored as YYYY-MM-DD instead of free text
    await migrateDueDatesToIso()

    // Migration (v9): win probability removed from deals
    if (await columnExists('deals', 'probability')) {
      await sql`ALTER TABLE deals DROP COLUMN probability;`.execute(db)
    }

    // Migration (v10): Paid is no longer a deal stage. Won = contract signed;
    // payment belongs to project work. 'Discovery' was an old name for
    // Qualified that validation still accepted; remap any stray rows.
    await sql`UPDATE deals SET stage = 'Won' WHERE stage = 'Paid';`.execute(db)
    await sql`UPDATE deals SET stage = 'Qualified' WHERE stage = 'Discovery';`.execute(db)

    // Migration (v11): PM stages renamed from Czech to English
    await sql`UPDATE deals SET stage = 'Deposit' WHERE stage = 'Záloha';`.execute(db)
    await sql`UPDATE deals SET stage = 'Materials' WHERE stage = 'Podklady';`.execute(db)
    await sql`UPDATE deals SET stage = 'Warranty' WHERE stage = 'Vady';`.execute(db)

    // Migration (v12): Won renamed to Closed; Warranty replaced by Completed
    await sql`UPDATE deals SET stage = 'Closed' WHERE stage = 'Won';`.execute(db)
    await sql`UPDATE deals SET stage = 'Completed' WHERE stage = 'Warranty';`.execute(db)

    // 3. Activities
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

    // 4. Follow-ups
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

    // 5. Workspace Settings & First-Run Setup
    await sql`
      CREATE TABLE IF NOT EXISTS workspace_settings (
        id TEXT PRIMARY KEY,
        operator_name TEXT NOT NULL,
        operator_email TEXT NOT NULL,
        operator_role TEXT NOT NULL DEFAULT 'Creative & Tech Operator',
        currency TEXT NOT NULL DEFAULT 'USD',
        currency_symbol TEXT NOT NULL DEFAULT '$',
        locale TEXT NOT NULL DEFAULT 'en-US',
        passcode_hash TEXT,
        is_claimed INTEGER NOT NULL DEFAULT 0,
        calendar_feed_token TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(db)

    // Migration: ensure calendar_feed_token column exists if table was created in prior schema
    try {
      await sql`ALTER TABLE workspace_settings ADD COLUMN calendar_feed_token TEXT;`.execute(db)
    } catch {
      // Column already exists
    }

    // Migration (v7): Google Calendar OAuth removed; drop its token and event-mapping tables
    await sql`DROP TABLE IF EXISTS google_calendar_events;`.execute(db)
    await sql`DROP TABLE IF EXISTS google_calendar_integrations;`.execute(db)

    // Helpful query indexes for fast lookups
    try {
      await sql`CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_deals_contact ON deals(contact_id);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);`.execute(db)
      await sql`CREATE INDEX IF NOT EXISTS idx_follow_ups_deal ON follow_ups(deal_id);`.execute(db)
    } catch {
      // Ignore index creation errors if dialect differs
    }
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

async function columnExists(table: string, column: string): Promise<boolean> {
  try {
    await sql`SELECT ${sql.ref(column)} FROM ${sql.table(table)} LIMIT 1`.execute(db)
    return true
  } catch {
    return false
  }
}

async function addColumnIfMissing(table: string, column: string, type: string): Promise<void> {
  if (await columnExists(table, column)) return
  await sql`ALTER TABLE ${sql.table(table)} ADD COLUMN ${sql.ref(column)} ${sql.raw(type)};`.execute(db)
}

async function migrateDueDatesToIso(): Promise<void> {
  const rows = await db.selectFrom('deals').select(['id', 'next_due_date']).where('next_due_date', 'is not', null).execute()
  for (const row of rows) {
    const current = row.next_due_date as string
    if (/^\d{4}-\d{2}-\d{2}$/.test(current)) continue
    await db
      .updateTable('deals')
      .set({ next_due_date: normalizeDueDate(current) })
      .where('id', '=', row.id)
      .execute()
  }
}

const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')

/**
 * v6 migration: drop company/role from contacts and company from deals.
 *
 * Every deal gets linked to a client (contact) via contact_id, matched by
 * email, then name, then "sole contact at that company"; otherwise a client
 * is created from the deal's contact name (or company name). Company and role
 * text is preserved as lines in the client's notes, so nothing is lost.
 */
async function migrateToClientsOnly(): Promise<void> {
  await addColumnIfMissing('contacts', 'notes', 'TEXT')
  await addColumnIfMissing('deals', 'contact_id', 'TEXT')

  const dealsHaveCompany = await columnExists('deals', 'company')
  const contactsHaveCompany = await columnExists('contacts', 'company')
  const contactsHaveRole = await columnExists('contacts', 'role')
  if (!dealsHaveCompany && !contactsHaveCompany && !contactsHaveRole) return

  await db.transaction().execute(async (trx) => {
    type LegacyContact = { id: string; name: string; email: string; notes: string | null; company?: string; role?: string }
    const contactCols = ['id', 'name', 'email', 'notes']
    if (contactsHaveCompany) contactCols.push('company')
    if (contactsHaveRole) contactCols.push('role')
    const contacts = (
      await sql<LegacyContact>`SELECT ${sql.join(contactCols.map((c) => sql.ref(c)))} FROM contacts`.execute(trx)
    ).rows

    // Lines to append to each client's notes
    const extraNotes = new Map<string, string[]>()
    const addNote = (contactId: string, line: string) => {
      const lines = extraNotes.get(contactId) ?? []
      if (!lines.includes(line)) lines.push(line)
      extraNotes.set(contactId, lines)
    }
    for (const c of contacts) {
      if (c.role?.trim()) addNote(c.id, `Role: ${c.role.trim()}`)
      if (c.company?.trim() && norm(c.company) !== 'independent' && norm(c.company) !== norm(c.name)) {
        addNote(c.id, `Company: ${c.company.trim()}`)
      }
    }

    if (dealsHaveCompany) {
      type LegacyDeal = { id: string; company: string; contact_id: string | null; contact_name: string | null; contact_email: string | null }
      const deals = (
        await sql<LegacyDeal>`SELECT id, company, contact_id, contact_name, contact_email FROM deals`.execute(trx)
      ).rows
      const now = new Date().toISOString()

      for (const d of deals) {
        let client = d.contact_id ? contacts.find((c) => c.id === d.contact_id) : undefined
        if (!client && norm(d.contact_email)) {
          client = contacts.find((c) => norm(c.email) === norm(d.contact_email))
        }
        if (!client && norm(d.contact_name)) {
          client = contacts.find((c) => norm(c.name) === norm(d.contact_name))
        }
        if (!client && !norm(d.contact_name) && !norm(d.contact_email) && norm(d.company)) {
          const atCompany = contacts.filter((c) => norm(c.company) === norm(d.company))
          if (atCompany.length === 1) client = atCompany[0]
        }
        if (!client) {
          const name = d.contact_name?.trim() || d.company?.trim() || 'Unnamed client'
          client = {
            id: `cont-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            name,
            email: d.contact_email?.trim() || '',
            notes: null,
          }
          const insertCols = ['id', 'name', 'email', 'created_at', 'updated_at']
          const insertVals: unknown[] = [client.id, client.name, client.email, now, now]
          // Legacy NOT NULL columns still exist until the end of this migration
          if (contactsHaveCompany) {
            insertCols.push('company')
            insertVals.push(d.company || '')
          }
          await sql`INSERT INTO contacts (${sql.join(insertCols.map((c) => sql.ref(c)))}) VALUES (${sql.join(insertVals)})`.execute(trx)
          contacts.push(client)
        }

        if (d.company?.trim() && norm(d.company) !== norm(client.name) && norm(d.company) !== 'independent') {
          addNote(client.id, `Company: ${d.company.trim()}`)
        }

        await sql`UPDATE deals SET contact_id = ${client.id}, contact_name = ${client.name}, contact_email = ${client.email || d.contact_email || null} WHERE id = ${d.id}`.execute(trx)
      }
    }

    for (const [contactId, lines] of extraNotes) {
      const existing = contacts.find((c) => c.id === contactId)?.notes?.trim()
      const notes = [existing, ...lines.filter((l) => !existing?.includes(l))].filter(Boolean).join('\n')
      await sql`UPDATE contacts SET notes = ${notes} WHERE id = ${contactId}`.execute(trx)
    }

    await sql`DROP INDEX IF EXISTS idx_deals_company;`.execute(trx)
    await sql`DROP INDEX IF EXISTS idx_contacts_company;`.execute(trx)
    if (dealsHaveCompany) await sql`ALTER TABLE deals DROP COLUMN company;`.execute(trx)
    if (contactsHaveCompany) await sql`ALTER TABLE contacts DROP COLUMN company;`.execute(trx)
    if (contactsHaveRole) await sql`ALTER TABLE contacts DROP COLUMN role;`.execute(trx)
  })
}
