export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Proposal'
  | 'Won'
  | 'Paid'

/** Pipeline stages in board order — the single source for columns, pickers and counts */
export const DEAL_STAGES: DealStage[] = ['Lead', 'Qualified', 'Proposal', 'Won', 'Paid']

/** Stages a deal is still being won in (Won/Paid are closed) */
export const OPEN_DEAL_STAGES: DealStage[] = DEAL_STAGES.filter((s) => s !== 'Won' && s !== 'Paid')

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
  formattedAmount: string
  percentage: number
  status: 'Draft' | 'Sent' | 'Paid' | 'Overdue'
  dueDate?: string
  paidAt?: string
  paymentLink?: string
}

export interface Deal {
  id: string
  title: string
  value: string
  rawAmount: number
  stage: DealStage
  next: string
  nextDueDate?: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  /** The client (person) this deal belongs to */
  contactId?: string
  contactName: string
  contactEmail?: string
  notes?: string
  createdAt?: string
  startDate?: string
  endDate?: string
  deliverables?: DeliverableItem[]
  invoices?: InvoiceMilestone[]
}

export interface Contact {
  id: string
  name: string
  email: string
  phone?: string
  notes?: string
  deals: number
  lastTouch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
}

export interface Activity {
  id: string
  dealId?: string
  type: 'Call' | 'Meeting' | 'Email' | 'Follow-up' | 'Note'
  title: string
  person: string
  company: string
  date: string
  status: 'Due today' | 'Upcoming' | 'Completed'
  color: 'blue' | 'violet' | 'amber' | 'green'
  summary?: string
  notes?: string
  dueDate?: string
  createdAt?: string
}

export interface FollowUpItem {
  id: string
  day: 'Today' | 'Tomorrow' | 'This week' | 'Next week' | 'Later' | string
  company: string
  action: string
  time: string
  tone: 'urgent' | 'normal'
  completed?: boolean
}

export interface WorkspaceSettings {
  operatorName: string
  operatorEmail: string
  operatorRole: string
  currency: string
  currencySymbol: string
  locale: string
  isClaimed: boolean
  calendarFeedToken?: string
  updatedAt?: string
}

export interface WorkspaceData {
  deals: Deal[]
  contacts: Contact[]
  activities: Activity[]
  followUps: FollowUpItem[]
  settings?: WorkspaceSettings
}

