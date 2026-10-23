import { ColumnType } from 'kysely'
import type {
  StageCategory,
  BillingType,
  MilestoneStatus,
  TaskKind,
  InvoiceStatus,
  ProjectHealth,
  CloseOutcome,
  PaymentSchedule,
} from '@/lib/projects/constants'

export type IsoDate = string // 'YYYY-MM-DD'
export type IsoTimestamp = string // Date#toISOString()
type CreatedAt = ColumnType<IsoTimestamp, IsoTimestamp, never>

export type CompanyTable = CompanyTableDef
export type ContactTable = ContactTableDef
export type DealTable = DealsTable
export type ActivityTable = ActivitiesTable
export type FollowUpTable = FollowUpTableDef

export interface CompanyTableDef {
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

export interface ContactTableDef {
  id: string
  name: string
  role: string | null
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

export interface DealsTable {
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
  /** @deprecated legacy, read only by migration 003; never written */
  deliverables: string | null // JSON stringified DeliverableItem[]
  /** @deprecated legacy, read only by migration 003; never written */
  invoices: string | null // JSON stringified InvoiceMilestone[]
  created_at: string
  updated_at: string
}

export interface ActivitiesTable {
  id: string
  deal_id: string | null
  project_id: string | null
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

export interface FollowUpTableDef {
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
  invoice_net_days: number // default 14
  last_weekly_review_at: IsoTimestamp | null
  shortcut_overrides: string // JSON ShortcutOverrides, default '{}'
  created_at: string
  updated_at: string
}

export interface GoogleCalendarIntegrationTable {
  id: string
  access_token: string
  refresh_token: string | null
  token_expiry: number
  calendar_id: string
  calendar_name: string
  auto_sync: number // 0 or 1
  last_synced_at: string | null
  created_at: string
  updated_at: string
}

export interface GoogleCalendarEventTable {
  id: string
  crm_type: string
  crm_id: string
  google_event_id: string
  synced_at: string
}

export interface SchemaMigrationsTable {
  version: number
  name: string
  applied_at: IsoTimestamp
}

export interface ProjectStagesTable {
  id: string
  name: string
  category: StageCategory
  position: number
  color: string
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface ProjectsTable {
  id: string
  title: string
  company: string
  company_id: string | null
  deal_id: string | null
  contact_name: string | null
  contact_email: string | null
  stage_id: string
  billing_type: BillingType
  currency: string
  budget_minor: number | null
  hourly_rate_minor: number | null
  estimate_hours: number | null
  revisions_included: number | null
  start_date: IsoDate | null
  due_date: IsoDate | null
  waiting_since_date: IsoDate | null
  health: ProjectHealth | null
  brief: string
  template_id: string | null
  close_outcome: CloseOutcome | null
  close_reason: string | null
  stage_changed_at: IsoTimestamp
  delivered_at: IsoTimestamp | null
  closed_at: IsoTimestamp | null
  archived_at: IsoTimestamp | null
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface ProjectMilestonesTable {
  id: string
  project_id: string
  title: string
  position: number
  due_date: IsoDate | null
  amount_minor: number | null
  status: MilestoneStatus
  delivered_at: IsoTimestamp | null
  approved_at: IsoTimestamp | null
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface ProjectTasksTable {
  id: string
  project_id: string
  milestone_id: string | null
  title: string
  notes: string | null
  kind: TaskKind
  revision_round: number | null
  source_activity_id: string | null
  due_date: IsoDate | null
  focus_date: IsoDate | null
  position: number
  completed_at: IsoTimestamp | null
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface InvoicesTable {
  id: string
  project_id: string
  milestone_id: string | null
  number: string | null
  label: string
  amount_minor: number
  currency: string
  hours: number | null
  status: InvoiceStatus
  issue_date: IsoDate | null
  due_date: IsoDate | null
  paid_date: IsoDate | null
  external_url: string | null
  notes: string | null
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface ProjectTemplatesTable {
  id: string
  name: string
  billing_type: BillingType
  payment_schedule: PaymentSchedule
  duration_days: number | null
  revisions_included: number | null
  milestones_json: string // JSON TemplateMilestone[] (zod: templateMilestoneSchema)
  tasks_json: string // JSON TemplateTask[] (zod: templateTaskSchema)
  is_builtin: number // 0 | 1
  position: number
  created_at: CreatedAt
  updated_at: IsoTimestamp
}

export interface Database {
  companies: CompanyTable
  contacts: ContactTable
  deals: DealTable
  activities: ActivityTable
  follow_ups: FollowUpTable
  workspace_settings: WorkspaceSettingsTable
  google_calendar_integrations: GoogleCalendarIntegrationTable
  google_calendar_events: GoogleCalendarEventTable
  schema_migrations: SchemaMigrationsTable
  project_stages: ProjectStagesTable
  projects: ProjectsTable
  project_milestones: ProjectMilestonesTable
  project_tasks: ProjectTasksTable
  invoices: InvoicesTable
  project_templates: ProjectTemplatesTable
}
