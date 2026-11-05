import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildOverview } from '@/components/home/home-overview'
import type { Deal } from '@/lib/crm-types'

describe('Home overview', () => {
  const now = new Date(2026, 10, 5) // 2026-11-05
  const deal = (over: Partial<Deal>): Deal => ({
    id: Math.random().toString(36).slice(2),
    title: 'Site',
    value: '0',
    rawAmount: 0,
    stage: 'Lead',
    next: 'Call',
    nextDueDate: '2026-11-20',
    color: 'blue',
    contactName: 'Jana',
    ...over,
  })
  const inv = (status: 'Draft' | 'Sent' | 'Paid' | 'Overdue', amount: number, dueDate?: string) => ({
    id: Math.random().toString(36).slice(2),
    type: 'Final' as const,
    label: 'Final',
    amount,
    formattedAmount: String(amount),
    percentage: 50,
    status,
    dueDate,
  })

  it('sums open pipeline over Lead, Qualified and Proposal only', () => {
    const o = buildOverview(
      [deal({ stage: 'Lead', rawAmount: 100 }), deal({ stage: 'Proposal', rawAmount: 50 }), deal({ stage: 'Build', rawAmount: 999 })],
      now
    )
    assert.equal(o.openCount, 2)
    assert.equal(o.pipelineValue, 150)
    assert.equal(o.activeProjects, 1)
  })

  it('collects only sent or overdue invoices of active projects', () => {
    const o = buildOverview(
      [
        deal({ stage: 'Build', invoices: [inv('Sent', 200, '2026-11-01'), inv('Paid', 500), inv('Draft', 70), inv('Sent', 30, '2026-12-01')] }),
        deal({ stage: 'Completed', invoices: [inv('Sent', 9999)] }),
      ],
      now
    )
    assert.equal(o.toCollect, 230)
    assert.equal(o.invoicesOpen, 2)
    assert.equal(o.invoicesOverdue, 1)
  })

  it('splits stages into Sales and Delivery in pipeline order', () => {
    const o = buildOverview([deal({ stage: 'Qualified', rawAmount: 10 })], now)
    assert.equal(o.stages.length, 10)
    assert.deepEqual(o.stages.filter((s) => s.group === 'Sales').map((s) => s.stage), ['Lead', 'Qualified', 'Proposal'])
    assert.equal(o.stages[1].count, 1)
    assert.equal(o.stages[1].amount, 10)
  })
})
