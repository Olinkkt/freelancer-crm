import { z } from 'zod'
import type { Insertable, Selectable } from 'kysely'
import type {
  DealsTable,
  ProjectsTable,
  ProjectMilestonesTable,
  ProjectTasksTable,
  InvoicesTable,
  ActivitiesTable,
} from '@/lib/db/schema'
import type { DealStage } from '@/lib/crm-types'
import { DEAL_STAGES, type StageCategory } from './constants'
import { toIsoDateLenient } from './dates'

// Legacy types preserved here for migration & backward compatibility
export interface DeliverableItem {
  id: string
  title: string
  status: 'Pending' | 'In Progress' | 'Done'
  clientSignOff?: boolean
  dueDate?: string
}

export interface InvoiceMilestone {
  id: string
  type: 'Deposit' | 'Progress' | 'Final'
  label: string
  amount: number
  formattedAmount?: string
  percentage?: number
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue'
  dueDate?: string
  paidAt?: string
  paymentLink?: string
}

export interface LegacyContext {
  today: string // migration run date (server local date, YYYY-MM-DD)
  currency: string // workspace_settings.currency ?? OPERATOR_CONFIG.currency
  stageIds: Record<StageCategory, string> // first stage of each category
}

export interface LegacyConversion {
  project: Insertable<ProjectsTable> | null // null = nothing to create
  milestones: Insertable<ProjectMilestonesTable>[]
  tasks: Insertable<ProjectTasksTable>[]
  invoices: Insertable<InvoicesTable>[]
  dealPatch: { stage?: DealStage; probability?: string } // empty = untouched
  activity: Insertable<ActivitiesTable> | null // stage-normalisation note
}

function safeParseArray<T>(jsonStr: string | null | undefined): { items: T[]; warning: boolean } {
  if (!jsonStr) return { items: [], warning: false }
  try {
    const parsed = JSON.parse(jsonStr)
    if (Array.isArray(parsed)) {
      return { items: parsed, warning: false }
    }
    return { items: [], warning: true }
  } catch {
    return { items: [], warning: true }
  }
}

