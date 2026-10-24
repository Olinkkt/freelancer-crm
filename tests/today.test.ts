import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildToday } from '@/lib/projects/today'
import type { ProjectCard, Task, Invoice } from '@/lib/projects/types'

const dummyStage = {
  id: 'stg-1',
  name: 'Active',
  category: 'active' as const,
  position: 1000,
  color: '#3b82f6',
  createdAt: '2026-10-01',
  updatedAt: '2026-10-01',
}

const dummyMoney = {
  budgetMinor: 100000,
  invoicedMinor: 50000,
  paidMinor: 50000,
  outstandingMinor: 0,
  draftMinor: 0,
  billedHours: 0,
  currency: 'EUR',
}

function makeCard(id: string, opts: Partial<ProjectCard['project']> = {}, needsNextStep = false): ProjectCard {
  return {
    project: {
      id,
      title: `Project ${id}`,
      company: 'Acme',
      companyId: null,
      dealId: null,
      contactName: null,
      contactEmail: null,
      stageId: dummyStage.id,
      billingType: 'fixed',
      currency: 'EUR',
      budgetMinor: 100000,
      hourlyRateMinor: null,
      estimateHours: null,
      revisionsIncluded: 2,
      startDate: '2026-10-01',
      dueDate: '2026-11-01',
      waitingSinceDate: null,
      health: 'on_track',
      brief: '',
      templateId: null,
      closeOutcome: null,
      closeReason: null,
      stageChangedAt: '2026-10-01T00:00:00Z',
      deliveredAt: null,
      closedAt: null,
      archivedAt: null,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-01T00:00:00Z',
      ...opts,
    },
    stage: dummyStage,
    openTasks: 1,
    doneTasks: 0,
    overdueTasks: 0,
    nextTask: null,
    currentMilestone: null,
    money: dummyMoney,
    waitingDays: null,
    needsNextStep,
    revisionRound: null,
    hasOverdueInvoice: false,
  }
}

test('today-item-appears-once', () => {
  const card = makeCard('p-1')
  // A task that is overdue AND focus_date is today
  const task: Task = {
    id: 't-1',
    projectId: 'p-1',
    milestoneId: null,
    title: 'Dual-match task',
    kind: 'task',
    notes: null,
    revisionRound: null,
    sourceActivityId: null,
    dueDate: '2026-10-20', // overdue on 2026-10-24
    focusDate: '2026-10-24',
    position: 1024,
    completedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  }

  const result = buildToday(
    {
      cards: [card],
      tasks: [task],
      invoices: [],
    },
    '2026-10-24'
  )

  // It should appear in 'overdue', and NOT in 'focus'
  const overdueSection = result.sections.find((s) => s.id === 'overdue')!
  const focusSection = result.sections.find((s) => s.id === 'focus')!

  assert.equal(overdueSection.items.length, 1)
  assert.equal(focusSection.items.length, 0)
})

test('badge-counts-overdue-and-due-today', () => {
  const card = makeCard('p-1')
  const taskOverdue: Task = {
    id: 't-1',
    projectId: 'p-1',
    milestoneId: null,
    title: 'Overdue task',
    kind: 'task',
    notes: null,
    revisionRound: null,
    sourceActivityId: null,
    dueDate: '2026-10-22',
    focusDate: null,
    position: 1024,
    completedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  }

  const taskDueToday: Task = {
    id: 't-2',
    projectId: 'p-1',
    milestoneId: null,
    title: 'Due today task',
    kind: 'task',
    notes: null,
    revisionRound: null,
    sourceActivityId: null,
    dueDate: '2026-10-24',
    focusDate: null,
    position: 2048,
    completedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  }

  const taskFocusOnly: Task = {
    id: 't-3',
    projectId: 'p-1',
    milestoneId: null,
    title: 'Focus only task',
    kind: 'task',
    notes: null,
    revisionRound: null,
    sourceActivityId: null,
    dueDate: '2026-10-30',
    focusDate: '2026-10-24',
    position: 3072,
    completedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  }

  const result = buildToday(
    {
      cards: [card],
      tasks: [taskOverdue, taskDueToday, taskFocusOnly],
      invoices: [],
    },
    '2026-10-24'
  )

  // Badge count = overdue (1) + dueToday (1) = 2
  assert.equal(result.badgeCount, 2)
})

test('archived-projects-excluded', () => {
  const archivedCard = makeCard('p-archived', { archivedAt: '2026-10-20T00:00:00Z' })
  const task: Task = {
    id: 't-1',
    projectId: 'p-archived',
    milestoneId: null,
    title: 'Archived project task',
    kind: 'task',
    notes: null,
    revisionRound: null,
    sourceActivityId: null,
    dueDate: '2026-10-24',
    focusDate: null,
    position: 1024,
    completedAt: null,
    createdAt: '2026-10-01',
    updatedAt: '2026-10-01',
  }

  const result = buildToday(
    {
      cards: [archivedCard],
      tasks: [task],
      invoices: [],
    },
    '2026-10-24'
  )

  assert.equal(result.badgeCount, 0)
  for (const sec of result.sections) {
    assert.equal(sec.items.length, 0)
  }
})

test('won-deal-without-project-in-sales', () => {
  const result = buildToday(
    {
      cards: [],
      tasks: [],
      invoices: [],
      wonDealsWithoutProject: [
        {
          id: 'deal-won-1',
          title: 'Pixel Q4 Website',
          company: 'Pixel s.r.o.',
          rawAmount: 6000,
        },
      ],
    },
    '2026-10-24'
  )

  const sales = result.sections.find((s) => s.id === 'sales')!
  assert.equal(sales.items.length, 1)
  assert.equal(sales.items[0].type, 'startProject')
  if (sales.items[0].type === 'startProject') {
    assert.equal(sales.items[0].deal.id, 'deal-won-1')
    assert.equal(sales.items[0].deal.title, 'Pixel Q4 Website')
  }
})
