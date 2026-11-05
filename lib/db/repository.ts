import { Kysely } from 'kysely'
import { normalizeDueDate } from '@/lib/due-date'
import { db } from './client'
import { Database } from './schema'
import { ensureDbInitialized } from './init'
import {
  Deal,
  Contact,
  FollowUpItem,
  DealStage,
  WorkspaceData,
  DeliverableItem,
  InvoiceMilestone,
  WorkspaceSettings,
} from '@/lib/crm-types'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'

function safeParseJson<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return fallback
  }
}

function generateId(prefix: string): string {
  const rand = Math.random().toString(36).substring(2, 8)
  return `${prefix}-${Date.now()}-${rand}`
}

const normalize = (v: string | null | undefined) => (v ? v.trim().toLowerCase() : '')

/**
 * Every deal belongs to a client (person). Resolves the client by id, then by
 * email, then by name; creates the client when none matches.
 */
async function resolveDealClient(
  executor: Kysely<Database>,
  input: { contactId?: string | null; contactName?: string | null; contactEmail?: string | null }
): Promise<{ id: string; name: string; email: string }> {
  if (input.contactId) {
    const byId = await executor
      .selectFrom('contacts')
      .select(['id', 'name', 'email'])
      .where('id', '=', input.contactId)
      .executeTakeFirst()
    if (byId) return byId
  }

  const name = input.contactName?.trim() || ''
  const email = input.contactEmail?.trim() || ''
  if (!name && !email) {
    throw new Error('Client is required')
  }

  const all = await executor.selectFrom('contacts').select(['id', 'name', 'email']).execute()
  const match =
    (email && all.find((c) => normalize(c.email) === normalize(email))) ||
    (name && all.find((c) => normalize(c.name) === normalize(name)))
  if (match) return match

  const now = new Date().toISOString()
  const created = { id: generateId('cont'), name: name || email, email }
  await executor
    .insertInto('contacts')
    .values({
      id: created.id,
      name: created.name,
      email: created.email,
      phone: null,
      notes: null,
      deals: 0,
      last_touch: 'Today',
      color: 'blue',
      created_at: now,
      updated_at: now,
    })
    .execute()
  return created
}

function mapDealRow(r: any): Deal {
  const stage = (r.stage as DealStage) || 'Lead'

  return {
    id: r.id,
    title: r.title,
    value: r.value,
    rawAmount: Number(r.raw_amount) || 0,
    stage,
    next: r.next,
    nextDueDate: r.next_due_date ?? undefined,
    waiting: Number(r.waiting) === 1,
    waitingSince: r.waiting_since ?? undefined,
    color: (r.color as Deal['color']) || 'blue',
    contactId: r.contact_id ?? undefined,
    contactName: r.contact_name ?? '',
    contactEmail: r.contact_email ?? undefined,
    notes: r.notes ?? undefined,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    deliverables: safeParseJson<DeliverableItem[]>(r.deliverables, []),
    invoices: safeParseJson<InvoiceMilestone[]>(r.invoices, []),
    createdAt: r.created_at,
    updatedAt: r.updated_at ?? undefined,
  }
}

// -------------------------------------------------------------
// WORKSPACE AGGREGATE
// -------------------------------------------------------------
export async function getWorkspaceData(): Promise<WorkspaceData> {
  await ensureDbInitialized()

  const [dealRows, contactRows, followUpRows, settingsRow] = await Promise.all([
    db.selectFrom('deals').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('contacts').selectAll().orderBy('name', 'asc').execute(),
    db.selectFrom('follow_ups').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst(),
  ])

  const deals: Deal[] = dealRows.map(mapDealRow)

  const contacts: Contact[] = contactRows.map((r) => ({
    id: r.id,
    name: r.name,
    email: r.email,
    phone: r.phone ?? undefined,
    notes: r.notes ?? undefined,
    deals: Number(r.deals) || 0,
    lastTouch: r.last_touch,
    color: r.color as Contact['color'],
  }))

  const followUps: FollowUpItem[] = followUpRows.map((r) => ({
    id: r.id,
    day: r.day as FollowUpItem['day'],
    company: r.company,
    action: r.action,
    time: r.time,
    tone: r.tone as FollowUpItem['tone'],
    completed: Boolean(r.completed),
  }))

  const settings: WorkspaceSettings | undefined = settingsRow
    ? {
        operatorName: settingsRow.operator_name,
        operatorEmail: settingsRow.operator_email,
        operatorRole: settingsRow.operator_role,
        currency: settingsRow.currency,
        currencySymbol: settingsRow.currency_symbol,
        locale: settingsRow.locale,
        isClaimed: Boolean(settingsRow.is_claimed),
        updatedAt: settingsRow.updated_at,
      }
    : undefined

  return {
    deals,
    contacts,
    followUps,
    settings,
  }
}