export function convertLegacyDeal(
  deal: Selectable<DealsTable>,
  ctx: LegacyContext
): LegacyConversion {
  const { items: rawDeliverables, warning: delivWarn } = safeParseArray<any>(deal.deliverables)
  const { items: rawInvoices, warning: invWarn } = safeParseArray<any>(deal.invoices)

  let warningsCount = 0
  if (delivWarn) warningsCount++
  if (invWarn) warningsCount++

  const dealStage = deal.stage
  const hasBlobs = rawDeliverables.length > 0 || rawInvoices.length > 0
  const isWonOrPaid = dealStage === 'Won' || dealStage === 'Paid'

  // Deal patch logic (§7.7)
  let dealPatch: { stage?: DealStage; probability?: string } = {}
  let activity: Insertable<ActivitiesTable> | null = null

  if (dealStage === 'Paid') {
    dealPatch = { stage: 'Won', probability: '100%' }
  } else if (dealStage === 'Discovery') {
    dealPatch = { stage: 'Qualified' }
    activity = {
      id: `act-${deal.id}-norm`,
      type: 'Note',
      title: "Stage 'Discovery' is no longer supported; moved to Qualified.",
      deal_id: deal.id,
      company: deal.company,
      person: deal.contact_name || deal.company,
      color: 'blue',
      date: ctx.today,
      status: 'Completed',
      project_id: null,
      created_at: new Date().toISOString(),
    }
  } else if (!DEAL_STAGES.includes(dealStage as any)) {
    dealPatch = { stage: 'Lead' }
    activity = {
      id: `act-${deal.id}-norm`,
      type: 'Note',
      title: `Stage '${dealStage}' is no longer supported; moved to Lead.`,
      deal_id: deal.id,
      company: deal.company,
      person: deal.contact_name || deal.company,
      color: 'blue',
      date: ctx.today,
      status: 'Completed',
      project_id: null,
      created_at: new Date().toISOString(),
    }
  }

  // Selection: A deal produces a project when stage in {'Won','Paid'} OR parsed deliverables non-empty OR parsed invoices non-empty
  if (!isWonOrPaid && !hasBlobs) {
    return {
      project: null,
      milestones: [],
      tasks: [],
      invoices: [],
      dealPatch,
      activity,
    }
  }

  const projectId = `prj-${deal.id}`
  const now = new Date().toISOString()
  const updatedAt = deal.updated_at || now

  // Contact email check
  let contactEmail: string | null = null
  if (deal.contact_email && z.string().email().safeParse(deal.contact_email.trim()).success) {
    contactEmail = deal.contact_email.trim()
  }

  // Dates
  const startDate = toIsoDateLenient(deal.start_date) ?? (deal.created_at ? deal.created_at.slice(0, 10) : ctx.today)
  let dueDate = toIsoDateLenient(deal.end_date)
  if (dueDate && startDate && dueDate < startDate) {
    dueDate = null
  }

  // Stage mapping (§7.7)
  let category: StageCategory = 'planned'
  let closeOutcome: 'completed' | 'cancelled' | null = null
  let deliveredAt: string | null = null
  let closedAt: string | null = null

  const allDeliverablesDone =
    rawDeliverables.length > 0 &&
    rawDeliverables.every((d) => d && typeof d === 'object' && d.status === 'Done')

  if (dealStage === 'Paid') {
    category = 'closed'
    closeOutcome = 'completed'
    deliveredAt = updatedAt
    closedAt = updatedAt
  } else if (dealStage === 'Won') {
    if (allDeliverablesDone) {
      category = 'delivered'
      deliveredAt = updatedAt
    } else {
      category = 'active'
    }
  } else {
    category = 'planned'
  }

  const stageId = ctx.stageIds[category] || `stg-${category}`
  const isClosed = category === 'closed'

  // Milestones and Tasks
  const milestones: Insertable<ProjectMilestonesTable>[] = []
  const tasks: Insertable<ProjectTasksTable>[] = []

  rawDeliverables.forEach((d, i) => {
    if (!d || typeof d !== 'object' || !d.title || typeof d.title !== 'string' || !d.status) {
      warningsCount++
      return
    }

    const mId = `ms-${deal.id}-${i}`
    const mPosition = (i + 1) * 1024
    let mTitle = d.title.trim()
    if (!mTitle) mTitle = 'Untitled deliverable'
    if (mTitle.length > 200) mTitle = mTitle.slice(0, 200)

    const mDueDate = toIsoDateLenient(d.dueDate)
    let mStatus: 'open' | 'delivered' | 'approved' = 'open'
    let mDeliveredAt: string | null = null
    let mApprovedAt: string | null = null

    if (d.status === 'Done' && d.clientSignOff) {
      mStatus = 'approved'
      mDeliveredAt = updatedAt
      mApprovedAt = updatedAt
    } else if (d.status === 'Done') {
      mStatus = 'delivered'
      mDeliveredAt = updatedAt
    } else if (isClosed) {
      // Pending / In Progress, project closed
      mStatus = 'approved'
      mDeliveredAt = updatedAt
      mApprovedAt = updatedAt
    } else {
      // Pending / In Progress, project not closed
      mStatus = 'open'
      tasks.push({
        id: `tsk-${deal.id}-${i}`,
        project_id: projectId,
        milestone_id: mId,
        title: `Finish: ${mTitle}`.slice(0, 500),
        notes: null,
        kind: 'task',
        revision_round: null,
        source_activity_id: null,
        due_date: mDueDate,
        focus_date: null,
        position: 1024,
        completed_at: null,
        created_at: now as any,
        updated_at: updatedAt,
      })
    }

    milestones.push({
      id: mId,
      project_id: projectId,
      title: mTitle,
      position: mPosition,
      due_date: mDueDate,
      amount_minor: null,
      status: mStatus,
      delivered_at: mDeliveredAt,
      approved_at: mApprovedAt,
      created_at: now as any,
      updated_at: updatedAt,
    })
  })

  // Invoices
  const invoices: Insertable<InvoicesTable>[] = []

  rawInvoices.forEach((v, j) => {
    if (!v || typeof v !== 'object') {
      warningsCount++
      return
    }

    const invId = `inv-${deal.id}-${j}`
    let label = typeof v.label === 'string' ? v.label.trim() : ''
    if (!label) {
      label = `${v.type || 'Legacy'} invoice`
    }
    if (label.length > 200) label = label.slice(0, 200)

    let amountMinor = 0
    let notes: string | null = null
    const numAmt = Number(v.amount)
    if (isNaN(numAmt) || numAmt < 0) {
      amountMinor = 0
      notes = 'Amount could not be read'
    } else {
      amountMinor = Math.round(numAmt * 100)
    }

    let status: 'draft' | 'sent' | 'paid' | 'void' = 'draft'
    let issueDate: string | null = null
    let invDueDate: string | null = null
    let paidDate: string | null = null

    const parsedDue = toIsoDateLenient(v.dueDate)
    if (parsedDue) {
      invDueDate = parsedDue
    } else if (v.dueDate && typeof v.dueDate === 'string' && v.dueDate.trim()) {
      const dueNote = `Legacy due: ${v.dueDate.trim()}`
      notes = notes ? `${notes}; ${dueNote}` : dueNote
    }

    const vStatus = v.status
    if (vStatus === 'Paid') {
      status = 'paid'
      paidDate = toIsoDateLenient(v.paidAt) ?? updatedAt.slice(0, 10)
      issueDate = paidDate
    } else if (vStatus === 'Sent') {
      status = 'sent'
      issueDate = updatedAt.slice(0, 10)
    } else if (vStatus === 'Overdue') {
      status = 'sent'
      issueDate = updatedAt.slice(0, 10)
      if (!invDueDate) {
        invDueDate = issueDate
      }
    } else {
      status = 'draft'
    }

    // Payment link: valid http(s) URL and doesn't start with fake Fakturoid qr
    let externalUrl: string | null = null
    if (
      typeof v.paymentLink === 'string' &&
      /^https?:\/\//i.test(v.paymentLink.trim()) &&
      !v.paymentLink.trim().startsWith('https://pay.fakturoid.cz/qr?')
    ) {
      externalUrl = v.paymentLink.trim()
    }

    invoices.push({
      id: invId,
      project_id: projectId,
      milestone_id: null,
      number: null,
      label,
      amount_minor: amountMinor,
      currency: ctx.currency,
      hours: null,
      status,
      issue_date: issueDate,
      due_date: invDueDate,
      paid_date: paidDate,
      external_url: externalUrl,
      notes,
      created_at: now as any,
      updated_at: updatedAt,
    })
  })

  // Brief and warnings
  let brief = deal.notes || ''
  if (warningsCount > 0) {
    const warningBlock = `\n\n---\n**Imported from the old deliverables tracker on ${ctx.today}.** ${warningsCount} item(s) could not be read and were skipped.`
    brief = brief ? `${brief}${warningBlock}` : warningBlock.trim()
  }

  const project: Insertable<ProjectsTable> = {
    id: projectId,
    title: deal.title,
    company: deal.company,
    company_id: deal.company_id,
    deal_id: deal.id,
    contact_name: deal.contact_name,
    contact_email: contactEmail,
    stage_id: stageId,
    billing_type: 'fixed',
    currency: ctx.currency,
    budget_minor: deal.raw_amount > 0 ? Math.round(deal.raw_amount * 100) : null,
    hourly_rate_minor: null,
    estimate_hours: null,
    revisions_included: null,
    start_date: startDate,
    due_date: dueDate,
    waiting_since_date: null,
    health: null,
    brief,
    template_id: null,
    close_outcome: closeOutcome,
    close_reason: null,
    stage_changed_at: updatedAt,
    delivered_at: deliveredAt,
    closed_at: closedAt,
    archived_at: null,
    created_at: now as any,
    updated_at: updatedAt,
  }

  return {
    project,
    milestones,
    tasks,
    invoices,
    dealPatch,
    activity,
  }
}
