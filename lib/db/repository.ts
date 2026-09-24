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
} from '@/lib/crm-types'

function safeParseJson<T>(jsonStr: string | null | undefined, fallback: T): T {
  if (!jsonStr) return fallback
  try {
    return JSON.parse(jsonStr) as T
  } catch {
    return fallback
  }
}

// -------------------------------------------------------------
// WORKSPACE AGGREGATE
// -------------------------------------------------------------
export async function getWorkspaceData(): Promise<WorkspaceData> {
  await ensureDbInitialized()

  const [dealRows, companyRows, contactRows, activityRows, followUpRows] = await Promise.all([
    db.selectFrom('deals').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('companies').selectAll().orderBy('name', 'asc').execute(),
    db.selectFrom('contacts').selectAll().orderBy('name', 'asc').execute(),
    db.selectFrom('activities').selectAll().orderBy('created_at', 'desc').execute(),
    db.selectFrom('follow_ups').selectAll().orderBy('created_at', 'desc').execute(),
  ])

  const deals: Deal[] = dealRows.map((r) => ({
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
  }))

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
    role: r.role,
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

  return {
    deals,
    companies,
    contacts,
    activities,
    followUps,
  }
}

// -------------------------------------------------------------
// COMPANY METRICS SYNC
// -------------------------------------------------------------
export async function syncCompanyMetrics(companyName: string): Promise<void> {
  if (!companyName.trim()) return

  const deals = await db
    .selectFrom('deals')
    .select(['raw_amount', 'value'])
    .where('company', '=', companyName.trim())
    .execute()

  const dealsCount = deals.length
  const totalAmount = deals.reduce((sum, d) => sum + (Number(d.raw_amount) || 0), 0)
  const formattedValue = totalAmount > 0
    ? totalAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč'
    : '0 Kč'

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
    await db
      .insertInto('companies')
      .values({
        id: `comp-${Date.now()}`,
        name,
        type: 'Client',
        contact: contactName || '',
        email: contactEmail || '',
        deals: 0,
        value: '0 Kč',
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

  const id = `deal-${Date.now()}`
  const now = new Date().toISOString()
  const rawAmount = Number(dealData.rawAmount) || 0

  await ensureCompanyExists(dealData.company, dealData.contactName, dealData.contactEmail)

  await db
    .insertInto('deals')
    .values({
      id,
      title: dealData.title,
      company: dealData.company,
      company_id: null,
      value: dealData.value || '0 Kč',
      raw_amount: rawAmount,
      stage: dealData.stage,
      probability: dealData.probability || '30%',
      next: dealData.next || '',
      next_due_date: dealData.nextDueDate || null,
      color: dealData.color || 'blue',
      contact_name: dealData.contactName || null,
      contact_email: dealData.contactEmail || null,
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
    createdAt: now,
    deliverables: dealData.deliverables || [],
    invoices: dealData.invoices || [],
  }
}

export async function updateDeal(deal: Deal): Promise<Deal> {
  await ensureDbInitialized()

  const now = new Date().toISOString()
  const rawAmount = Number(deal.rawAmount) || 0

  await db
    .updateTable('deals')
    .set({
      title: deal.title,
      company: deal.company,
      value: deal.value,
      raw_amount: rawAmount,
      stage: deal.stage,
      probability: deal.probability,
      next: deal.next,
      next_due_date: deal.nextDueDate || null,
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

  return deal
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

export async function moveDealStage(dealId: string, stage: DealStage): Promise<Deal | null> {
  await ensureDbInitialized()

  const existing = await db
    .selectFrom('deals')
    .selectAll()
    .where('id', '=', dealId)
    .executeTakeFirst()

  if (!existing) return null

  const newProbability = stage === 'Won' ? '100%' : existing.probability
  const now = new Date().toISOString()

  await db
    .updateTable('deals')
    .set({
      stage,
      probability: newProbability,
      color: 'blue',
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
    next: existing.next,
    nextDueDate: existing.next_due_date ?? undefined,
    color: 'blue',
    contactName: existing.contact_name ?? undefined,
    contactEmail: existing.contact_email ?? undefined,
    notes: existing.notes ?? undefined,
    startDate: existing.start_date ?? undefined,
    endDate: existing.end_date ?? undefined,
    deliverables: safeParseJson<DeliverableItem[]>(existing.deliverables, []),
    invoices: safeParseJson<InvoiceMilestone[]>(existing.invoices, []),
    createdAt: existing.created_at,
  }
}

// -------------------------------------------------------------
// CONTACTS REPOSITORY
// -------------------------------------------------------------
export async function createContact(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await ensureDbInitialized()

  const id = `cont-${Date.now()}`
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

  return {
    ...contactData,
    id,
  }
}

export async function updateContact(contact: Contact): Promise<Contact> {
  await ensureDbInitialized()

  const now = new Date().toISOString()

  await db
    .updateTable('contacts')
    .set({
      name: contact.name,
      role: contact.role,
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

  return contact
}

export async function deleteContact(id: string): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db.deleteFrom('contacts').where('id', '=', id).execute()
  return Number(result[0]?.numDeletedRows ?? 0) > 0
}

// -------------------------------------------------------------
// COMPANIES REPOSITORY
// -------------------------------------------------------------
export async function createCompany(companyData: Omit<Company, 'id'>): Promise<Company> {
  await ensureDbInitialized()

  const id = `comp-${Date.now()}`
  const now = new Date().toISOString()

  await db
    .insertInto('companies')
    .values({
      id,
      name: companyData.name,
      type: companyData.type || 'Client',
      contact: companyData.contact || '',
      email: companyData.email || '',
      deals: companyData.deals || 0,
      value: companyData.value || '0 Kč',
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

export async function updateCompany(company: Company): Promise<Company> {
  await ensureDbInitialized()

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
  const actId = `act-${Date.now()}`
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
    const fuId = `fu-${Date.now()}`
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
      const noteHeading = `\n\n### 📞 ${createdActivity.type}: ${createdActivity.title} (${timeStr})\n`
      const noteBody = createdActivity.summary ? `${noteHeading}${createdActivity.summary}` : ''

      const newNotes = existingDealRow.notes
        ? `${existingDealRow.notes}${noteBody}`
        : createdActivity.summary || ''

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

    const fuId = `fu-${Date.now()}-${i}`
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