// -------------------------------------------------------------
// DEALS REPOSITORY
// -------------------------------------------------------------
export async function createDeal(dealData: Omit<Deal, 'id'>): Promise<Deal> {
  await ensureDbInitialized()

  if (dealData.rawAmount !== undefined && Number(dealData.rawAmount) < 0) {
    throw new Error('Deal value cannot be negative')
  }
  if (dealData.value !== undefined) {
    const valStr = String(dealData.value).trim()
    if (/-\s*\d+/.test(valStr)) {
      throw new Error('Deal value cannot be negative')
    }
    const parsed = parseFloat(valStr.replace(/[^0-9.-]/g, ''))
    if (!isNaN(parsed) && parsed < 0) {
      throw new Error('Deal value cannot be negative')
    }
  }

  const id = generateId('deal')
  const now = new Date().toISOString()
  const rawAmount = Number(dealData.rawAmount) || 0

  const settings = await getWorkspaceSettings()
  const fallback = settings || OPERATOR_CONFIG
  const defaultValue = formatMoney(rawAmount, fallback)

  const nextAction = dealData.next || ''
  const nextDueDate = normalizeDueDate(dealData.nextDueDate)

  const client = await resolveDealClient(db, dealData)
  const contactName = client.name
  const contactEmail = client.email || null

  await db
    .insertInto('deals')
    .values({
      id,
      title: dealData.title,
      value: dealData.value || defaultValue,
      raw_amount: rawAmount,
      stage: dealData.stage,
      next: nextAction,
      next_due_date: nextDueDate,
      waiting: dealData.waiting ? 1 : 0,
      waiting_since: dealData.waiting ? now : null,
      color: dealData.color || 'blue',
      contact_id: client.id,
      contact_name: contactName,
      contact_email: contactEmail,
      notes: dealData.notes || null,
      start_date: dealData.startDate || null,
      end_date: dealData.endDate || null,
      deliverables: dealData.deliverables ? JSON.stringify(dealData.deliverables) : null,
      invoices: dealData.invoices ? JSON.stringify(dealData.invoices) : null,
      created_at: now,
      updated_at: now,
    })
    .execute()


  return {
    ...dealData,
    id,
    value: dealData.value || defaultValue,
    contactId: client.id,
    contactName,
    contactEmail: contactEmail || undefined,
    next: nextAction,
    nextDueDate: dealData.nextDueDate,
    waiting: !!dealData.waiting,
    waitingSince: dealData.waiting ? now : undefined,
    createdAt: now,
    deliverables: dealData.deliverables || [],
    invoices: dealData.invoices || [],
  }
}

