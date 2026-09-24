import { Generated } from 'kysely'

export interface CompanyTable {
  id: string
  name: string
  type: string
  contact: string
  email: string
  deals: number
  value: string
  status: 'Active' | 'Prospect' | 'Inactive'
  color: 'blue' | 'violet' | 'amber' | 'green'
  created_at: string
  updated_at: string
}

export interface ContactTable {
  id: string
  name: string
  role: string
  company: string
  company_id: string | null
  email: string
  phone: string | null
  deals: number
  last_touch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  created_at: string
  updated_at: string
}

export interface DealTable {
  id: string
  title: string
  company: string
  company_id: string | null
  value: string
  raw_amount: number
  stage: string
  probability: string
  next: string
  next_due_date: string | null
  color: string
  contact_name: string | null
  contact_email: string | null
  notes: string | null
  start_date: string | null
  end_date: string | null
  deliverables: string | null // JSON stringified DeliverableItem[]
  invoices: string | null // JSON stringified InvoiceMilestone[]
  created_at: string
  updated_at: string
}

export interface ActivityTable {
  id: string
  deal_id: string | null
  type: string
  title: string
  person: string
  company: string
  date: string
  status: string
  color: string
  summary: string | null
  created_at: string
}

export interface FollowUpTable {
  id: string
  deal_id: string | null
  day: string
  company: string
  action: string
  time: string
  tone: string
  completed: number // 0 or 1
  created_at: string
}

export interface Database {
  companies: CompanyTable
  contacts: ContactTable
  deals: DealTable
  activities: ActivityTable
  follow_ups: FollowUpTable
}
