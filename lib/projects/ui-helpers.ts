import type { Task, Milestone, Invoice } from '@/lib/projects/types'
import type { Suggestion } from '@/lib/projects/suggestions'

export interface TaskGroup {
  milestone: Milestone | null
  tasks: Task[]
}

/**
 * Returns formatted round label, e.g. "Round 1 of 2" or "Round 1".
 */
export function revisionRoundLabel(round: number, totalIncluded?: number | null): string {
  if (totalIncluded != null && totalIncluded > 0) {
    return `Round ${round} of ${totalIncluded}`
  }
  return `Round ${round}`
}

export function isRoundOverScope(round: number, totalIncluded?: number | null): boolean {
  return totalIncluded != null && totalIncluded > 0 && round > totalIncluded
}

/**
 * Groups tasks by milestone sorted by milestone position ascending,
 * followed by tasks with no milestone.
 */
export function groupTasksByMilestone(tasks: Task[], milestones: Milestone[]): TaskGroup[] {
  const sortedMilestones = [...milestones].sort((a, b) => a.position - b.position)
  const milestoneMap = new Map<string, Task[]>()
  for (const m of sortedMilestones) {
    milestoneMap.set(m.id, [])
  }
  const noMilestoneTasks: Task[] = []

  const sortedTasks = [...tasks].sort((a, b) => a.position - b.position)
  for (const t of sortedTasks) {
    if (t.milestoneId && milestoneMap.has(t.milestoneId)) {
      milestoneMap.get(t.milestoneId)!.push(t)
    } else {
      noMilestoneTasks.push(t)
    }
  }

  const groups: TaskGroup[] = sortedMilestones.map((m) => ({
    milestone: m,
    tasks: milestoneMap.get(m.id) || [],
  }))

  groups.push({
    milestone: null,
    tasks: noMilestoneTasks,
  })

  return groups
}

export interface SuggestionCallbacks {
  onStartProject?: (dealId: string) => void
  onKickOff?: (projectId: string) => void
  onMoveToReview?: (projectId: string) => void
  onBackToActive?: (projectId: string) => void
  onCreateInvoice?: (projectId: string, milestoneId: string, amountMinor: number) => void
  onBillHours?: (projectId: string, milestoneId: string) => void
  onMarkDelivered?: (projectId: string) => void
  onCloseProject?: (projectId: string) => void
}

export interface ToastSuggestionResult {
  message: string
  shortcut: 'Y'
  durationMs: number
  action: {
    label: string
    onRun: () => void
    kind: 'accept'
  }
}

/**
 * Maps a server action or domain suggestion to a HUD toast with 'Y' shortcut.
 */
export function suggestionToToast(
  suggestion: Suggestion,
  callbacks: SuggestionCallbacks = {},
  formatAmount?: (minor: number) => string
): ToastSuggestionResult {
  let message = ''
  let onRun = () => {}

  switch (suggestion.kind) {
    case 'start_project':
      message = 'Deal won. Start a project?'
      onRun = () => callbacks.onStartProject?.(suggestion.dealId)
      break
    case 'kick_off':
      message = 'Payment received. Kick off the project?'
      onRun = () => callbacks.onKickOff?.(suggestion.projectId)
      break
    case 'move_to_review':
      message = 'Sent to client. Move to In Review?'
      onRun = () => callbacks.onMoveToReview?.(suggestion.projectId)
      break
    case 'back_to_active':
      message = 'Feedback logged. Back to Active?'
      onRun = () => callbacks.onBackToActive?.(suggestion.projectId)
      break
    case 'create_invoice': {
      const amt = formatAmount ? formatAmount(suggestion.amountMinor) : `${suggestion.amountMinor / 100}`
      message = `Approved. Create invoice?`
      onRun = () => callbacks.onCreateInvoice?.(suggestion.projectId, suggestion.milestoneId, suggestion.amountMinor)
      break
    }
    case 'bill_hours':
      message = 'Approved. Bill hours?'
      onRun = () => callbacks.onBillHours?.(suggestion.projectId, suggestion.milestoneId)
      break
    case 'mark_delivered':
      message = 'All milestones approved. Mark delivered?'
      onRun = () => callbacks.onMarkDelivered?.(suggestion.projectId)
      break
    case 'close_project':
      message = 'All paid. Close the project?'
      onRun = () => callbacks.onCloseProject?.(suggestion.projectId)
      break
  }

  return {
    message,
    shortcut: 'Y',
    durationMs: 8000,
    action: {
      label: 'Accept',
      onRun,
      kind: 'accept',
    },
  }
}

export interface BuildCloseProjectOptions {
  projectId: string
  outcome: 'completed' | 'cancelled'
  reason?: string | null
  unpaidInvoices: Invoice[]
  paidInvoiceIds: string[]
  unpaidResolution: 'none' | 'leave_open' | 'void_open'
  openTasks: 'keep' | 'complete' | 'delete'
  followUps: {
    testimonial: boolean
    retainer: boolean
    checkIn: boolean
  }
  saveAsTemplateName?: string | null
  archive?: boolean
  today: string
}

export function buildCloseProjectInput(options: BuildCloseProjectOptions) {
  const remainingUnpaid = options.unpaidInvoices.filter(
    (inv) => !options.paidInvoiceIds.includes(inv.id)
  )
  const invoiceResolution = remainingUnpaid.length === 0 ? 'none' : options.unpaidResolution

  return {
    id: options.projectId,
    outcome: options.outcome,
    reason: options.outcome === 'cancelled' ? options.reason || 'Cancelled' : null,
    invoiceResolution,
    markPaidInvoiceIds: options.paidInvoiceIds,
    openTasks: options.openTasks,
    followUps: options.followUps,
    saveAsTemplateName: options.saveAsTemplateName?.trim() || null,
    archive: !!options.archive,
    today: options.today,
  }
}

export function applyOptimisticToggle(
  tasks: Task[],
  taskId: string,
  done: boolean,
  now = new Date().toISOString()
): { updatedTasks: Task[]; previousTask: Task | null } {
  const previous = tasks.find((t) => t.id === taskId) ?? null
  if (!previous) return { updatedTasks: tasks, previousTask: null }
  const updatedTasks = tasks.map((t) =>
    t.id === taskId
      ? { ...t, completedAt: done ? t.completedAt || now : null, updatedAt: now }
      : t
  )
  return { updatedTasks, previousTask: previous }
}

export function rollbackToggle(tasks: Task[], previousTask: Task): Task[] {
  return tasks.map((t) => (t.id === previousTask.id ? previousTask : t))
}