export async function updateDeal(deal: Deal): Promise<Deal | null> {
  await ensureDbInitialized()

  if (deal.rawAmount !== undefined && Number(deal.rawAmount) < 0) {
    throw new Error('Deal value cannot be negative')
  }
  if (deal.value !== undefined) {
    const valStr = String(deal.value).trim()
    if (/-\s*\d+/.test(valStr)) {
      throw new Error('Deal value cannot be negative')
    }
    const parsed = parseFloat(valStr.replace(/[^0-9.-]/g, ''))
    if (!isNaN(parsed) && parsed < 0) {
      throw new Error('Deal value cannot be negative')
    }
  }

  const oldDeal = await db
    .selectFrom('deals')
    .select(['id', 'contact_id', 'contact_name', 'contact_email', 'waiting', 'waiting_since'])
    .where('id', '=', deal.id)
    .executeTakeFirst()

  if (!oldDeal) {
    return null
  }

  const now = new Date().toISOString()
  const rawAmount = Number(deal.rawAmount) || 0

  const nextAction = deal.next || ''
  const nextDueDate = normalizeDueDate(deal.nextDueDate)
  const clientGiven = !!(deal.contactId || deal.contactName?.trim() || deal.contactEmail?.trim())
  const client = await resolveDealClient(
    db,
    clientGiven
      ? deal
      : { contactId: oldDeal.contact_id, contactName: oldDeal.contact_name, contactEmail: oldDeal.contact_email }
  )

  // Keep the original start while still waiting; reset when waiting begins or ends
  const waitingSince = deal.waiting
    ? Number(oldDeal.waiting) === 1 && oldDeal.waiting_since
      ? oldDeal.waiting_since
      : now
    : null

  await db
    .updateTable('deals')
    .set({
      title: deal.title,
      value: deal.value,
      raw_amount: rawAmount,
      stage: deal.stage,
      next: nextAction,
      next_due_date: nextDueDate,
      waiting: deal.waiting ? 1 : 0,
      waiting_since: waitingSince,
      color: deal.color,
      contact_id: client.id,
      contact_name: client.name,
      contact_email: client.email || null,
      notes: deal.notes || null,
      start_date: deal.startDate || null,
      end_date: deal.endDate || null,
      deliverables: deal.deliverables ? JSON.stringify(deal.deliverables) : null,
      invoices: deal.invoices ? JSON.stringify(deal.invoices) : null,
      updated_at: now,
    })
    .where('id', '=', deal.id)
    .execute()

  return {
    ...deal,
    contactId: client.id,
    contactName: client.name,
    contactEmail: client.email || undefined,
    next: nextAction,
    nextDueDate: deal.nextDueDate,
    waiting: !!deal.waiting,
    waitingSince: waitingSince ?? undefined,
  }
}

export async function getDealById(idOrSlug: string): Promise<Deal | null> {
  await ensureDbInitialized()

  const row = await db
    .selectFrom('deals')
    .selectAll()
    .where('id', '=', idOrSlug)
    .executeTakeFirst()

  if (row) {
    return mapDealRow(row)
  }

  // Fallback: match by title or client name, or slugified match
  const allDeals = await db.selectFrom('deals').selectAll().execute()
  const normalizedSlug = idOrSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const match = allDeals.find((d) => {
    if (d.title.toLowerCase() === idOrSlug.toLowerCase()) return true
    const clientName = (d.contact_name || '').toLowerCase()
    if (clientName && clientName === idOrSlug.toLowerCase()) return true
    const titleSlug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const clientSlug = clientName.replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return titleSlug === normalizedSlug || (!!clientSlug && clientSlug === normalizedSlug)
  })

  if (!match) return null
  return mapDealRow(match)
}

export async function deleteDeal(id: string): Promise<boolean> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('deals')
    .select('id')
    .where('id', '=', id)
    .executeTakeFirst()

  if (!existing) return false

  // Delete deal
  await db.deleteFrom('deals').where('id', '=', id).execute()

  // Unlink associated follow-ups
  await db.updateTable('follow_ups').set({ deal_id: null }).where('deal_id', '=', id).execute()

  return true
}


