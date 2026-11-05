export interface ContactTable {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  deals: number
  last_touch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  created_at: string
  updated_at: string
}

export interface DealTable {
  id: string
  title: string
  value: string
  raw_amount: number
  stage: string
  next: string
  next_due_date: string | null
  waiting: number
  waiting_since: string | null
  color: string
  contact_id: string | null
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

export interface WorkspaceSettingsTable {
  id: string
  operator_name: string
  operator_email: string
  operator_role: string
  currency: string
  currency_symbol: string
  locale: string
  passcode_hash: string | null
  is_claimed: number // 0 or 1
  calendar_feed_token?: string | null
  created_at: string
  updated_at: string
}

export interface Database {
  contacts: ContactTable
  deals: DealTable
  follow_ups: FollowUpTable
  workspace_settings: WorkspaceSettingsTable
}
