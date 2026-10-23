import { test } from 'node:test'
import assert from 'node:assert/strict'
import type { Task, Milestone, Invoice } from '@/lib/projects/types'
import {
  revisionRoundLabel,
  isRoundOverScope,
  groupTasksByMilestone,
  buildCloseProjectInput,
  suggestionToToast,
  applyOptimisticToggle,
  rollbackToggle,
} from '@/lib/projects/ui-helpers'
import type { Suggestion } from '@/lib/projects/suggestions'

test('revision-round-label', () => {
  assert.equal(revisionRoundLabel(1, null), 'Round 1')
  assert.equal(revisionRoundLabel(1, undefined), 'Round 1')
  assert.equal(revisionRoundLabel(1, 0), 'Round 1')
  assert.equal(revisionRoundLabel(1, 2), 'Round 1 of 2')
  assert.equal(revisionRoundLabel(3, 2), 'Round 3 of 2')
  assert.equal(isRoundOverScope(1, 2), false)
  assert.equal(isRoundOverScope(2, 2), false)
  assert.equal(isRoundOverScope(3, 2), true)
  assert.equal(isRoundOverScope(3, null), false)
})

test('task-groups-order', () => {
  const milestones: Milestone[] = [
    {
      id: 'm-2',
      projectId: 'p-1',
      title: 'Build',
      status: 'open',
      position: 2048,
      dueDate: '2026-11-05',
      amountMinor: null,
      deliveredAt: null,
      approvedAt: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 'm-1',
      projectId: 'p-1',
      title: 'Discovery',
      status: 'approved',
      position: 1024,
      dueDate: '2026-10-15',
      amountMinor: null,
      deliveredAt: '2026-10-15',
      approvedAt: '2026-10-16',
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ]

  const tasks: Task[] = [
    {
      id: 't-3',
      projectId: 'p-1',
      milestoneId: null,
      title: 'No milestone task',
      kind: 'task',
      position: 1024,
      dueDate: null,
      focusDate: null,
      completedAt: null,
      revisionRound: null,
      sourceActivityId: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 't-2',
      projectId: 'p-1',
      milestoneId: 'm-2',
      title: 'Build task',
      kind: 'task',
      position: 1024,
      dueDate: null,
      focusDate: null,
      completedAt: null,
      revisionRound: null,
      sourceActivityId: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 't-1',
      projectId: 'p-1',
      milestoneId: 'm-1',
      title: 'Discovery task',
      kind: 'task',
      position: 1024,
      dueDate: null,
      focusDate: null,
      completedAt: null,
      revisionRound: null,
      sourceActivityId: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ]

  const groups = groupTasksByMilestone(tasks, milestones)
  assert.equal(groups.length, 3)
  assert.equal(groups[0].milestone?.id, 'm-1')
  assert.equal(groups[0].tasks.length, 1)
  assert.equal(groups[0].tasks[0].id, 't-1')

  assert.equal(groups[1].milestone?.id, 'm-2')
  assert.equal(groups[1].tasks.length, 1)
  assert.equal(groups[1].tasks[0].id, 't-2')

  assert.equal(groups[2].milestone, null)
  assert.equal(groups[2].tasks.length, 1)
  assert.equal(groups[2].tasks[0].id, 't-3')
})

test('close-dialog-builds-input', () => {
  const unpaidInvoices: Invoice[] = [
    {
      id: 'inv-1',
      projectId: 'p-1',
      milestoneId: null,
      label: 'Deposit',
      number: 'INV-1',
      amountMinor: 400000,
      currency: 'EUR',
      hours: null,
      status: 'sent',
      issueDate: '2026-10-01',
      dueDate: '2026-10-15',
      paidDate: null,
      externalUrl: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
    {
      id: 'inv-2',
      projectId: 'p-1',
      milestoneId: null,
      label: 'Final',
      number: 'INV-2',
      amountMinor: 400000,
      currency: 'EUR',
      hours: null,
      status: 'draft',
      issueDate: null,
      dueDate: null,
      paidDate: null,
      externalUrl: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ]

  // Scenario 1: some unpaid remaining -> resolution applied
  const input1 = buildCloseProjectInput({
    projectId: 'p-1',
    outcome: 'completed',
    unpaidInvoices,
    paidInvoiceIds: ['inv-1'],
    unpaidResolution: 'void_open',
    openTasks: 'complete',
    followUps: { testimonial: true, retainer: false, checkIn: false },
    saveAsTemplateName: '  My Template  ',
    archive: true,
    today: '2026-10-24',
  })
  assert.equal(input1.id, 'p-1')
  assert.equal(input1.outcome, 'completed')
  assert.equal(input1.invoiceResolution, 'void_open')
  assert.deepEqual(input1.markPaidInvoiceIds, ['inv-1'])
  assert.equal(input1.saveAsTemplateName, 'My Template')
  assert.equal(input1.archive, true)

  // Scenario 2: all unpaid marked paid -> resolution becomes 'none'
  const input2 = buildCloseProjectInput({
    projectId: 'p-1',
    outcome: 'cancelled',
    reason: 'Client paused project',
    unpaidInvoices,
    paidInvoiceIds: ['inv-1', 'inv-2'],
    unpaidResolution: 'leave_open',
    openTasks: 'delete',
    followUps: { testimonial: false, retainer: false, checkIn: false },
    today: '2026-10-24',
  })
  assert.equal(input2.outcome, 'cancelled')
  assert.equal(input2.reason, 'Client paused project')
  assert.equal(input2.invoiceResolution, 'none')
})

test('suggestion-to-toast-mapping', () => {
  let acceptedAction = ''
  const callbacks = {
    onStartProject: (id: string) => {
      acceptedAction = `start:${id}`
    },
    onKickOff: (id: string) => {
      acceptedAction = `kickoff:${id}`
    },
    onMoveToReview: (id: string) => {
      acceptedAction = `review:${id}`
    },
    onBackToActive: (id: string) => {
      acceptedAction = `active:${id}`
    },
    onCloseProject: (id: string) => {
      acceptedAction = `close:${id}`
    },
  }

  const s1: Suggestion = { kind: 'start_project', dealId: 'deal-123' }
  const toast1 = suggestionToToast(s1, callbacks)
  assert.equal(toast1.message, 'Deal won. Start a project?')
  assert.equal(toast1.shortcut, 'Y')
  assert.equal(toast1.durationMs, 8000)
  toast1.action.onRun()
  assert.equal(acceptedAction, 'start:deal-123')

  const s2: Suggestion = { kind: 'kick_off', projectId: 'p-1' }
  const toast2 = suggestionToToast(s2, callbacks)
  assert.equal(toast2.message, 'Payment received. Kick off the project?')
  toast2.action.onRun()
  assert.equal(acceptedAction, 'kickoff:p-1')

  const s3: Suggestion = { kind: 'move_to_review', projectId: 'p-1' }
  const toast3 = suggestionToToast(s3, callbacks)
  assert.equal(toast3.message, 'Sent to client. Move to In Review?')
  toast3.action.onRun()
  assert.equal(acceptedAction, 'review:p-1')

  const s4: Suggestion = { kind: 'back_to_active', projectId: 'p-1' }
  const toast4 = suggestionToToast(s4, callbacks)
  assert.equal(toast4.message, 'Feedback logged. Back to Active?')
  toast4.action.onRun()
  assert.equal(acceptedAction, 'active:p-1')

  const s5: Suggestion = { kind: 'close_project', projectId: 'p-1' }
  const toast5 = suggestionToToast(s5, callbacks)
  assert.equal(toast5.message, 'All paid. Close the project?')
  toast5.action.onRun()
  assert.equal(acceptedAction, 'close:p-1')
})

test('optimistic-toggle-rolls-back', () => {
  const initialTasks: Task[] = [
    {
      id: 't-1',
      projectId: 'p-1',
      milestoneId: null,
      title: 'Task 1',
      kind: 'task',
      position: 1024,
      dueDate: null,
      focusDate: null,
      completedAt: null,
      revisionRound: null,
      sourceActivityId: null,
      notes: null,
      createdAt: '2026-10-01',
      updatedAt: '2026-10-01',
    },
  ]

  // Optimistically toggle done = true
  const { updatedTasks, previousTask } = applyOptimisticToggle(initialTasks, 't-1', true)
  assert.ok(previousTask)
  assert.equal(previousTask.completedAt, null)
  assert.ok(updatedTasks[0].completedAt !== null)

  // Roll back on failure
  const rolledBackTasks = rollbackToggle(updatedTasks, previousTask)
  assert.equal(rolledBackTasks[0].completedAt, null)
})