export async function moveDealStage(dealId: string, stage: DealStage): Promise<Deal | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('deals')
    .selectAll()
    .where('id', '=', dealId)
    .executeTakeFirst()

  if (!existing) return null

  // Moving stages only changes the stage. Closed = contract signed; the next
  // action and deliverables carry over into project work untouched.
  const now = new Date().toISOString()
  const dealColor = (existing.color as Deal['color']) || 'blue'

  await db
    .updateTable('deals')
    .set({
      stage,
      color: dealColor,
      updated_at: now,
    })
    .where('id', '=', dealId)
    .execute()

  return {
    id: existing.id,
    title: existing.title,
    value: existing.value,
    rawAmount: Number(existing.raw_amount) || 0,
    stage,
    next: existing.next,
    nextDueDate: existing.next_due_date ?? undefined,
    waiting: Number(existing.waiting) === 1,
    waitingSince: existing.waiting_since ?? undefined,
    color: dealColor,
    contactId: existing.contact_id ?? undefined,
    contactName: existing.contact_name ?? '',
    contactEmail: existing.contact_email ?? undefined,
    notes: existing.notes ?? undefined,
    startDate: existing.start_date ?? undefined,
    endDate: existing.end_date ?? undefined,
    deliverables: safeParseJson<DeliverableItem[]>(existing.deliverables, []),
    invoices: safeParseJson<InvoiceMilestone[]>(existing.invoices, []),
    createdAt: existing.created_at,
  }
}

/** Replace a deal's checklist (client materials + deliverables) without touching other fields */
export async function setDealChecklist(dealId: string, items: DeliverableItem[]): Promise<Deal | null> {
  await ensureDbInitialized()

  const result = await db
    .updateTable('deals')
    .set({ deliverables: JSON.stringify(items), updated_at: new Date().toISOString() })
    .where('id', '=', dealId)
    .executeTakeFirst()
  if (!Number(result.numUpdatedRows)) return null

  const row = await db.selectFrom('deals').selectAll().where('id', '=', dealId).executeTakeFirst()
  return row ? mapDealRow(row) : null
}

// -------------------------------------------------------------
// CONTACTS REPOSITORY
// -------------------------------------------------------------
export async function createContact(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await ensureDbInitialized()

  const id = generateId('cont')
  const now = new Date().toISOString()

  await db
    .insertInto('contacts')
    .values({
      id,
      name: contactData.name,
      email: contactData.email || '',
      phone: contactData.phone || null,
      notes: contactData.notes || null,
      deals: contactData.deals || 0,
      last_touch: contactData.lastTouch || 'Recently',
      color: contactData.color || 'blue',
      created_at: now,
      updated_at: now,
    })
    .execute()

  return {
    ...contactData,
    id,
  }
}

export async function updateContact(contact: Contact): Promise<Contact | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('contacts')
    .select('id')
    .where('id', '=', contact.id)
    .executeTakeFirst()

  if (!existing) {
    return null
  }

  const now = new Date().toISOString()

  await db
    .updateTable('contacts')
    .set({
      name: contact.name,
      email: contact.email,
      phone: contact.phone || null,
      notes: contact.notes || null,
      deals: contact.deals,
      last_touch: contact.lastTouch,
      color: contact.color,
      updated_at: now,
    })
    .where('id', '=', contact.id)
    .execute()

  // Keep denormalized client name/email on the client's deals in sync
  await db
    .updateTable('deals')
    .set({ contact_name: contact.name, contact_email: contact.email || null, updated_at: now })
    .where('contact_id', '=', contact.id)
    .execute()

  return contact
}

export async function deleteContact(id: string): Promise<boolean> {
  await ensureDbInitialized()

  const linkedDeal = await db
    .selectFrom('deals')
    .select('id')
    .where('contact_id', '=', id)
    .executeTakeFirst()
  if (linkedDeal) {
    throw new Error('This client still has deals. Delete or reassign them first.')
  }

  const result = await db.deleteFrom('contacts').where('id', '=', id).execute()

  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

// -------------------------------------------------------------
// FOLLOW-UPS REPOSITORY
// -------------------------------------------------------------
export async function toggleFollowUp(id: string): Promise<boolean> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('follow_ups')
    .select('completed')
    .where('id', '=', id)
    .executeTakeFirst()

  if (!existing) return false

  const newStatus = existing.completed === 1 ? 0 : 1

  await db
    .updateTable('follow_ups')
    .set({ completed: newStatus })
    .where('id', '=', id)
    .execute()

  return newStatus === 1
}

