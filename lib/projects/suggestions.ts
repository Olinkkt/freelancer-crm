import type { Project, Milestone, Invoice, ProjectStage } from './types'

export type Suggestion =
  | { kind: 'start_project'; dealId: string }
  | { kind: 'kick_off'; projectId: string }
  | { kind: 'move_to_review'; projectId: string }
  | { kind: 'back_to_active'; projectId: string }
  | { kind: 'mark_delivered'; projectId: string }
  | { kind: 'create_invoice'; projectId: string; milestoneId: string; amountMinor: number }
  | { kind: 'bill_hours'; projectId: string; milestoneId: string }
  | { kind: 'close_project'; projectId: string }

/**
 * Suggestion toast text mapping per §8.2
 */
export function getSuggestionToastText(
  suggestion: Suggestion,
  context?: { milestoneTitle?: string; formattedAmount?: string }
): string {
  switch (suggestion.kind) {
    case 'start_project':
      return 'Deal won. Start a project?'
    case 'kick_off':
      return 'Payment received. Kick off the project?'
    case 'move_to_review':
      return 'Sent to client. Move to In Review?'
    case 'back_to_active':
      return 'Feedback logged. Back to Active?'
    case 'create_invoice': {
      const title = context?.milestoneTitle ?? ''
      const amount = context?.formattedAmount ?? ''
      return `Approved. Create invoice '${title}' ${amount}?`.trim()
    }
    case 'bill_hours': {
      const title = context?.milestoneTitle ?? ''
      return `Approved. Bill hours for '${title}'?`
    }
    case 'mark_delivered':
      return 'All milestones approved. Mark delivered?'
    case 'close_project':
      return 'All paid. Close the project?'
  }
}

/**
 * S1: Deal Won -> start_project
 */
export function suggestOnDealWon(deal: { id: string; projectId?: string | null }): Suggestion | null {
  if (!deal.projectId) {
    return { kind: 'start_project', dealId: deal.id }
  }
  return null
}

/**
 * S2 / S8: Invoice Paid -> kick_off (if planned) OR close_project (if delivered and no open invoices)
 */
export function suggestOnInvoicePaid(
  project: { id: string },
  stage: { category: string },
  invoices: Array<{ id: string; status: string }>
): Suggestion | null {
  if (stage.category === 'planned') {
    return { kind: 'kick_off', projectId: project.id }
  }

  if (stage.category === 'delivered') {
    const hasUnpaid = invoices.some((inv) => inv.status === 'draft' || inv.status === 'sent')
    if (!hasUnpaid) {
      return { kind: 'close_project', projectId: project.id }
    }
  }

  return null
}

/**
 * S3: Milestone Delivered -> move_to_review (if category is active)
 */
export function suggestOnMilestoneDelivered(
  project: { id: string },
  stage: { category: string }
): Suggestion | null {
  if (stage.category === 'active') {
    return { kind: 'move_to_review', projectId: project.id }
  }
  return null
}

/**
 * S4: Feedback logged -> back_to_active (if category is review)
 */
export function suggestOnFeedbackLogged(
  project: { id: string },
  stage: { category: string }
): Suggestion | null {
  if (stage.category === 'review') {
    return { kind: 'back_to_active', projectId: project.id }
  }
  return null
}

/**
 * S5 / S6 / S7: Milestone Approved -> create_invoice, bill_hours, or mark_delivered
 * Follows table order strictly:
 * 1. create_invoice (fixed or retainer, amountMinor > 0, no non-void invoice for this milestone)
 * 2. bill_hours (hourly, no non-void invoice for this milestone)
 * 3. mark_delivered (all milestones approved, category active or review)
 */
export function suggestOnMilestoneApproved(
  project: { id: string; billingType: string },
  stage: { category: string },
  milestone: { id: string; amountMinor?: number | null },
  allMilestones: Array<{ id: string; status: string }>,
  existingInvoices: Array<{ milestoneId?: string | null; status: string }>
): Suggestion | null {
  const milestoneInvoiced = existingInvoices.some(
    (inv) => inv.milestoneId === milestone.id && inv.status !== 'void'
  )

  // 1. create_invoice
  if (
    (project.billingType === 'fixed' || project.billingType === 'retainer') &&
    milestone.amountMinor &&
    milestone.amountMinor > 0 &&
    !milestoneInvoiced
  ) {
    return {
      kind: 'create_invoice',
      projectId: project.id,
      milestoneId: milestone.id,
      amountMinor: milestone.amountMinor,
    }
  }

  // 2. bill_hours
  if (project.billingType === 'hourly' && !milestoneInvoiced) {
    return {
      kind: 'bill_hours',
      projectId: project.id,
      milestoneId: milestone.id,
    }
  }

  // 3. mark_delivered
  const allApproved =
    allMilestones.length > 0 &&
    allMilestones.every((m) => m.status === 'approved' || m.id === milestone.id)
  if (allApproved && (stage.category === 'active' || stage.category === 'review')) {
    return {
      kind: 'mark_delivered',
      projectId: project.id,
    }
  }

  return null
}
