export const STAGE_CATEGORIES = ['planned', 'active', 'review', 'delivered', 'closed'] as const
export const BILLING_TYPES = ['fixed', 'hourly', 'retainer'] as const
export const MILESTONE_STATUSES = ['open', 'delivered', 'approved'] as const
export const TASK_KINDS = ['task', 'revision'] as const
export const INVOICE_STATUSES = ['draft', 'sent', 'paid', 'void'] as const
export const PROJECT_HEALTH = ['on_track', 'at_risk', 'blocked'] as const
export const CLOSE_OUTCOMES = ['completed', 'cancelled'] as const
export const PAYMENT_SCHEDULES = ['none', 'upfront_100', 'split_50_50', 'split_30_40_30', 'per_milestone', 'monthly'] as const
export const FEEDBACK_SOURCES = ['Email', 'Call', 'Meeting', 'Note'] as const // existing activity types

export type StageCategory = (typeof STAGE_CATEGORIES)[number]
export type BillingType = (typeof BILLING_TYPES)[number]
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
export type TaskKind = (typeof TASK_KINDS)[number]
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number]
export type ProjectHealth = (typeof PROJECT_HEALTH)[number]
export type CloseOutcome = (typeof CLOSE_OUTCOMES)[number]
export type PaymentSchedule = (typeof PAYMENT_SCHEDULES)[number]
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number]

export const DEAL_STAGES = ['Lead', 'Qualified', 'Proposal', 'Won'] as const // 'Paid' removed (D1)
export const MAX_MINOR = 2_000_000_000
export const POSITION_STEP = 1024