export async function syncTodos(
  todos: string[],
  companyName: string = 'Workspace',
  dealId?: string
): Promise<FollowUpItem[]> {
  await ensureDbInitialized()

  const now = new Date().toISOString()
  const created: FollowUpItem[] = []

  for (let i = 0; i < todos.length; i++) {
    const todo = todos[i]
    if (!todo.trim()) continue

    const fuId = generateId('fu')
    await db
      .insertInto('follow_ups')
      .values({
        id: fuId,
        deal_id: dealId || null,
        day: 'Today',
        company: companyName,
        action: todo.trim(),
        time: '14:00',
        tone: 'urgent',
        completed: 0,
        created_at: now,
      })
      .execute()

    created.push({
      id: fuId,
      day: 'Today',
      company: companyName,
      action: todo.trim(),
      time: '14:00',
      tone: 'urgent',
      completed: false,
    })
  }

  return created
}

export async function updateFollowUp(followUp: FollowUpItem): Promise<FollowUpItem> {
  await ensureDbInitialized()
  await db
    .updateTable('follow_ups')
    .set({
      company: followUp.company,
      action: followUp.action,
      day: followUp.day,
      time: followUp.time,
      tone: followUp.tone || 'normal',
    })
    .where('id', '=', followUp.id)
    .execute()
  return followUp
}

export async function deleteFollowUp(id: string): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db.deleteFrom('follow_ups').where('id', '=', id).execute()
  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

// -------------------------------------------------------------
// WORKSPACE SETTINGS & FIRST-RUN CLAIM
// -------------------------------------------------------------
export async function getWorkspaceSettings(): Promise<(WorkspaceSettings & { passcodeHash?: string | null }) | null> {
  await ensureDbInitialized()
  try {
    const row = await db
      .selectFrom('workspace_settings')
      .selectAll()
      .where('id', '=', 'current')
      .executeTakeFirst()

    if (!row) return null

    return {
      operatorName: row.operator_name,
      operatorEmail: row.operator_email,
      operatorRole: row.operator_role,
      currency: row.currency,
      currencySymbol: row.currency_symbol,
      locale: row.locale,
      isClaimed: Boolean(row.is_claimed),
      passcodeHash: row.passcode_hash,
      calendarFeedToken: row.calendar_feed_token || undefined,
      updatedAt: row.updated_at,
    }
  } catch (err: unknown) {
    const errorMsg = String(err)
    if (errorMsg.includes('no such table: workspace_settings')) {
      await ensureDbInitialized(true)
      const row = await db
        .selectFrom('workspace_settings')
        .selectAll()
        .where('id', '=', 'current')
        .executeTakeFirst()

      if (!row) return null

      return {
        operatorName: row.operator_name,
        operatorEmail: row.operator_email,
        operatorRole: row.operator_role,
        currency: row.currency,
        currencySymbol: row.currency_symbol,
        locale: row.locale,
        isClaimed: Boolean(row.is_claimed),
        passcodeHash: row.passcode_hash,
        calendarFeedToken: row.calendar_feed_token || undefined,
        updatedAt: row.updated_at,
      }
    }
    throw err
  }
}

export async function claimWorkspace(params: {
  operatorName: string
  operatorEmail: string
  operatorRole?: string
  currency: string
  currencySymbol: string
  locale: string
  passcodeHash?: string
}): Promise<WorkspaceSettings> {
  await ensureDbInitialized()
  const now = new Date().toISOString()
  const existing = await getWorkspaceSettings()

  if (existing && existing.isClaimed) {
    throw new Error('Workspace is already claimed and initialized.')
  }

  await db
    .deleteFrom('workspace_settings')
    .where('id', '=', 'current')
    .execute()

  await db
    .insertInto('workspace_settings')
    .values({
      id: 'current',
      operator_name: params.operatorName.trim(),
      operator_email: params.operatorEmail.trim(),
      operator_role: params.operatorRole?.trim() || 'Creative & Tech Operator',
      currency: params.currency.trim(),
      currency_symbol: params.currencySymbol.trim(),
      locale: params.locale.trim(),
      passcode_hash: params.passcodeHash || null,
      is_claimed: 1,
      created_at: now,
      updated_at: now,
    })
    .execute()

  return {
    operatorName: params.operatorName.trim(),
    operatorEmail: params.operatorEmail.trim(),
    operatorRole: params.operatorRole?.trim() || 'Creative & Tech Operator',
    currency: params.currency.trim(),
    currencySymbol: params.currencySymbol.trim(),
    locale: params.locale.trim(),
    isClaimed: true,
    updatedAt: now,
  }
}

