interface ContactTable {
  id: string
  name: string
  email: string
  phone: string | null
  notes: string | null
  deals: number
  last_touch: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  /** Id of the matching client in the Invoicer, set by the one-way sync */
  invoicer_client_id?: string | null
  created_at: string
  updated_at: string
}

interface DealTable {
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

interface FollowUpTable {
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

interface WorkspaceSettingsTable {
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

interface ApiTokenTable {
  id: string
  name: string
  token_hash: string
  /** First characters of the token, safe to display */
  prefix: string
  /** Comma-separated: 'read' or 'read,write' */
  scopes: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}

/** Every write made through an API token or MCP (no UI yet) */
interface ApiAuditLogTable {
  id: string
  at: string
  token_id: string | null
  via: string // 'rest' | 'mcp'
  operation: string
  entity_type: string | null
  entity_id: string | null
  before: string | null // JSON
  after: string | null // JSON
  dry_run: number // 0 or 1
  idempotency_key: string | null
  response: string | null // JSON, replayed for idempotent retries
}

/** One row ('default'): where the Invoicer lives and the token to push clients with */
interface InvoicerLinkTable {
  id: string
  url: string
  token: string
  connected_at: string
  last_sync_at: string | null
  last_error: string | null
}

export interface Database {
  contacts: ContactTable
  deals: DealTable
  follow_ups: FollowUpTable
  workspace_settings: WorkspaceSettingsTable
  api_tokens: ApiTokenTable
  api_audit_log: ApiAuditLogTable
  invoicer_link: InvoicerLinkTable
}
