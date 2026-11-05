import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildProjects } from '@/components/home/projects-overview'
import type { Deal } from '@/lib/crm-types'

describe('Projects overview', () => {
  const now = new Date(2026, 10, 5) // 2026-11-05
  const deal = (over: Partial<Deal>): Deal => ({
    id: Math.random().toString(36).slice(2),
    title: 'Site',
    value: '0',
    rawAmount: 0,
    stage: 'Build',
    next: 'Share preview',
    nextDueDate: '2026-11-20',
    color: 'blue',
    contactName: 'Jana',
    ...over,
  })

  it('lists only projects being delivered', () => {
    const rows = buildProjects(
      [deal({ stage: 'Lead' }), deal({ stage: 'Proposal' }), deal({ stage: 'Completed' }), deal({ stage: 'Closed' }), deal({ stage: 'Revisions' })],
      now
    )
    assert.deepEqual(rows.map((r) => r.deal.stage).sort(), ['Closed', 'Revisions'])
  })

  it('sorts alerts first, then soonest date, waiting on client last', () => {
    const soon = deal({ title: 'Soon', nextDueDate: '2026-11-07' })
    const later = deal({ title: 'Later', nextDueDate: '2026-11-25' })
    const late = deal({ title: 'Late', nextDueDate: '2026-11-01' })
    const waiting = deal({ title: 'Waiting', waiting: true, nextDueDate: undefined })
    const rows = buildProjects([waiting, later, soon, late], now)
    assert.deepEqual(rows.map((r) => r.deal.title), ['Late', 'Soon', 'Later', 'Waiting'])
    assert.equal(rows[0].flag, 'late')
    assert.equal(rows[3].flag, 'waiting')
  })

  it('counts tasks without client materials and flags blocked cards', () => {
    const d = deal({
      deliverables: [
        { id: '1', title: 'A', status: 'Done' },
        { id: '2', title: 'B', status: 'Pending', column: 'blocked' },
        { id: '3', title: 'C', status: 'Pending', section: 'podklady' },
      ],
    })
    const [row] = buildProjects([d], now)
    assert.equal(row.tasksTotal, 2)
    assert.equal(row.tasksDone, 1)
    assert.equal(row.flag, 'blocked')
  })

  it('flags an overdue invoice', () => {
    const d = deal({
      invoices: [{ id: 'i', type: 'Final', label: 'Final', amount: 1, formattedAmount: '1', percentage: 50, status: 'Sent', dueDate: '2026-11-01' }],
    })
    assert.equal(buildProjects([d], now)[0].flag, 'invoice')
  })
})
