import test from 'node:test'
import assert from 'node:assert/strict'
import { planStageChange } from '@/lib/projects/stage-machine'
import type { ProjectStage } from '@/lib/projects/types'

const stage = (id: string, category: ProjectStage['category']): ProjectStage => ({
  id,
  name: id,
  category,
  position: 1,
  color: 'blue',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
})

const plannedStage = stage('stg-planned', 'planned')
const activeStage = stage('stg-active', 'active')
const reviewStage = stage('stg-review', 'review')
const deliveredStage = stage('stg-delivered', 'delivered')
const closedStage = stage('stg-closed', 'closed')

const now = '2026-10-24T12:00:00.000Z'
const today = '2026-10-24'

test('Project Stage State Machine (§8.1)', async (t) => {
  await t.test('same-category transition: always allowed, sets stage_id and timestamps', () => {
    const activeStage2 = stage('stg-active-2', 'active')
    const p = { id: 'prj-1', waitingSinceDate: '2026-10-20', deliveredAt: null }
    const plan = planStageChange(p, activeStage, activeStage2, now, today)

    assert.equal(plan.ok, true)
    if (plan.ok) {
      assert.equal(plan.patch.stage_id, activeStage2.id)
      assert.equal(plan.patch.stage_changed_at, now)
      assert.equal(plan.patch.updated_at, now)
      assert.equal(plan.patch.waiting_since_date, undefined)
      assert.equal(plan.patch.delivered_at, undefined)
    }
  })

  await t.test('T2: planned -> active allowed with no extra side effects', () => {
    const p = { id: 'prj-1' }
    const plan = planStageChange(p, plannedStage, activeStage, now, today)

    assert.equal(plan.ok, true)
    if (plan.ok) {
      assert.equal(plan.patch.stage_id, activeStage.id)
      assert.equal(plan.patch.stage_changed_at, now)
      assert.equal(plan.patch.waiting_since_date, undefined)
    }
  })

  await t.test('T3: active -> review sets waiting_since_date = today if null', () => {
    const pNull = { id: 'prj-1', waitingSinceDate: null }
    const plan1 = planStageChange(pNull, activeStage, reviewStage, now, today)
    assert.equal(plan1.ok, true)
    if (plan1.ok) {
      assert.equal(plan1.patch.waiting_since_date, today)
    }

    const pExisting = { id: 'prj-1', waitingSinceDate: '2026-10-20' }
    const plan2 = planStageChange(pExisting, activeStage, reviewStage, now, today)
    assert.equal(plan2.ok, true)
    if (plan2.ok) {
      assert.equal(plan2.patch.waiting_since_date, '2026-10-20')
    }
  })

  await t.test('T4: review -> active clears waiting_since_date', () => {
    const p = { id: 'prj-1', waitingSinceDate: '2026-10-20' }
    const plan = planStageChange(p, reviewStage, activeStage, now, today)
    assert.equal(plan.ok, true)
    if (plan.ok) {
      assert.equal(plan.patch.waiting_since_date, null)
    }
  })

  await t.test('T5: active / review -> delivered sets delivered_at (if null) and clears waiting', () => {
    const p1 = { id: 'prj-1', waitingSinceDate: '2026-10-20', deliveredAt: null }
    const plan1 = planStageChange(p1, activeStage, deliveredStage, now, today)
    assert.equal(plan1.ok, true)
    if (plan1.ok) {
      assert.equal(plan1.patch.delivered_at, now)
      assert.equal(plan1.patch.waiting_since_date, null)
    }

    const p2 = { id: 'prj-2', waitingSinceDate: '2026-10-20', deliveredAt: '2026-10-21T00:00:00.000Z' }
    const plan2 = planStageChange(p2, reviewStage, deliveredStage, now, today)
    assert.equal(plan2.ok, true)
    if (plan2.ok) {
      assert.equal(plan2.patch.delivered_at, '2026-10-21T00:00:00.000Z')
      assert.equal(plan2.patch.waiting_since_date, null)
    }
  })

  await t.test('T6: delivered -> active / review clears delivered_at and applies T3 to review', () => {
    const p1 = { id: 'prj-1', deliveredAt: '2026-10-20T00:00:00.000Z' }
    const plan1 = planStageChange(p1, deliveredStage, activeStage, now, today)
    assert.equal(plan1.ok, true)
    if (plan1.ok) {
      assert.equal(plan1.patch.delivered_at, null)
      assert.equal(plan1.patch.waiting_since_date, null)
    }

    const p2 = { id: 'prj-2', deliveredAt: '2026-10-20T00:00:00.000Z', waitingSinceDate: null }
    const plan2 = planStageChange(p2, deliveredStage, reviewStage, now, today)
    assert.equal(plan2.ok, true)
    if (plan2.ok) {
      assert.equal(plan2.patch.delivered_at, null)
      assert.equal(plan2.patch.waiting_since_date, today)
    }
  })

  await t.test('T7: planned -> review / delivered sets waiting / delivered_at per T3 / T5', () => {
    const p1 = { id: 'prj-1' }
    const planReview = planStageChange(p1, plannedStage, reviewStage, now, today)
    assert.equal(planReview.ok, true)
    if (planReview.ok) {
      assert.equal(planReview.patch.waiting_since_date, today)
    }

    const planDelivered = planStageChange(p1, plannedStage, deliveredStage, now, today)
    assert.equal(planDelivered.ok, true)
    if (planDelivered.ok) {
      assert.equal(planDelivered.patch.delivered_at, now)
      assert.equal(planDelivered.patch.waiting_since_date, null)
    }
  })

  await t.test('T8: review / delivered -> planned clears waiting_since_date and delivered_at', () => {
    const pReview = { id: 'prj-1', waitingSinceDate: '2026-10-20', deliveredAt: '2026-10-20T00:00:00.000Z' }
    const plan1 = planStageChange(pReview, reviewStage, plannedStage, now, today)
    assert.equal(plan1.ok, true)
    if (plan1.ok) {
      assert.equal(plan1.patch.waiting_since_date, null)
      assert.equal(plan1.patch.delivered_at, null)
    }

    const pDelivered = { id: 'prj-2', deliveredAt: '2026-10-20T00:00:00.000Z' }
    const plan2 = planStageChange(pDelivered, deliveredStage, plannedStage, now, today)
    assert.equal(plan2.ok, true)
    if (plan2.ok) {
      assert.equal(plan2.patch.waiting_since_date, null)
      assert.equal(plan2.patch.delivered_at, null)
    }
  })

  await t.test('T10: moving non-closed project to closed returns USE_CLOSE_PROJECT', () => {
    const p = { id: 'prj-1' }
    const plan1 = planStageChange(p, plannedStage, closedStage, now, today)
    assert.equal(plan1.ok, false)
    if (!plan1.ok) assert.equal(plan1.code, 'USE_CLOSE_PROJECT')

    const plan2 = planStageChange(p, activeStage, closedStage, now, today)
    assert.equal(plan2.ok, false)
    if (!plan2.ok) assert.equal(plan2.code, 'USE_CLOSE_PROJECT')

    const plan3 = planStageChange(p, reviewStage, closedStage, now, today)
    assert.equal(plan3.ok, false)
    if (!plan3.ok) assert.equal(plan3.code, 'USE_CLOSE_PROJECT')

    const plan4 = planStageChange(p, deliveredStage, closedStage, now, today)
    assert.equal(plan4.ok, false)
    if (!plan4.ok) assert.equal(plan4.code, 'USE_CLOSE_PROJECT')
  })

  await t.test('T12: moving closed project to any non-closed stage returns USE_REOPEN_PROJECT', () => {
    const p = { id: 'prj-1' }
    const plan1 = planStageChange(p, closedStage, plannedStage, now, today)
    assert.equal(plan1.ok, false)
    if (!plan1.ok) assert.equal(plan1.code, 'USE_REOPEN_PROJECT')

    const plan2 = planStageChange(p, closedStage, activeStage, now, today)
    assert.equal(plan2.ok, false)
    if (!plan2.ok) assert.equal(plan2.code, 'USE_REOPEN_PROJECT')

    const plan3 = planStageChange(p, closedStage, reviewStage, now, today)
    assert.equal(plan3.ok, false)
    if (!plan3.ok) assert.equal(plan3.code, 'USE_REOPEN_PROJECT')

    const plan4 = planStageChange(p, closedStage, deliveredStage, now, today)
    assert.equal(plan4.ok, false)
    if (!plan4.ok) assert.equal(plan4.code, 'USE_REOPEN_PROJECT')
  })
})