export async function updateWorkspaceSettings(params: {
  operatorName?: string
  operatorEmail?: string
  operatorRole?: string
  currency?: string
  currencySymbol?: string
  locale?: string
  passcodeHash?: string
}): Promise<WorkspaceSettings> {
  await ensureDbInitialized()
  const now = new Date().toISOString()
  const existing = await getWorkspaceSettings()

  if (!existing) {
    // If not existing, insert as initial
    return claimWorkspace({
      operatorName: params.operatorName || 'Alex Rivera',
      operatorEmail: params.operatorEmail || 'alex@example.com',
      operatorRole: params.operatorRole || 'Full-Stack & Product Engineer',
      currency: params.currency || 'USD',
      currencySymbol: params.currencySymbol || '$',
      locale: params.locale || 'en-US',
      passcodeHash: params.passcodeHash,
    })
  }

  const newName = params.operatorName !== undefined ? params.operatorName.trim() : existing.operatorName
  const newEmail = params.operatorEmail !== undefined ? params.operatorEmail.trim() : existing.operatorEmail
  const newRole = params.operatorRole !== undefined ? params.operatorRole.trim() : existing.operatorRole
  const newCurrency = params.currency !== undefined ? params.currency.trim() : existing.currency
  const newSymbol = params.currencySymbol !== undefined ? params.currencySymbol.trim() : existing.currencySymbol
  const newLocale = params.locale !== undefined ? params.locale.trim() : existing.locale

  await db
    .updateTable('workspace_settings')
    .set({
      operator_name: newName,
      operator_email: newEmail,
      operator_role: newRole,
      currency: newCurrency,
      currency_symbol: newSymbol,
      locale: newLocale,
      ...(params.passcodeHash ? { passcode_hash: params.passcodeHash } : {}),
      updated_at: now,
    })
    .where('id', '=', 'current')
    .execute()

  return {
    operatorName: newName,
    operatorEmail: newEmail,
    operatorRole: newRole,
    currency: newCurrency,
    currencySymbol: newSymbol,
    locale: newLocale,
    isClaimed: true,
    calendarFeedToken: existing.calendarFeedToken,
    updatedAt: now,
  }
}

/**
 * Retrieves the current calendar feed token, automatically generating and persisting one if missing.
 */
export async function getOrCreateCalendarFeedToken(): Promise<string> {
  await ensureDbInitialized()
  const settings = await getWorkspaceSettings()
  if (settings && settings.calendarFeedToken) {
    return settings.calendarFeedToken
  }

  const crypto = await import('crypto')
  const token = crypto.randomBytes(24).toString('hex')
  const now = new Date().toISOString()

  if (settings) {
    await db
      .updateTable('workspace_settings')
      .set({
        calendar_feed_token: token,
        updated_at: now,
      })
      .where('id', '=', 'current')
      .execute()
  } else {
    await claimWorkspace({
      operatorName: 'Alex Rivera',
      operatorEmail: 'alex@example.com',
      currency: 'USD',
      currencySymbol: '$',
      locale: 'en-US',
    })
    await db
      .updateTable('workspace_settings')
      .set({
        calendar_feed_token: token,
        updated_at: now,
      })
      .where('id', '=', 'current')
      .execute()
  }

  return token
}

/**
 * Regenerates a new random calendar feed token, revoking any previous subscriber access.
 */
