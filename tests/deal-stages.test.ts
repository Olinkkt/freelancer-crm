import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEAL_STAGES, OPEN_DEAL_STAGES, PM_STAGES, ACTIVE_PROJECT_STAGES, isPmStage, nextDealStage } from '@/lib/crm-types'
import { ChecklistSchema, DealBackupSchema, DealCreateInputSchema } from '@/lib/validations'
import { buildToday } from '@/components/home/today-list'
import type { Deal } from '@/lib/crm-types'

describe('Deal stages', () => {
  it('pipeline is Lead … Closed, then the PM stages through Completed', () => {
    assert.deepEqual(
      [...DEAL_STAGES],
      ['Lead', 'Qualified', 'Proposal', 'Closed', 'Deposit', 'Materials', 'Build', 'Handoff', 'Revisions', 'Completed']
    )
    assert.deepEqual(OPEN_DEAL_STAGES, ['Lead', 'Qualified', 'Proposal'])
    assert.deepEqual(PM_STAGES, ['Closed', 'Deposit', 'Materials', 'Build', 'Handoff', 'Revisions', 'Completed'])
    assert.ok(!ACTIVE_PROJECT_STAGES.includes('Completed'))
  })

  it('Closed starts PM; nextDealStage walks the pipeline', () => {
    assert.equal(isPmStage('Proposal'), false)
    assert.equal(isPmStage('Closed'), true)
    assert.equal(nextDealStage('Proposal'), 'Closed')
    assert.equal(nextDealStage('Closed'), 'Deposit')
    assert.equal(nextDealStage('Deposit'), 'Materials')
    assert.equal(nextDealStage('Completed'), null)
  })

  it('accepts every pipeline stage and rejects Paid/Lost on create', () => {
    for (const stage of DEAL_STAGES) {
      assert.ok(DealCreateInputSchema.safeParse({ title: 'X', contactName: 'Y', stage }).success, stage)
    }
    for (const stage of ['Paid', 'Lost', 'Discovery', 'Zaloha', 'Won', 'Warranty']) {
      assert.ok(!DealCreateInputSchema.safeParse({ title: 'X', contactName: 'Y', stage }).success, stage)
    }
  })

  it('maps legacy stages when restoring a backup', () => {
    const base = { id: 'd1', title: 'X', contactName: 'Y' }
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Záloha' }).stage, 'Deposit')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Vady' }).stage, 'Completed')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Won' }).stage, 'Closed')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Warranty' }).stage, 'Completed')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Paid' }).stage, 'Closed')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Discovery' }).stage, 'Qualified')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Materials' }).stage, 'Materials')
  })

  it('checklist items need a title and a known section', () => {
    assert.ok(ChecklistSchema.safeParse([{ id: 'a', title: 'Logo', status: 'Done', section: 'podklady' }]).success)
    assert.ok(ChecklistSchema.safeParse([{ id: 'a', title: 'Old item', status: 'Pending' }]).success)
    assert.ok(!ChecklistSchema.safeParse([{ id: 'a', title: '  ', status: 'Done' }]).success)
    assert.ok(!ChecklistSchema.safeParse([{ id: 'a', title: 'X', status: 'Done', section: 'files' }]).success)
  })
})

describe('Today home', () => {
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

  it('groups deals into due, waiting on client and needs you', () => {
    const overdue = deal({ title: 'Overdue', nextDueDate: '2026-11-03' })
    const today = deal({ title: 'Today', nextDueDate: '2026-11-05' })
    const later = deal({ title: 'Later' })
    const waiting = deal({
      title: 'Waiting',
      stage: 'Build',
      deliverables: [
        { id: '1', title: 'Logo', status: 'Pending', section: 'podklady' },
        { id: '2', title: 'Texts', status: 'Done', section: 'podklady' },
      ],
    })
    const allIn = deal({
      title: 'All in',
      stage: 'Build',
      deliverables: [{ id: '1', title: 'Logo', status: 'Done', section: 'podklady' }],
    })
    const noNext = deal({ title: 'No next', next: '', nextDueDate: undefined })

    const g = buildToday([later, today, overdue, waiting, allIn, noNext], [], [], now)
    assert.deepEqual(g.due.map((i) => (i.kind === 'deal' ? i.deal.title : '')), ['Overdue', 'Today'])
    assert.deepEqual(g.waiting.map((i) => (i.kind === 'deal' ? i.deal.title : '')), ['Waiting'])
    assert.match(g.waiting[0].detail, /1 material missing: Logo/)
    assert.deepEqual(g.needsYou.map((i) => (i.kind === 'deal' ? i.deal.title : '')), ['No next'])
  })

  it('a deal in Materials waits on the client even with an empty checklist', () => {
    const g = buildToday([deal({ stage: 'Materials' })], [], [], now)
    assert.equal(g.waiting.length, 1)
  })

  it('shows pending follow-ups due today and hides completed ones', () => {
    const fu = (id: string, time: string) => ({ id, day: 'Later', company: 'Jana', action: 'Ping', time, tone: 'normal' as const })
    const g = buildToday([], [fu('a', '2026-11-05'), fu('b', '2026-11-04'), fu('c', '2026-11-09')], ['b'], now)
    assert.deepEqual(g.due.map((i) => i.key), ['a'])
  })
})
