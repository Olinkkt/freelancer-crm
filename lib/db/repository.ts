import { sql } from 'kysely'
import { db } from './client'
import { ensureDbInitialized } from './init'
import {
  Deal,
  Contact,
  Company,
  Activity,
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

export function mapDealRow(r: any): Deal {
  return {
    id: r.id,
    title: r.title,
    company: r.company,
    value: r.value,
    rawAmount: Number(r.raw_amount) || 0,
    stage: r.stage as DealStage,
    probability: r.probability,
    next: r.next,
    nextDueDate: r.next_due_date ?? undefined,
    color: (r.color as Deal['color']) || 'blue',
    contactName: r.contact_name ?? undefined,
    contactEmail: r.contact_email ?? undefined,
    notes: r.notes ?? undefined,
    startDate: r.start_date ?? undefined,
    endDate: r.end_date ?? undefined,
    deliverables: safeParseJson<DeliverableItem[]>(r.deliverables, []),
    invoices: safeParseJson<InvoiceMilestone[]>(r.invoices, []),
    createdAt: r.created_at,
  }
}

// -------------------------------------------------------------
// WORKSPACE AGGREGATE
// -------------------------------------------------------------
export async function getWorkspaceData(): Promise<WorkspaceData> {
  await ensureDbInitialized()

  const [dealRows, companyRows, contactRows, activityRows, followUpRows, settingsRow] = await Promise.all([
    db.selectFrom('deals').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('companies').selectAll().orderBy('name', 'asc').execute(),
    db.selectFrom('contacts').selectAll().orderBy('name', 'asc').execute(),
    db.selectFrom('activities').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('follow_ups').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst(),
  ])

  const deals: Deal[] = dealRows.map(mapDealRow)

  const companies: Company[] = companyRows.map((r) => ({
    id: r.id,
    name: r.name,
    type: r.type,
    contact: r.contact,
    email: r.email,
    deals: Number(r.deals) || 0,
    value: r.value,
    status: r.status as Company['status'],
    color: r.color as Company['color'],
  }))

  const contacts: Contact[] = contactRows.map((r) => ({
    id: r.id,
    name: r.name,
    role: r.role && r.role.trim() !== '' ? r.role : null,
    company: r.company,
    email: r.email,
    phone: r.phone ?? undefined,
    deals: Number(r.deals) || 0,
    lastTouch: r.last_touch,
    color: r.color as Contact['color'],
  }))

  const activities: Activity[] = activityRows.map((r) => ({
    id: r.id,
    dealId: r.deal_id ?? undefined,
    type: r.type as Activity['type'],
    title: r.title,
    person: r.person,
    company: r.company,
    date: r.date,
    status: r.status as Activity['status'],
    color: r.color as Activity['color'],
    summary: r.summary ?? undefined,
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

  // Ensure that if a company has only one contact, that contact is primary
  for (const comp of companies) {
    const compContacts = contacts.filter(
      (c) => c.company.trim().toLowerCase() === comp.name.trim().toLowerCase()
    )
    if (compContacts.length === 1) {
      const single = compContacts[0]
      if (comp.contact !== single.name || comp.email !== single.email) {
        comp.contact = single.name
        comp.email = single.email || ''
        db.updateTable('companies')
          .set({
            contact: single.name,
            email: single.email || '',
            updated_at: new Date().toISOString(),
          })
          .where('id', '=', comp.id)
          .execute()
          .catch(() => {})
      }
    }
  }

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
    companies,
    contacts,
    activities,
    followUps,
    settings,
  }
}

// -------------------------------------------------------------
// COMPANY METRICS & PRIMARY CONTACT SYNC
// -------------------------------------------------------------
export async function syncCompanyPrimaryContact(companyName: string): Promise<void> {
  const name = companyName.trim()
  if (!name) return

  const contacts = await db
    .selectFrom('contacts')
    .select(['id', 'name', 'email'])
    .where((eb) =>
      eb.or([
        eb('company', '=', name),
        eb(sql`lower(company)`, '=', name.toLowerCase()),
      ])
    )
    .execute()

  if (contacts.length === 1) {
    // Exactly one contact in company -> make this one the primary!
    const single = contacts[0]
    await db
      .updateTable('companies')
      .set({
        contact: single.name,
        email: single.email || '',
        updated_at: new Date().toISOString(),
      })
      .where((eb) =>
        eb.or([
          eb('name', '=', name),
          eb(sql`lower(name)`, '=', name.toLowerCase()),
        ])
      )
      .execute()
  } else if (contacts.length === 0) {
    // 0 contacts exist -> clear primary contact
    await db
      .updateTable('companies')
      .set({
        contact: '',
        email: '',
        updated_at: new Date().toISOString(),
      })
      .where((eb) =>
        eb.or([
          eb('name', '=', name),
          eb(sql`lower(name)`, '=', name.toLowerCase()),
        ])
      )
      .execute()
  } else {
    // 2 or more contacts: check if current company.contact is still a valid contact
    const comp = await db
      .selectFrom('companies')
      .select(['contact'])
      .where((eb) =>
        eb.or([
          eb('name', '=', name),
          eb(sql`lower(name)`, '=', name.toLowerCase()),
        ])
      )
      .executeTakeFirst()

    const hasValidPrimary = comp && contacts.some((c) => c.name === comp.contact)
    if (!hasValidPrimary) {
      // Default to first contact if current primary was deleted or not set
      await db
        .updateTable('companies')
        .set({
          contact: contacts[0].name,
          email: contacts[0].email || '',
          updated_at: new Date().toISOString(),
        })
        .where((eb) =>
          eb.or([
            eb('name', '=', name),
            eb(sql`lower(name)`, '=', name.toLowerCase()),
          ])
        )
        .execute()
    }
  }
}

export async function setPrimaryContact(
  companyName: string,
  contactId: string
): Promise<Company | null> {
  await ensureDbInitialized()
  const name = companyName.trim()
  const contact = await db
    .selectFrom('contacts')
    .select(['id', 'name', 'email'])
    .where('id', '=', contactId)
    .executeTakeFirst()

  if (!contact) return null

  await db
    .updateTable('companies')
    .set({
      contact: contact.name,
      email: contact.email || '',
      updated_at: new Date().toISOString(),
    })
    .where((eb) =>
      eb.or([
        eb('name', '=', name),
        eb(sql`lower(name)`, '=', name.toLowerCase()),
      ])
    )
    .execute()

  const updated = await db
    .selectFrom('companies')
    .selectAll()
    .where((eb) =>
      eb.or([
        eb('name', '=', name),
        eb(sql`lower(name)`, '=', name.toLowerCase()),
      ])
    )
    .executeTakeFirst()

  if (!updated) return null

  return {
    id: updated.id,
    name: updated.name,
    type: updated.type,
    contact: updated.contact,
    email: updated.email,
    deals: Number(updated.deals) || 0,
    value: updated.value,
    status: updated.status as Company['status'],
    color: updated.color as Company['color'],
  }
}

export async function syncCompanyMetrics(companyName: string): Promise<void> {
  if (!companyName.trim()) return

  const deals = await db
    .selectFrom('deals')
    .select(['raw_amount', 'value'])
    .where('company', '=', companyName.trim())
    .execute()

  const dealsCount = deals.length
  const totalAmount = deals.reduce((sum, d) => sum + (Number(d.raw_amount) || 0), 0)
  const settings = await getWorkspaceSettings()
  const fallback = settings || OPERATOR_CONFIG
  const formattedValue = formatMoney(totalAmount, fallback)

  await db
    .updateTable('companies')
    .set({
      deals: dealsCount,
      value: formattedValue,
      updated_at: new Date().toISOString(),
    })
    .where('name', '=', companyName.trim())
    .execute()
}

// Auto-register company if not exists
export async function ensureCompanyExists(companyName: string, contactName?: string, contactEmail?: string): Promise<void> {
  const name = companyName.trim()
  if (!name) return

  const existing = await db
    .selectFrom('companies')
    .select('id')
    .where('name', '=', name)
    .executeTakeFirst()

  if (!existing) {
    const now = new Date().toISOString()
    const settings = await getWorkspaceSettings()
    const fallback = settings || OPERATOR_CONFIG
    const zeroVal = formatMoney(0, fallback)

    await db
      .insertInto('companies')
      .values({
        id: generateId('comp'),
        name,
        type: 'Client',
        contact: contactName || '',
        email: contactEmail || '',
        deals: 0,
        value: zeroVal,
        status: 'Active',
        color: 'blue',
        created_at: now,
        updated_at: now,
      })
      .execute()
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

  const isPaid = dealData.stage === 'Paid'
  const nextAction = isPaid ? '' : (dealData.next || '')
  const nextDueDate = isPaid ? null : (dealData.nextDueDate || null)

  let contactName = dealData.contactName || null
  let contactEmail = dealData.contactEmail || null

  if (!contactName || !contactEmail) {
    const existingContact = await db
      .selectFrom('contacts')
      .select(['name', 'email'])
      .where('company', '=', dealData.company.trim())
      .executeTakeFirst()

    if (existingContact) {
      if (!contactName) contactName = existingContact.name
      if (!contactEmail) contactEmail = existingContact.email || null
    }
  }

  await ensureCompanyExists(dealData.company, contactName || undefined, contactEmail || undefined)

  await db
    .insertInto('deals')
    .values({
      id,
      title: dealData.title,
      company: dealData.company,
      company_id: null,
      value: dealData.value || defaultValue,
      raw_amount: rawAmount,
      stage: dealData.stage,
      probability: dealData.probability || '30%',
      next: nextAction,
      next_due_date: nextDueDate,
      color: dealData.color || 'blue',
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

  await syncCompanyMetrics(dealData.company)

  return {
    ...dealData,
    id,
    value: dealData.value || defaultValue,
    contactName: contactName || undefined,
    contactEmail: contactEmail || undefined,
    next: nextAction,
    nextDueDate: isPaid ? undefined : dealData.nextDueDate,
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
    .select('company')
    .where('id', '=', deal.id)
    .executeTakeFirst()

  if (!oldDeal) {
    return null
  }

  const now = new Date().toISOString()
  const rawAmount = Number(deal.rawAmount) || 0

  const isPaid = deal.stage === 'Paid'
  const nextAction = isPaid ? '' : (deal.next || '')
  const nextDueDate = isPaid ? null : (deal.nextDueDate || null)

  await db
    .updateTable('deals')
    .set({
      title: deal.title,
      company: deal.company,
      value: deal.value,
      raw_amount: rawAmount,
      stage: deal.stage,
      probability: deal.probability,
      next: nextAction,
      next_due_date: nextDueDate,
      color: deal.color,
      contact_name: deal.contactName || null,
      contact_email: deal.contactEmail || null,
      notes: deal.notes || null,
      start_date: deal.startDate || null,
      end_date: deal.endDate || null,
      deliverables: deal.deliverables ? JSON.stringify(deal.deliverables) : null,
      invoices: deal.invoices ? JSON.stringify(deal.invoices) : null,
      updated_at: now,
    })
    .where('id', '=', deal.id)
    .execute()

  await syncCompanyMetrics(deal.company)
  if (oldDeal && oldDeal.company && oldDeal.company !== deal.company) {
    await syncCompanyMetrics(oldDeal.company)
  }

  return {
    ...deal,
    next: nextAction,
    nextDueDate: isPaid ? undefined : deal.nextDueDate,
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

  // Fallback: match by title or company, or slugified match
  const allDeals = await db.selectFrom('deals').selectAll().execute()
  const normalizedSlug = idOrSlug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const match = allDeals.find((d) => {
    if (d.title.toLowerCase() === idOrSlug.toLowerCase()) return true
    if (d.company.toLowerCase() === idOrSlug.toLowerCase()) return true
    const titleSlug = d.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    const companySlug = d.company.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
    return titleSlug === normalizedSlug || companySlug === normalizedSlug
  })

  if (!match) return null
  return mapDealRow(match)
}

export async function getDealActivities(dealId: string): Promise<Activity[]> {
  await ensureDbInitialized()

  const rows = await db
    .selectFrom('activities')
    .selectAll()
    .where('deal_id', '=', dealId)
    .orderBy('created_at', 'desc')
    .execute()

  return rows.map((r) => ({
    id: r.id,
    dealId: r.deal_id ?? undefined,
    type: r.type as Activity['type'],
    title: r.title,
    person: r.person,
    company: r.company,
    date: r.date,
    status: r.status as Activity['status'],
    color: r.color as Activity['color'],
    summary: r.summary ?? undefined,
    notes: r.summary ?? undefined,
    createdAt: r.created_at,
  }))
}

export async function deleteDeal(id: string): Promise<boolean> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('deals')
    .select('company')
    .where('id', '=', id)
    .executeTakeFirst()

  if (!existing) return false

  // Delete deal
  await db.deleteFrom('deals').where('id', '=', id).execute()

  // Unlink associated activities & follow-ups
  await db.updateTable('activities').set({ deal_id: null }).where('deal_id', '=', id).execute()
  await db.updateTable('follow_ups').set({ deal_id: null }).where('deal_id', '=', id).execute()

  await syncCompanyMetrics(existing.company)

  return true
}

export const STAGE_DEFAULT_PROBABILITIES: Record<DealStage, string> = {
  Lead: '20%',
  Qualified: '40%',
  Proposal: '70%',
  Won: '100%',
  Paid: '100%',
}

export async function moveDealStage(dealId: string, stage: DealStage): Promise<Deal | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('deals')
    .selectAll()
    .where('id', '=', dealId)
    .executeTakeFirst()

  if (!existing) return null

  const isClosedWon = stage === 'Won' || stage === 'Paid'
  const isPaid = stage === 'Paid'
  const newProbability = STAGE_DEFAULT_PROBABILITIES[stage] || (isClosedWon ? '100%' : existing.probability)
  const now = new Date().toISOString()
  const dealColor = (existing.color as Deal['color']) || 'blue'
  const nextAction = isPaid ? '' : existing.next
  const nextDueDate = isPaid ? null : existing.next_due_date

  // Sync deliverables and invoices when advancing to Won or Paid
  let currentInvoices = safeParseJson<InvoiceMilestone[]>(existing.invoices, [])
  let currentDeliverables = safeParseJson<DeliverableItem[]>(existing.deliverables, [])

  if (isClosedWon) {
    if (isPaid && currentDeliverables.length > 0) {
      currentDeliverables = currentDeliverables.map((d) => ({
        ...d,
        status: 'Done',
        clientSignOff: true,
      }))
    }
  }

  await db
    .updateTable('deals')
    .set({
      stage,
      probability: newProbability,
      color: dealColor,
      next: nextAction,
      next_due_date: nextDueDate,
      deliverables: currentDeliverables.length > 0 ? JSON.stringify(currentDeliverables) : existing.deliverables,
      invoices: currentInvoices.length > 0 ? JSON.stringify(currentInvoices) : existing.invoices,
      updated_at: now,
    })
    .where('id', '=', dealId)
    .execute()

  return {
    id: existing.id,
    title: existing.title,
    company: existing.company,
    value: existing.value,
    rawAmount: Number(existing.raw_amount) || 0,
    stage,
    probability: newProbability,
    next: nextAction,
    nextDueDate: isPaid ? undefined : (existing.next_due_date ?? undefined),
    color: dealColor,
    contactName: existing.contact_name ?? undefined,
    contactEmail: existing.contact_email ?? undefined,
    notes: existing.notes ?? undefined,
    startDate: existing.start_date ?? undefined,
    endDate: existing.end_date ?? undefined,
    deliverables: safeParseJson<DeliverableItem[]>(existing.deliverables, []),
    invoices: currentInvoices,
    createdAt: existing.created_at,
  }
}

// -------------------------------------------------------------
// CONTACTS REPOSITORY
// -------------------------------------------------------------
export async function createContact(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await ensureDbInitialized()

  const id = generateId('cont')
  const now = new Date().toISOString()

  await ensureCompanyExists(contactData.company, contactData.name, contactData.email)

  await db
    .insertInto('contacts')
    .values({
      id,
      name: contactData.name,
      role: contactData.role || '',
      company: contactData.company,
      company_id: null,
      email: contactData.email || '',
      phone: contactData.phone || null,
      deals: contactData.deals || 0,
      last_touch: contactData.lastTouch || 'Recently',
      color: contactData.color || 'blue',
      created_at: now,
      updated_at: now,
    })
    .execute()

  await syncCompanyPrimaryContact(contactData.company)

  return {
    ...contactData,
    id,
    role: contactData.role && contactData.role.trim() !== '' ? contactData.role : null,
  }
}

export async function updateContact(contact: Contact): Promise<Contact | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('contacts')
    .select(['company', 'name', 'email'])
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
      role: contact.role || '',
      company: contact.company,
      email: contact.email,
      phone: contact.phone || null,
      deals: contact.deals,
      last_touch: contact.lastTouch,
      color: contact.color,
      updated_at: now,
    })
    .where('id', '=', contact.id)
    .execute()

  await syncCompanyPrimaryContact(contact.company)
  if (existing?.company && existing.company.trim().toLowerCase() !== contact.company.trim().toLowerCase()) {
    await syncCompanyPrimaryContact(existing.company)
  }

  return {
    ...contact,
    role: contact.role && contact.role.trim() !== '' ? contact.role : null,
  }
}

export async function deleteContact(id: string): Promise<boolean> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('contacts')
    .select(['company'])
    .where('id', '=', id)
    .executeTakeFirst()

  const result = await db.deleteFrom('contacts').where('id', '=', id).execute()

  if (existing?.company) {
    await syncCompanyPrimaryContact(existing.company)
  }

  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

// -------------------------------------------------------------
// COMPANIES REPOSITORY
// -------------------------------------------------------------
export async function createCompany(companyData: Omit<Company, 'id'>): Promise<Company> {
  await ensureDbInitialized()

  const id = generateId('comp')
  const now = new Date().toISOString()
  const settings = await getWorkspaceSettings()
  const fallback = settings || OPERATOR_CONFIG
  const zeroVal = formatMoney(0, fallback)

  await db
    .insertInto('companies')
    .values({
      id,
      name: companyData.name,
      type: companyData.type || 'Client',
      contact: companyData.contact || '',
      email: companyData.email || '',
      deals: companyData.deals || 0,
      value: companyData.value || zeroVal,
      status: companyData.status || 'Active',
      color: companyData.color || 'blue',
      created_at: now,
      updated_at: now,
    })
    .execute()

  return {
    ...companyData,
    id,
  }
}

export async function updateCompany(company: Company): Promise<Company | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('companies')
    .select('id')
    .where('id', '=', company.id)
    .executeTakeFirst()

  if (!existing) {
    return null
  }

  const now = new Date().toISOString()

  await db
    .updateTable('companies')
    .set({
      name: company.name,
      type: company.type,
      contact: company.contact,
      email: company.email,
      status: company.status,
      color: company.color,
      updated_at: now,
    })
    .where('id', '=', company.id)
    .execute()

  return company
}

export async function deleteCompany(id: string): Promise<boolean> {
  await ensureDbInitialized()
  // Unlink company from any deals and contacts
  await db.updateTable('deals').set({ company_id: null }).where('company_id', '=', id).execute()
  await db.updateTable('contacts').set({ company_id: null }).where('company_id', '=', id).execute()
  const result = await db.deleteFrom('companies').where('id', '=', id).execute()
  return Number(result[0]?.numDeletedRows ?? 0) > 0
}


// -------------------------------------------------------------
// ACTIVITIES & FOLLOW-UPS REPOSITORY
// -------------------------------------------------------------
export async function logActivity(
  activityData: Omit<Activity, 'id'>,
  followUpData?: Omit<FollowUpItem, 'id'>,
  dealId?: string
): Promise<{
  activity: Activity
  followUp?: FollowUpItem
  updatedDeal?: Deal
}> {
  await ensureDbInitialized()

  const targetDealId = dealId || activityData.dealId
  const actId = generateId('act')
  const now = new Date().toISOString()

  // 1. Insert Activity
  await db
    .insertInto('activities')
    .values({
      id: actId,
      deal_id: targetDealId || null,
      type: activityData.type,
      title: activityData.title,
      person: activityData.person,
      company: activityData.company,
      date: activityData.date,
      status: activityData.status,
      color: activityData.color || 'blue',
      summary: activityData.summary || null,
      created_at: now,
    })
    .execute()

  const createdActivity: Activity = {
    ...activityData,
    id: actId,
    dealId: targetDealId,
  }

  // 2. Insert Follow-up if requested
  let createdFollowUp: FollowUpItem | undefined
  if (followUpData) {
    const fuId = generateId('fu')
    await db
      .insertInto('follow_ups')
      .values({
        id: fuId,
        deal_id: targetDealId || null,
        day: followUpData.day,
        company: followUpData.company,
        action: followUpData.action,
        time: followUpData.time,
        tone: followUpData.tone,
        completed: followUpData.completed ? 1 : 0,
        created_at: now,
      })
      .execute()

    createdFollowUp = {
      ...followUpData,
      id: fuId,
      completed: Boolean(followUpData.completed),
    }
  }

  // 3. Sync to linked deal notes & next action
  let updatedDeal: Deal | undefined
  if (targetDealId) {
    const existingDealRow = await db
      .selectFrom('deals')
      .selectAll()
      .where('id', '=', targetDealId)
      .executeTakeFirst()

    if (existingDealRow) {
      const timeStr = new Date().toLocaleDateString('cs-CZ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const noteHeading = `### 📞 ${createdActivity.type}: ${createdActivity.title} (${timeStr})\n`
      const noteContent = createdActivity.summary
        ? `${noteHeading}${createdActivity.summary}`
        : noteHeading.trim()

      const newNotes = existingDealRow.notes
        ? `${existingDealRow.notes}\n\n${noteContent}`
        : noteContent

      const newNext = followUpData?.action || existingDealRow.next
      const newNextDueDate = followUpData?.time || existingDealRow.next_due_date

      await db
        .updateTable('deals')
        .set({
          notes: newNotes,
          next: newNext,
          next_due_date: newNextDueDate,
          updated_at: now,
        })
        .where('id', '=', targetDealId)
        .execute()

      updatedDeal = {
        id: existingDealRow.id,
        title: existingDealRow.title,
        company: existingDealRow.company,
        value: existingDealRow.value,
        rawAmount: Number(existingDealRow.raw_amount) || 0,
        stage: existingDealRow.stage as DealStage,
        probability: existingDealRow.probability,
        next: newNext,
        nextDueDate: newNextDueDate ?? undefined,
        color: (existingDealRow.color as Deal['color']) || 'blue',
        contactName: existingDealRow.contact_name ?? undefined,
        contactEmail: existingDealRow.contact_email ?? undefined,
        notes: newNotes,
        startDate: existingDealRow.start_date ?? undefined,
        endDate: existingDealRow.end_date ?? undefined,
        deliverables: safeParseJson<DeliverableItem[]>(existingDealRow.deliverables, []),
        invoices: safeParseJson<InvoiceMilestone[]>(existingDealRow.invoices, []),
        createdAt: existingDealRow.created_at,
      }
    }
  }

  return {
    activity: createdActivity,
    followUp: createdFollowUp,
    updatedDeal,
  }
}

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

export async function updateActivity(activity: Activity): Promise<Activity> {
  await ensureDbInitialized()
  await db
    .updateTable('activities')
    .set({
      title: activity.title,
      type: activity.type,
      person: activity.person,
      company: activity.company,
      date: activity.date,
      status: activity.status,
      summary: activity.notes || activity.summary || null,
      color: activity.color || 'blue',
      deal_id: activity.dealId || null,
    })
    .where('id', '=', activity.id)
    .execute()
  return activity
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

export async function deleteActivity(id: string): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db.deleteFrom('activities').where('id', '=', id).execute()
  return Number(result[0]?.numDeletedRows ?? 0) > 0
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
    updatedAt: now,
  }
}

// -------------------------------------------------------------
// WORKSPACE RESTORE / IMPORT
// -------------------------------------------------------------
export async function restoreWorkspaceData(snapshot: {
  deals?: Deal[]
  companies?: Company[]
  contacts?: Contact[]
  activities?: Activity[]
  followUps?: FollowUpItem[]
  settings?: WorkspaceSettings
}): Promise<{
  dealsCount: number
  companiesCount: number
  contactsCount: number
  activitiesCount: number
  followUpsCount: number
}> {
  await ensureDbInitialized()

  const totalItems =
    (snapshot.companies?.length ?? 0) +
    (snapshot.contacts?.length ?? 0) +
    (snapshot.deals?.length ?? 0) +
    (snapshot.activities?.length ?? 0) +
    (snapshot.followUps?.length ?? 0)

  if (totalItems === 0) {
    throw new Error('Cannot restore an empty backup: snapshot contains no data.')
  }

  const now = new Date().toISOString()
  const settings = await getWorkspaceSettings()
  const fallback = snapshot.settings || settings || OPERATOR_CONFIG
  const zeroVal = formatMoney(0, fallback)

  return await db.transaction().execute(async (trx) => {
    // 1. Wipe existing tables cleanly inside transaction
    await trx.deleteFrom('follow_ups').execute()
    await trx.deleteFrom('activities').execute()
    await trx.deleteFrom('deals').execute()
    await trx.deleteFrom('contacts').execute()
    await trx.deleteFrom('companies').execute()

    // 2. Insert companies
    if (snapshot.companies && snapshot.companies.length > 0) {
      for (const c of snapshot.companies) {
        await trx
          .insertInto('companies')
          .values({
            id: c.id,
            name: c.name,
            type: c.type || 'Direct Client',
            contact: c.contact || '',
            email: c.email || '',
            deals: (c as any).deals ?? (c as any).dealsCount ?? 0,
            value: (c as any).value || (c as any).pipelineVal || zeroVal,
            status: c.status || 'Active',
            color: (c.color as any) || 'blue',
            created_at: now,
            updated_at: now,
          })
          .execute()
      }
    }

    // 3. Insert contacts
    if (snapshot.contacts && snapshot.contacts.length > 0) {
      for (const ct of snapshot.contacts) {
        await trx
          .insertInto('contacts')
          .values({
            id: ct.id,
            name: ct.name,
            company: ct.company,
            company_id: (ct as any).companyId ?? null,
            role: ct.role ?? null,
            email: ct.email || '',
            phone: ct.phone ?? null,
            deals: ct.deals || 0,
            last_touch: ct.lastTouch || 'Today',
            color: (ct.color as any) || 'blue',
            created_at: now,
            updated_at: now,
          })
          .execute()
      }
    }

    // 4. Insert deals
    if (snapshot.deals && snapshot.deals.length > 0) {
      for (const d of snapshot.deals) {
        await trx
          .insertInto('deals')
          .values({
            id: d.id,
            title: d.title,
            company: d.company,
            company_id: (d as any).companyId ?? null,
            value: d.value,
            raw_amount: d.rawAmount ?? 0,
            stage: d.stage,
            probability: d.probability,
            next: d.next,
            next_due_date: d.nextDueDate ?? null,
            color: d.color ?? 'blue',
            contact_name: d.contactName ?? null,
            contact_email: d.contactEmail ?? null,
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

    // 5. Insert activities
    if (snapshot.activities && snapshot.activities.length > 0) {
      for (const a of snapshot.activities) {
        await trx
          .insertInto('activities')
          .values({
            id: a.id,
            deal_id: a.dealId ?? null,
            type: a.type,
            title: a.title,
            person: a.person,
            company: a.company,
            date: a.date,
            status: a.status,
            color: a.color ?? 'blue',
            summary: a.summary ?? null,
            created_at: now,
          })
          .execute()
      }
    }

    // 6. Insert follow_ups
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

    // 7. Update workspace settings if provided
    if (snapshot.settings) {
      await updateWorkspaceSettings(snapshot.settings)
    }

    return {
      dealsCount: snapshot.deals?.length || 0,
      companiesCount: snapshot.companies?.length || 0,
      contactsCount: snapshot.contacts?.length || 0,
      activitiesCount: snapshot.activities?.length || 0,
      followUpsCount: snapshot.followUps?.length || 0,
    }
  })
}


