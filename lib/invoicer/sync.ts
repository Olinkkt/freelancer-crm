import { after } from 'next/server'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { fieldsToUpdate, findInvoicerMatch, normalizeInvoicerUrl, syncedFields, type CrmPerson, type InvoicerClient } from './match'

const LINK_ID = 'default'
const TIMEOUT_MS = 8000

export interface InvoicerStatus {
  connected: boolean
  url?: string
  /** First characters of the token, safe to show */
  tokenPrefix?: string
  connectedAt?: string
  lastSyncAt?: string | null
  lastError?: string | null
  linkedClients: number
  totalClients: number
}

export interface SyncSummary {
  created: number
  updated: number
  unchanged: number
  failed: number
  errors: string[]
}

interface Link {
  url: string
  token: string
}

class InvoicerError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message)
  }
}

async function getLink(): Promise<Link | null> {
  await ensureDbInitialized()
  const row = await db.selectFrom('invoicer_link').select(['url', 'token']).where('id', '=', LINK_ID).executeTakeFirst()
  return row ?? null
}

async function call<T>(link: Link, method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${link.url}/api/v1${path}`, {
      method,
      headers: { authorization: `Bearer ${link.token}`, 'content-type': 'application/json', accept: 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    throw new InvoicerError(`Can't reach the Invoicer at ${link.url}`)
  }
  const text = await res.text()
  let data: any = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    throw new InvoicerError(`${link.url} didn't answer like the Invoicer (HTTP ${res.status})`, res.status)
  }
  if (!res.ok) {
    const msg = data?.error?.message ?? data?.message ?? `HTTP ${res.status}`
    if (res.status === 401) throw new InvoicerError('The Invoicer rejected the token', 401)
    if (res.status === 403) throw new InvoicerError('The token needs the "Can make changes" scope', 403)
    throw new InvoicerError(`Invoicer: ${msg}`, res.status)
  }
  return data as T
}

const listClients = async (link: Link) => (await call<{ items: InvoicerClient[] }>(link, 'GET', '/clients')).items

async function recordResult(error: string | null) {
  await db
    .updateTable('invoicer_link')
    .set({ last_sync_at: new Date().toISOString(), last_error: error })
    .where('id', '=', LINK_ID)
    .execute()
}

const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Sync failed')

/** Push one CRM person. Creates, links or updates their Invoicer client. */
async function pushPerson(link: Link, p: CrmPerson, clients: InvoicerClient[], taken: Set<string>): Promise<'created' | 'updated' | 'unchanged'> {
  const match = findInvoicerMatch(p, clients, taken)
  let outcome: 'created' | 'updated' | 'unchanged' = 'unchanged'
  let id: string
  if (match) {
    id = match.id
    const patch = fieldsToUpdate(p, match)
    if (Object.keys(patch).length) {
      const saved = await call<InvoicerClient>(link, 'PATCH', `/clients/${encodeURIComponent(id)}`, patch)
      Object.assign(match, saved)
      outcome = 'updated'
    }
  } else {
    const created = await call<InvoicerClient>(link, 'POST', '/clients', syncedFields(p))
    clients.push(created)
    id = created.id
    outcome = 'created'
  }
  taken.add(id)
  if (p.invoicerClientId !== id) {
    await db.updateTable('contacts').set({ invoicer_client_id: id }).where('id', '=', p.id).execute()
  }
  return outcome
}

const personQuery = () =>
  db.selectFrom('contacts').select(['id', 'name', 'email', 'phone', 'invoicer_client_id as invoicerClientId'])

/** Sync one client after it was created or edited in the CRM. Never throws. */
export async function syncContactToInvoicer(contactId: string): Promise<void> {
  try {
    const link = await getLink()
    if (!link) return
    const p = await personQuery().where('id', '=', contactId).executeTakeFirst()
    if (!p) return
    const clients = await listClients(link)
    // Clients already linked to someone else in the CRM can't be claimed by email or name
    const others = await db.selectFrom('contacts').select('invoicer_client_id').where('id', '!=', contactId).where('invoicer_client_id', 'is not', null).execute()
    const taken = new Set(others.map((o) => o.invoicer_client_id as string))
    await pushPerson(link, p, clients, taken)
    await recordResult(null)
  } catch (e) {
    console.error('[invoicer sync]', errorText(e))
    try {
      await recordResult(errorText(e))
    } catch {}
  }
}

