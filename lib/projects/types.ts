export * from './constants'
export * from './dates'
export * from './money'
export * from './legacy'

export interface ProjectMoney {
  budgetMinor: number | null
  invoicedMinor: number
  paidMinor: number
  outstandingMinor: number
  draftMinor: number
  billedHours: number
  currency: string
}

export interface ProjectCard {
  project: Project
  stage: ProjectStage
  openTasks: number
  doneTasks: number
  overdueTasks: number
  nextTask: Pick<Task, 'id' | 'title' | 'dueDate' | 'focusDate'> | null
  currentMilestone: Pick<Milestone, 'id' | 'title' | 'dueDate'> | null // first non-approved by position
  money: ProjectMoney
  waitingDays: number | null
  needsNextStep: boolean
  revisionRound: number | null
  hasOverdueInvoice: boolean
}

export interface ProjectDetail {
  project: Project
  stages: ProjectStage[]
  milestones: Milestone[]
  tasks: Task[]
  invoices: Invoice[]
  activities: any[] // project_id = id OR deal_id = project.dealId, newest 20
  deal: { id: string; title: string; stage: string } | null
  money: ProjectMoney
  card: ProjectCard
}

export type TodayItem =
  | {
      type: 'task'
      task: Task
      project: Pick<Project, 'id' | 'title' | 'company'>
      milestoneTitle: string | null
      fromDate: string | null
    }
  | { type: 'project'; card: ProjectCard }
  | {
      type: 'invoice'
      invoice: Invoice
      project: Pick<Project, 'id' | 'title' | 'company'>
      overdueDays: number | null
    }
  | { type: 'followUp'; followUp: any }
  | {
      type: 'startProject'
      deal: { id: string; title: string; company: string; rawAmount: number }
    }

export interface TodayData {
  today: string
  sections: {
    id: 'overdue' | 'dueToday' | 'focus' | 'nextStep' | 'waiting' | 'money' | 'sales'
    items: TodayItem[]
  }[]
  badgeCount: number
}

// CamelCase mirrors of DB schema
export interface Project {
  id: string
  title: string
  company: string
  companyId: string | null
  dealId: string | null
  contactName: string | null
  contactEmail: string | null
  stageId: string
  billingType: 'fixed' | 'hourly' | 'retainer'
  currency: string
  budgetMinor: number | null
  hourlyRateMinor: number | null
  estimateHours: number | null
  revisionsIncluded: number | null
  startDate: string | null
  dueDate: string | null
  waitingSinceDate: string | null
  health: 'on_track' | 'at_risk' | 'blocked' | null
  brief: string
  templateId: string | null
  closeOutcome: 'completed' | 'cancelled' | null
  closeReason: string | null
  stageChangedAt: string
  deliveredAt: string | null
  closedAt: string | null
  archivedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectStage {
  id: string
  name: string
  category: 'planned' | 'active' | 'review' | 'delivered' | 'closed'
  position: number
  color: string
  createdAt: string
  updatedAt: string
}

export interface Milestone {
  id: string
  projectId: string
  title: string
  position: number
  dueDate: string | null
  amountMinor: number | null
  status: 'open' | 'delivered' | 'approved'
  deliveredAt: string | null
  approvedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Task {
  id: string
  projectId: string
  milestoneId: string | null
  title: string
  notes: string | null
  kind: 'task' | 'revision'
  revisionRound: number | null
  sourceActivityId: string | null
  dueDate: string | null
  focusDate: string | null
  position: number
  completedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface Invoice {
  id: string
  projectId: string
  milestoneId: string | null
  number: string | null
  label: string
  amountMinor: number
  currency: string
  hours: number | null
  status: 'draft' | 'sent' | 'paid' | 'void'
  issueDate: string | null
  dueDate: string | null
  paidDate: string | null
  externalUrl: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
}

export interface ProjectTemplate {
  id: string
  name: string
  billingType: 'fixed' | 'hourly' | 'retainer'
  paymentSchedule: 'none' | 'upfront_100' | 'split_50_50' | 'split_30_40_30' | 'per_milestone' | 'monthly'
  durationDays: number | null
  revisionsIncluded: number | null
  milestones: Array<{ title: string; offsetDays: number; amountPct: number | null }>
  tasks: Array<{ title: string; milestoneIndex: number | null; offsetDays: number | null }>
  isBuiltin: boolean
  position: number
  createdAt: string
  updatedAt: string
}
