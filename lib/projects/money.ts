import { formatMoney } from '@/lib/config'
import type { WorkspaceSettings } from '@/lib/crm-types'
import type { PaymentSchedule } from './constants'

export function toMinor(major: number): number {
  return Math.round(major * 100)
}

export function fromMinor(minor: number): number {
  return minor / 100
}

export function parseMoneyInput(val: string | number): number {
  if (typeof val === 'number') return toMinor(val)
  const normalized = String(val).replace(/\s/g, '').replace(',', '.')
  const num = parseFloat(normalized)
  return isNaN(num) ? 0 : toMinor(num)
}

export function formatMinor(
  minor: number,
  currency: string,
  settings?: { currency: string; currencySymbol: string; locale: string }
): string {
  if (settings && currency === settings.currency) {
    return formatMoney(fromMinor(minor), settings as any)
  }
  const locale = settings?.locale || 'en-US'
  try {
    return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(fromMinor(minor))
  } catch {
    return `${currency} ${fromMinor(minor).toFixed(2)}`
  }
}

export function isOverdue(
  inv: { status: string; due_date?: string | null; dueDate?: string | null },
  today: string
): boolean {
  const status = inv.status
  const dueDate = inv.due_date !== undefined ? inv.due_date : inv.dueDate
  return status === 'sent' && !!dueDate && dueDate < today
}

export interface ProjectMoneyCalculation {
  budgetMinor: number | null
  invoicedMinor: number
  paidMinor: number
  outstandingMinor: number
  draftMinor: number
  billedHours: number
  currency: string
}

export function projectMoney(
  project: { budget_minor?: number | null; budgetMinor?: number | null; currency: string },
  invoices: Array<{
    amount_minor?: number | null
    amountMinor?: number | null
    status: string
    hours?: number | null
  }>
): ProjectMoneyCalculation {
  const budgetMinor = project.budget_minor !== undefined ? project.budget_minor : project.budgetMinor ?? null
  const currency = project.currency

  let invoicedMinor = 0
  let paidMinor = 0
  let outstandingMinor = 0
  let draftMinor = 0
  let billedHours = 0

  for (const inv of invoices) {
    const amt = (inv.amount_minor !== undefined ? inv.amount_minor : inv.amountMinor) || 0
    const status = inv.status
    const hours = Number(inv.hours) || 0

    if (status !== 'void') {
      billedHours += hours
    }

    if (status === 'draft') {
      draftMinor += amt
    } else if (status === 'sent') {
      invoicedMinor += amt
      outstandingMinor += amt
    } else if (status === 'paid') {
      invoicedMinor += amt
      paidMinor += amt
    }
  }

  return {
    budgetMinor: budgetMinor ?? null,
    invoicedMinor,
    paidMinor,
    outstandingMinor,
    draftMinor,
    billedHours,
    currency,
  }
}

export interface ScheduledInvoiceDraft {
  label: string
  amountMinor: number
  milestoneIndex?: number | null
}

export function scheduleInvoices(
  schedule: PaymentSchedule,
  budgetMinor: number | null,
  milestones: Array<{ title: string; amountPct?: number | null }> = [],
  startDate?: string
): ScheduledInvoiceDraft[] {
  if (!budgetMinor || budgetMinor <= 0) return []

  switch (schedule) {
    case 'none':
    case 'per_milestone':
      return []

    case 'upfront_100':
      return [{ label: 'Full payment', amountMinor: budgetMinor }]

    case 'split_50_50': {
      const first = Math.round(budgetMinor * 0.5)
      const second = budgetMinor - first
      return [
        { label: 'Deposit 50 %', amountMinor: first },
        { label: 'Final 50 %', amountMinor: second },
      ]
    }

    case 'split_30_40_30': {
      const first = Math.round(budgetMinor * 0.3)
      const second = Math.round(budgetMinor * 0.4)
      const third = budgetMinor - first - second
      return [
        { label: 'Deposit 30 %', amountMinor: first },
        { label: 'Progress 40 %', amountMinor: second },
        { label: 'Final 30 %', amountMinor: third },
      ]
    }

    case 'monthly': {
      let monthLabel = 'Monthly'
      if (startDate && /^\d{4}-\d{2}-\d{2}/.test(startDate)) {
        const [y, m, d] = startDate.split('-').map(Number)
        const dt = new Date(Date.UTC(y, m - 1, d))
        monthLabel = dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
      }
      return [{ label: `${monthLabel} retainer`, amountMinor: budgetMinor }]
    }

    default:
      return []
  }
}
