export type DealStage =
  | 'Lead'
  | 'Qualified'
  | 'Scope'
  | 'Quote sent'
  | 'Negotiation'
  | 'Won'

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
}

export interface Deal {
  id: string
  title: string
  company: string
  value: string
  rawAmount: number
  stage: DealStage
  probability: string
  next: string
  nextDueDate?: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  contactName?: string
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
  role: string
  company: string
  email: string
  phone?: string
  deals: number
  lastTouch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
}

export interface Company {
  id: string
  name: string
  type: string
  contact: string
  email: string
  deals: number
  value: string
  status: 'Active' | 'Prospect' | 'Inactive'
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
}

export interface FollowUpItem {
  id: string
  day: 'Today' | 'Tomorrow' | 'This week' | 'Later'
  company: string
  action: string
  time: string
  tone: 'urgent' | 'normal'
  completed?: boolean
}

export interface WorkspaceData {
  deals: Deal[]
  companies: Company[]
  contacts: Contact[]
  activities: Activity[]
  followUps: FollowUpItem[]
}