export async function regenerateCalendarFeedToken(): Promise<string> {
  await ensureDbInitialized()
  const crypto = await import('crypto')
  const token = crypto.randomBytes(24).toString('hex')
  const now = new Date().toISOString()

  const existing = await getWorkspaceSettings()
  if (!existing) {
    await claimWorkspace({
      operatorName: 'Alex Rivera',
      operatorEmail: 'alex@example.com',
      currency: 'USD',
      currencySymbol: '$',
      locale: 'en-US',
    })
  }

  await db
    .updateTable('workspace_settings')
    .set({
      calendar_feed_token: token,
      updated_at: now,
    })
    .where('id', '=', 'current')
    .execute()

  return token
}

// -------------------------------------------------------------
// WORKSPACE RESTORE / IMPORT
// -------------------------------------------------------------
export async function restoreWorkspaceData(snapshot: {
  deals?: Deal[]
  contacts?: Contact[]
  followUps?: FollowUpItem[]
  settings?: WorkspaceSettings
}): Promise<{
  dealsCount: number
  contactsCount: number
  followUpsCount: number
}> {
  await ensureDbInitialized()

  const totalItems =
    (snapshot.contacts?.length ?? 0) +
    (snapshot.deals?.length ?? 0) +
    (snapshot.followUps?.length ?? 0)

  if (totalItems === 0) {
    throw new Error('Cannot restore an empty backup: snapshot contains no data.')
  }

  const now = new Date().toISOString()

  return await db.transaction().execute(async (trx) => {
    // 1. Wipe existing tables cleanly inside transaction
    await trx.deleteFrom('follow_ups').execute()
    await trx.deleteFrom('deals').execute()
    await trx.deleteFrom('contacts').execute()

    // 2. Insert contacts
    if (snapshot.contacts && snapshot.contacts.length > 0) {
      for (const ct of snapshot.contacts) {
        await trx
          .insertInto('contacts')
          .values({
            id: ct.id,
            name: ct.name,
            email: ct.email || '',
            phone: ct.phone ?? null,
            notes: ct.notes ?? null,
            deals: ct.deals || 0,
            last_touch: ct.lastTouch || 'Today',
            color: (ct.color as any) || 'blue',
            created_at: now,
            updated_at: now,
          })
          .execute()
      }
    }

    // 3. Insert deals
    if (snapshot.deals && snapshot.deals.length > 0) {
      for (const d of snapshot.deals) {
        const client = await resolveDealClient(trx, d)
        await trx
          .insertInto('deals')
          .values({
            id: d.id,
            title: d.title,
            value: d.value,
            raw_amount: d.rawAmount ?? 0,
            stage: d.stage,
            next: d.next,
            next_due_date: d.nextDueDate ?? null,
            waiting: d.waiting ? 1 : 0,
            waiting_since: d.waiting ? (d.waitingSince ?? now) : null,
            color: d.color ?? 'blue',
            contact_id: client.id,
            contact_name: client.name,
            contact_email: client.email || null,
            notes: d.notes ?? null,
            start_date: d.startDate ?? null,
            end_date: (d as any).endDate ?? null,
            deliverables: d.deliverables ? JSON.stringify(d.deliverables) : null,
            invoices: d.invoices ? JSON.stringify(d.invoices) : null,
            created_at: now,
            updated_at: now,
          })
          .execute()
      }
    }

    // 4. Insert follow_ups
    if (snapshot.followUps && snapshot.followUps.length > 0) {
      for (const f of snapshot.followUps) {
        await trx
          .insertInto('follow_ups')
          .values({
            id: f.id,
            deal_id: (f as any).dealId ?? null,
            day: f.day || 'Today',
            company: f.company,
            action: f.action,
            time: f.time,
            tone: f.tone || 'neutral',
            completed: f.completed ? 1 : 0,
            created_at: now,
          })
          .execute()
      }
    }

    // 5. Update workspace settings if provided
    if (snapshot.settings) {
      await updateWorkspaceSettings(snapshot.settings)
    }

    return {
      dealsCount: snapshot.deals?.length || 0,
      contactsCount: snapshot.contacts?.length || 0,
      followUpsCount: snapshot.followUps?.length || 0,
    }
  })
}