/** Run the sync once the response has gone out, so saving a client never waits on the Invoicer */
export function queueContactSync(contactId: string | undefined | null) {
  if (!contactId) return
  try {
    after(() => syncContactToInvoicer(contactId))
  } catch {
    // Outside a request (tests, scripts): run it detached
    void syncContactToInvoicer(contactId)
  }
}

/** Push every CRM client. Used by "Sync all now" and right after connecting. */
export async function syncAllContactsToInvoicer(): Promise<SyncSummary> {
  const link = await getLink()
  if (!link) throw new Error('Connect the Invoicer first')
  const summary: SyncSummary = { created: 0, updated: 0, unchanged: 0, failed: 0, errors: [] }
  try {
    const clients = await listClients(link)
    const people = await personQuery().orderBy('created_at').execute()
    // Remembered links first, so email/name matching can't steal a client someone already owns
    const taken = new Set(people.map((p) => p.invoicerClientId).filter((id): id is string => !!id && clients.some((c) => c.id === id)))
    for (const p of people) {
      if (p.invoicerClientId) taken.delete(p.invoicerClientId)
      try {
        summary[await pushPerson(link, p, clients, taken)]++
      } catch (e) {
        if (e instanceof InvoicerError && (e.status === 401 || e.status === 403 || !e.status)) throw e
        summary.failed++
        if (summary.errors.length < 5) summary.errors.push(`${p.name}: ${errorText(e)}`)
      }
    }
    await recordResult(summary.failed ? `${summary.failed} client(s) failed: ${summary.errors[0]}` : null)
    return summary
  } catch (e) {
    await recordResult(errorText(e))
    throw new Error(errorText(e))
  }
}

/** Check the URL and token, then save them. The token must be able to write. */
export async function connectInvoicer(rawUrl: string, token: string): Promise<void> {
  await ensureDbInitialized()
  let url: string
  try {
    url = normalizeInvoicerUrl(rawUrl)
  } catch {
    throw new Error('Enter the Invoicer address, like http://localhost:3100')
  }
  token = token.trim()
  if (!/^finv_\S+$/.test(token)) throw new Error('Paste an Invoicer token. It starts with finv_')
  const link = { url, token }
  await listClients(link)
  // A dry run proves the token may write without creating anything
  await call(link, 'POST', '/clients?dry_run=true', { name: 'Connection check', dryRun: true })
  const now = new Date().toISOString()
  const existing = await db.selectFrom('invoicer_link').select('id').where('id', '=', LINK_ID).executeTakeFirst()
  if (existing) {
    await db.updateTable('invoicer_link').set({ url, token, connected_at: now, last_error: null }).where('id', '=', LINK_ID).execute()
  } else {
    await db.insertInto('invoicer_link').values({ id: LINK_ID, url, token, connected_at: now, last_sync_at: null, last_error: null }).execute()
  }
}

/** Forget the URL and token. Invoicer clients and their links stay as they are. */
export async function disconnectInvoicer(): Promise<void> {
  await ensureDbInitialized()
  await db.deleteFrom('invoicer_link').where('id', '=', LINK_ID).execute()
}

export async function getInvoicerStatus(): Promise<InvoicerStatus> {
  await ensureDbInitialized()
  const row = await db.selectFrom('invoicer_link').selectAll().where('id', '=', LINK_ID).executeTakeFirst()
  const contacts = await db.selectFrom('contacts').select('invoicer_client_id').execute()
  const counts = { linkedClients: contacts.filter((c) => c.invoicer_client_id).length, totalClients: contacts.length }
  if (!row) return { connected: false, ...counts }
  return {
    connected: true,
    url: row.url,
    tokenPrefix: `${row.token.slice(0, 10)}…`,
    connectedAt: row.connected_at,
    lastSyncAt: row.last_sync_at,
    lastError: row.last_error,
    ...counts,
  }
}
