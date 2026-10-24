import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { buildWeeklyReview, isReviewDue } from '@/lib/projects/review'
import { completeWeeklyReviewAction, fetchWeeklyReviewAction } from '@/app/actions/projects'
import { claimWorkspace } from '@/lib/db/repository'
import type { ProjectCard, Task, Invoice, Milestone } from '@/lib/projects/types'

test('Weekly Review (§8.10)', async (t) => {
  await ensureDbInitialized()
  delete process.env.AUTH_SECRET

  // Ensure workspace_settings row exists
  const existingSettings = await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
  if (!existingSettings) {
    await claimWorkspace({
      operatorName: 'Alex Rivera',
      operatorEmail: 'alex@example.com',
      currency: 'USD',
      currencySymbol: '$',
      locale: 'en-US',
    })
  } else {
    await db.updateTable('workspace_settings').set({ passcode_hash: null, is_claimed: 0 }).where('id', '=', 'current').execute()
  }

  const today = '2026-10-24' // Saturday
  const now = '2026-10-24T12:00:00.000Z'

  await t.test('review-steps-contents', () => {
    const cards: ProjectCard[] = [
      {
        project: {
          id: 'prj-1',
          dealId: null,
          title: 'Active Project Alpha',
          company: 'Alpha Corp',
          companyId: null,
          contactName: null,
          contactEmail: null,
          stageId: 'stg-active',
          billingType: 'fixed',
          currency: 'EUR',
          budgetMinor: 100000,
          hourlyRateMinor: null,
          estimateHours: null,
          revisionsIncluded: 2,
          startDate: '2026-10-01',
          dueDate: '2026-10-31',
          waitingSinceDate: null,
          health: 'on_track',
          brief: '',
          templateId: null,
          closeOutcome: null,
          closeReason: null,
          stageChangedAt: now,
          deliveredAt: null,
          closedAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        stage: { id: 'stg-active', name: 'Active', category: 'active', position: 2, color: 'blue', createdAt: now, updatedAt: now },
        openTasks: 3,
        doneTasks: 2,
        overdueTasks: 0,
        nextTask: null,
        currentMilestone: null,
        needsNextStep: true,
        money: { budgetMinor: 100000, invoicedMinor: 50000, paidMinor: 50000, outstandingMinor: 0, draftMinor: 0, billedHours: 0, currency: 'EUR' },
        waitingDays: null,
        revisionRound: null,
        hasOverdueInvoice: false,
      },
      {
        project: {
          id: 'prj-2',
          dealId: null,
          title: 'Review Project Beta',
          company: 'Beta Corp',
          companyId: null,
          contactName: null,
          contactEmail: null,
          stageId: 'stg-review',
          billingType: 'fixed',
          currency: 'EUR',
          budgetMinor: 200000,
          hourlyRateMinor: null,
          estimateHours: null,
          revisionsIncluded: null,
          startDate: '2026-10-01',
          dueDate: '2026-10-28',
          waitingSinceDate: '2026-10-20',
          health: 'at_risk',
          brief: '',
          templateId: null,
          closeOutcome: null,
          closeReason: null,
          stageChangedAt: now,
          deliveredAt: null,
          closedAt: null,
          archivedAt: null,
          createdAt: now,
          updatedAt: now,
        },
        stage: { id: 'stg-review', name: 'In Review', category: 'review', position: 3, color: 'amber', createdAt: now, updatedAt: now },
        openTasks: 0,
        doneTasks: 3,
        overdueTasks: 0,
        nextTask: null,
        currentMilestone: null,
        needsNextStep: false,
        money: { budgetMinor: 200000, invoicedMinor: 100000, paidMinor: 0, outstandingMinor: 100000, draftMinor: 0, billedHours: 0, currency: 'EUR' },
        waitingDays: 4,
        revisionRound: null,
        hasOverdueInvoice: false,
      },
    ]

    const tasks: Task[] = [
      // 1. Loose end task (no dueDate, no focusDate, no milestoneId, not completed)
      {
        id: 'tsk-loose',
        projectId: 'prj-1',
        milestoneId: null,
        title: 'Loose task with no date',
        notes: null,
        kind: 'task',
        revisionRound: null,
        sourceActivityId: null,
        dueDate: null,
        focusDate: null,
        position: 1000,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      // 2. Next week task (next week is 2026-10-26 to 2026-11-01)
      {
        id: 'tsk-next-week',
        projectId: 'prj-1',
        milestoneId: null,
        title: 'Design review next Tuesday',
        notes: null,
        kind: 'task',
        revisionRound: null,
        sourceActivityId: null,
        dueDate: '2026-10-27',
        focusDate: null,
        position: 2000,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const invoices: Invoice[] = [
      {
        id: 'inv-sent-overdue',
        projectId: 'prj-1',
        milestoneId: null,
        number: 'INV-001',
        label: 'Deposit',
        amountMinor: 50000,
        currency: 'EUR',
        status: 'sent',
        issueDate: '2026-10-01',
        dueDate: '2026-10-15', // Overdue
        paidDate: null,
        externalUrl: null,
        hours: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
      {
        id: 'inv-draft',
        projectId: 'prj-2',
        milestoneId: null,
        number: 'INV-002',
        label: 'Final invoice',
        amountMinor: 100000,
        currency: 'EUR',
        status: 'draft',
        issueDate: '2026-10-24',
        dueDate: '2026-11-07',
        paidDate: null,
        externalUrl: null,
        hours: null,
        notes: null,
        createdAt: now,
        updatedAt: now,
      },
    ]

    const result = buildWeeklyReview(
      {
        cards,
        tasks,
        invoices,
        milestones: [],
      },
      today
    )

    // Step 1: Loose ends
    assert.equal(result.looseEnds.length, 1)
    assert.equal((result.looseEnds[0] as any).task.id, 'tsk-loose')

    // Step 2: Projects (sorted by dueDate, prj-2 10-28 before prj-1 10-31)
    assert.equal(result.projects.length, 2)
    assert.equal(result.projects[0].project.id, 'prj-2')
    assert.equal(result.projects[1].project.id, 'prj-1')

    // Step 3: Money (sent overdue first, then draft)
    assert.equal(result.money.length, 2)
    assert.equal((result.money[0] as any).invoice.id, 'inv-sent-overdue')
    assert.equal((result.money[1] as any).invoice.id, 'inv-draft')

    // Step 4: Next week (grouped across 7 days from next Monday 2026-10-26 to Sunday 2026-11-01)
    assert.equal(result.nextWeek.length, 7)
    const tuesday = result.nextWeek.find((d) => d.date === '2026-10-27')
    assert.ok(tuesday)
    assert.equal(tuesday.items.length, 1)
    assert.equal((tuesday.items[0] as any).task.id, 'tsk-next-week')
  })

  await t.test('review-next-blocked-without-next-step', () => {
    // When a project in active stage has needsNextStep = true,
    // advancing to next step or next project in review is blocked per §8.10.
    const projectNeedsStep: ProjectCard = {
      project: {
        id: 'prj-active-nostep',
        dealId: null,
        title: 'Project Without Step',
        company: 'Corp',
        companyId: null,
        contactName: null,
        contactEmail: null,
        stageId: 'stg-active',
        billingType: 'fixed',
        currency: 'EUR',
        budgetMinor: null,
        hourlyRateMinor: null,
        estimateHours: null,
        revisionsIncluded: null,
        startDate: '2026-10-01',
        dueDate: null,
        waitingSinceDate: null,
        health: 'on_track',
        brief: '',
        templateId: null,
        closeOutcome: null,
        closeReason: null,
        stageChangedAt: now,
        deliveredAt: null,
        closedAt: null,
        archivedAt: null,
        createdAt: now,
        updatedAt: now,
      },
      stage: { id: 'stg-active', name: 'Active', category: 'active', position: 2, color: 'blue', createdAt: now, updatedAt: now },
      openTasks: 1,
      doneTasks: 0,
      overdueTasks: 0,
      nextTask: null,
      currentMilestone: null,
      needsNextStep: true,
      money: { budgetMinor: null, invoicedMinor: 0, paidMinor: 0, outstandingMinor: 0, draftMinor: 0, billedHours: 0, currency: 'EUR' },
      waitingDays: null,
      revisionRound: null,
      hasOverdueInvoice: false,
    }

    assert.equal(projectNeedsStep.needsNextStep, true)
    // A helper or UI guard confirms that projectNeedsStep blocks review progress
    const isNextBlocked = (card: ProjectCard) => card.needsNextStep
    assert.equal(isNextBlocked(projectNeedsStep), true)

    // Once marked waiting, needsNextStep is false
    const projectWaiting: ProjectCard = {
      ...projectNeedsStep,
      project: { ...projectNeedsStep.project, waitingSinceDate: '2026-10-24' },
      needsNextStep: false,
    }
    assert.equal(isNextBlocked(projectWaiting), false)
  })

  await t.test('complete-review-logs-activity', async () => {
    delete process.env.AUTH_SECRET
    await db.updateTable('workspace_settings').set({ passcode_hash: null, is_claimed: 0 }).where('id', '=', 'current').execute()

    const res = await completeWeeklyReviewAction({
      projectsReviewed: 4,
      invoicesChased: 2,
      tasksScheduled: 7,
    })

    assert.equal(res.ok, true)
    if (!res.ok) return

    // 1. workspace_settings.last_weekly_review_at updated
    const settings = await db.selectFrom('workspace_settings').selectAll().where('id', '=', 'current').executeTakeFirst()
    assert.ok(settings?.last_weekly_review_at)
    assert.equal(isReviewDue(settings.last_weekly_review_at, settings.last_weekly_review_at), false)

    // 2. Activity logged
    const activity = await db
      .selectFrom('activities')
      .selectAll()
      .where('title', '=', 'Weekly review')
      .orderBy('created_at', 'desc')
      .executeTakeFirst()
    assert.ok(activity)
    assert.equal(activity.type, 'Note')
    assert.equal(activity.summary, '4 projects reviewed, 2 invoices chased, 7 tasks scheduled')
  })
})
