/**
 * Pure rules for the one-way client sync (CRM → Invoicer). No DB, no network.
 * CRM clients are people with name, email and phone. The Invoicer client also has
 * billing details (address, IČO, DIČ) that only the Invoicer owns, so the sync
 * never sends or overwrites them.
 */

export interface CrmPerson {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  /** Invoicer client id remembered from an earlier sync */
  invoicerClientId?: string | null
}

export interface InvoicerClient {
  id: string
  name: string
  email: string
  phone: string
}

/** The fields the CRM owns on the Invoicer side */
export interface SyncedFields {
  name: string
  email: string
  phone: string
}

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase().replace(/\s+/g, ' ')

export function syncedFields(p: CrmPerson): SyncedFields {
  return {
    name: p.name.trim().slice(0, 200),
    email: (p.email ?? '').trim().slice(0, 200),
    phone: (p.phone ?? '').trim().slice(0, 60),
  }
}

/**
 * Which Invoicer client is this person? The remembered id wins, then the same
 * email, then the same name when neither side has an email. Anything else is a
 * new client: two people may share a name, so a name never beats a different email.
 */
export function findInvoicerMatch(p: CrmPerson, clients: InvoicerClient[], taken: Set<string> = new Set()): InvoicerClient | null {
  const free = clients.filter((c) => !taken.has(c.id))
  if (p.invoicerClientId) {
    const byId = clients.find((c) => c.id === p.invoicerClientId)
    if (byId) return byId
  }
  const email = norm(p.email)
  if (email) return free.find((c) => norm(c.email) === email) ?? null
  const name = norm(p.name)
  return free.find((c) => !norm(c.email) && norm(c.name) === name) ?? null
}

/** Only the fields that differ, so an unchanged client costs no write */
export function fieldsToUpdate(p: CrmPerson, c: InvoicerClient): Partial<SyncedFields> {
  const want = syncedFields(p)
  const patch: Partial<SyncedFields> = {}
  if (want.name !== c.name) patch.name = want.name
  if (want.email !== (c.email ?? '')) patch.email = want.email
  if (want.phone !== (c.phone ?? '')) patch.phone = want.phone
  return patch
}

/** Normalise what the user pastes: no trailing slash, no /api/v1 suffix, http(s) only */
export function normalizeInvoicerUrl(raw: string): string {
  let u = raw.trim()
  if (!/^https?:\/\//i.test(u)) u = `http://${u}`
  const url = new URL(u)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Use an http or https address')
  return `${url.origin}${url.pathname.replace(/\/+$/, '').replace(/\/api\/v1$/, '')}`
}
