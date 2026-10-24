import test from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as pRepo from '@/lib/db/projects-repository'
import * as repo from '@/lib/db/repository'
import { runAction, DomainError } from '@/lib/projects/action-result'
import {
  createProjectAction,
  updateProjectAction,
  moveProjectStageAction,
  toggleProjectWaitingAction,
  closeProjectAction,
  reopenProjectAction,
  archiveProjectAction,
  deleteProjectAction,
  createTaskAction,
  updateTaskAction,
  toggleTaskAction,
  moveTaskAction,
  deleteTaskAction,
  restoreTaskAction,
  createMilestoneAction,
  updateMilestoneAction,
  setMilestoneStatusAction,
  deleteMilestoneAction,
  createInvoiceAction,
  updateInvoiceAction,
  setInvoiceStatusAction,
  deleteInvoiceAction,
  restoreInvoiceAction,
  logFeedbackAction,
  syncBriefAction,
  fetchWeeklyReviewAction,
  completeWeeklyReviewAction,
  fetchProjectsAction,
  fetchProjectAction,
  fetchTodayAction,
  fetchProjectConfigAction,
  upsertStageAction,
  reorderStagesAction,
  deleteStageAction,
  upsertTemplateAction,
  duplicateTemplateAction,
  deleteTemplateAction,
} from '@/app/actions/projects'

test('Project Server Actions & Invariants (§9.4)', async (t) => {
  await ensureDbInitialized()
  delete process.env.AUTH_SECRET
  await db.updateTable('workspace_settings').set({ passcode_hash: null, is_claimed: 0 }).where('id', '=', 'current').execute()

  const today = '2026-10-24'
  const now = new Date().toISOString()

  await t.test('runAction: catches unhandled throws and maps them with domain-appropriate codes', async () => {
    const testSchema = z.object({ name: z.string().min(3) })

    // 0. Unauthorized handling when secret is set
    process.env.AUTH_SECRET = 'test-secret'
    const unauthRes = await runAction(
      testSchema,
      { name: 'valid' },
      async () => ({ data: 'ok' }),
      'Fallback'
    )
    assert.equal(unauthRes.ok, false)
    if (!unauthRes.ok) {
      assert.equal(unauthRes.error.code, 'UNAUTHORIZED')
    }
    delete process.env.AUTH_SECRET

    // 1. Zod validation failure
    const valRes = await runAction(
      testSchema,
      { name: 'ab' },
      async () => ({ data: 'ok' }),
      'Fallback error'
    )
    assert.equal(valRes.ok, false)
    if (!valRes.ok) {
      assert.equal(valRes.error.code, 'VALIDATION')
      assert.ok(valRes.error.details?.issues)
    }

    // 2. DomainError handling
    const domRes = await runAction(
      testSchema,
      { name: 'valid' },
      async () => {
        throw new DomainError('STAGE_TRANSITION_NOT_ALLOWED', 'Cannot jump stage', { from: 'a', to: 'b' })
      },
      'Fallback error'
    )
    assert.equal(domRes.ok, false)
    if (!domRes.ok) {
      assert.equal(domRes.error.code, 'STAGE_TRANSITION_NOT_ALLOWED')
      assert.equal(domRes.error.message, 'Cannot jump stage')
      assert.deepEqual(domRes.error.details, { from: 'a', to: 'b' })
    }

    // 3. Unhandled throw sanitized to INTERNAL
    const errRes = await runAction(
      testSchema,
      { name: 'valid' },
      async () => {
        throw new Error('sqlite3: syntax error at line 1')
      },
      'Database failed'
    )
    assert.equal(errRes.ok, false)
    if (!errRes.ok) {
      assert.equal(errRes.error.code, 'INTERNAL')
      assert.equal(errRes.error.message, 'Database failed')
    }

    // 4. Successful call
    const okRes = await runAction(
      testSchema,
      { name: 'valid' },
      async (data) => ({ data: `Hello ${data.name}` }),
      'Fallback error'
    )
    assert.equal(okRes.ok, true)
    if (okRes.ok) {
      assert.equal(okRes.data, 'Hello valid')
      assert.deepEqual(okRes.suggestions, [])
    }
  })

  await t.test('invoice-paid-never-changes-stage (I6, #34 regression)', async () => {
    // 1. Create a project
    const pRes = await createProjectAction({
      title: 'I6 In Review Project',
      company: 'Invariant Corp',
      templateId: 'tpl-website',
      budgetMinor: 200000,
      startDate: '2026-10-01',
      today,
    })
    assert.equal(pRes.ok, true)
    if (!pRes.ok) return
    const projectId = pRes.data.project.id

    // 2. Move project to In Review
    const stages = await db.selectFrom('project_stages').selectAll().execute()
    const activeStage = stages.find((s) => s.category === 'active')!
    const reviewStage = stages.find((s) => s.category === 'review')!

    const move1 = await moveProjectStageAction({ id: projectId, stageId: activeStage.id, today })
    assert.equal(move1.ok, true)
    const move2 = await moveProjectStageAction({ id: projectId, stageId: reviewStage.id, today })
    assert.equal(move2.ok, true)

    // Check project is In Review
    const detailBefore = await pRepo.getProjectDetail(projectId, today)
    assert.equal(detailBefore?.project.stageId, reviewStage.id)

    // 3. Create an invoice
    const invRes = await createInvoiceAction({
      projectId,
      label: 'Final milestone invoice',
      amountMinor: 100000,
      status: 'sent',
      today,
    })
    assert.equal(invRes.ok, true)
    if (!invRes.ok) return
    const invoiceId = invRes.data.id

    // Check project stage after sending invoice
    const detailAfterSent = await pRepo.getProjectDetail(projectId, today)
    assert.equal(detailAfterSent?.project.stageId, reviewStage.id)

    // 4. Mark invoice paid
    const paidRes = await setInvoiceStatusAction({
      id: invoiceId,
      status: 'paid',
      today,
    })
    assert.equal(paidRes.ok, true)

    // Verify I6: project stage MUST remain In Review!
    const detailAfterPaid = await pRepo.getProjectDetail(projectId, today)
    assert.equal(detailAfterPaid?.project.stageId, reviewStage.id)
    assert.equal(detailAfterPaid?.project.closeOutcome, null)
    assert.equal(detailAfterPaid?.project.closedAt, null)
  })

  await t.test('Project workflow: create, update, waiting, close, reopen, archive, delete', async () => {
    // 1. Create project
    const created = await createProjectAction({
      title: 'Workflow Project',
      company: 'Workflow Corp',
      templateId: 'tpl-website',
      budgetMinor: 150000,
      paymentSchedule: 'split_50_50',
      startDate: '2026-10-01',
      dueDate: '2026-11-05',
      today,
    })
    assert.equal(created.ok, true)
    if (!created.ok) return
    const pId = created.data.project.id
    assert.equal(created.data.milestones.length, 4) // Discovery, Design, Build, Launch
    assert.equal(created.data.invoices.length, 2) // split_50_50 -> Deposit 50%, Final 50%

    // 2. Update project
    const updated = await updateProjectAction({
      id: pId,
      patch: { title: 'Workflow Project (Renamed)', health: 'on_track' },
    })
    assert.equal(updated.ok, true)
    if (updated.ok) {
      assert.equal(updated.data.title, 'Workflow Project (Renamed)')
      assert.equal(updated.data.health, 'on_track')
    }

    // 3. Toggle waiting
    const wait1 = await toggleProjectWaitingAction({ id: pId, today })
    assert.equal(wait1.ok, true)
    if (wait1.ok) assert.equal(wait1.data.waitingSinceDate, today)

    const wait2 = await toggleProjectWaitingAction({ id: pId, today })
    assert.equal(wait2.ok, true)
    if (wait2.ok) assert.equal(wait2.data.waitingSinceDate, null)

    // 4. Close project: with invoiceResolution none when invoices exist -> rejects with INVOICES_UNRESOLVED
    const closeFail = await closeProjectAction({
      id: pId,
      outcome: 'completed',
      invoiceResolution: 'none',
      markPaidInvoiceIds: [],
      openTasks: 'complete',
      followUps: { testimonial: true, retainer: false, checkIn: false },
      archive: false,
      today,
    })
    assert.equal(closeFail.ok, false)
    if (!closeFail.ok) {
      assert.equal(closeFail.error.code, 'INVOICES_UNRESOLVED')
    }

    // 5. Close project: with invoiceResolution void_open -> succeeds
    const closeSuccess = await closeProjectAction({
      id: pId,
      outcome: 'completed',
      invoiceResolution: 'void_open',
      markPaidInvoiceIds: [],
      openTasks: 'complete',
      followUps: { testimonial: true, retainer: false, checkIn: false },
      archive: false,
      today,
    })
    assert.equal(closeSuccess.ok, true)
    if (closeSuccess.ok) {
      assert.equal(closeSuccess.data.closeOutcome, 'completed')
      assert.ok(closeSuccess.data.closedAt)
    }

    // 6. Archive and unarchive
    const arch1 = await archiveProjectAction({ id: pId, archived: true })
    assert.equal(arch1.ok, true)
    if (arch1.ok) assert.ok(arch1.data.archivedAt)

    const arch2 = await archiveProjectAction({ id: pId, archived: false })
    assert.equal(arch2.ok, true)
    if (arch2.ok) assert.equal(arch2.data.archivedAt, null)

    // 7. Reopen project
    const reopen = await reopenProjectAction({ id: pId })
    assert.equal(reopen.ok, true)
    if (reopen.ok) {
      assert.equal(reopen.data.closeOutcome, null)
      assert.equal(reopen.data.closedAt, null)
    }

    // 8. Delete project
    const del = await deleteProjectAction({ id: pId })
    assert.equal(del.ok, true)
    const afterDel = await pRepo.getProjectDetail(pId, today)
    assert.equal(afterDel, null)
  })

  await t.test('Tasks and Milestones CRUD with suggestions', async () => {
    const pRes = await createProjectAction({
      title: 'Task Milestone Project',
      company: 'TMS Corp',
      templateId: 'tpl-blank',
      startDate: '2026-10-01',
      today,
    })
    assert.equal(pRes.ok, true)
    if (!pRes.ok) return
    const pId = pRes.data.project.id

    // Create milestone
    const msRes = await createMilestoneAction({
      projectId: pId,
      title: 'Milestone Alpha',
      amountMinor: 80000,
      today,
    })
    assert.equal(msRes.ok, true)
    if (!msRes.ok) return
    const mId = msRes.data.id

    // Create task
    const tRes = await createTaskAction({
      projectId: pId,
      milestoneId: mId,
      title: 'Task Alpha 1',
      dueDate: '2026-10-28',
    })
    assert.equal(tRes.ok, true)
    if (!tRes.ok) return
    const tId = tRes.data.id

    // Toggle task
    const tDone = await toggleTaskAction({ id: tId, done: true })
    assert.equal(tDone.ok, true)
    if (tDone.ok) assert.ok(tDone.data.completedAt)

    const tReopen = await toggleTaskAction({ id: tId, done: false })
    assert.equal(tReopen.ok, true)
    if (tReopen.ok) assert.equal(tReopen.data.completedAt, null)

    // Milestone status transition and suggestions
    // Move project to active first
    const stages = await db.selectFrom('project_stages').selectAll().execute()
    const activeStage = stages.find((s) => s.category === 'active')!
    await moveProjectStageAction({ id: pId, stageId: activeStage.id, today })

    // Delivered milestone -> suggests move_to_review
    const msDelivered = await setMilestoneStatusAction({ id: mId, status: 'delivered' })
    assert.equal(msDelivered.ok, true)
    if (msDelivered.ok) {
      assert.equal(msDelivered.data.status, 'delivered')
      assert.deepEqual(msDelivered.suggestions, [{ kind: 'move_to_review', projectId: pId }])
    }

    // Approved milestone -> suggests create_invoice
    const msApproved = await setMilestoneStatusAction({ id: mId, status: 'approved' })
    assert.equal(msApproved.ok, true)
    if (msApproved.ok) {
      assert.equal(msApproved.data.status, 'approved')
      assert.deepEqual(msApproved.suggestions, [
        { kind: 'create_invoice', projectId: pId, milestoneId: mId, amountMinor: 80000 },
      ])
    }

    // Delete task and milestone
    const delTask = await deleteTaskAction({ id: tId })
    assert.equal(delTask.ok, true)

    const delMs = await deleteMilestoneAction({ id: mId })
    assert.equal(delMs.ok, true)
  })

  await t.test('Brief sync and feedback logging', async () => {
    const pRes = await createProjectAction({
      title: 'Brief Sync Project',
      company: 'Sync Corp',
      templateId: 'tpl-blank',
      startDate: '2026-10-01',
      today,
    })
    assert.equal(pRes.ok, true)
    if (!pRes.ok) return
    const pId = pRes.data.project.id

    // 1. Sync brief: adds tasks
    const briefText = `
Project Scope:
- [ ] Task from brief 1
- [ ] Task from brief 2
`
    const sync1 = await syncBriefAction({ projectId: pId, brief: briefText })
    assert.equal(sync1.ok, true)
    if (sync1.ok) {
      assert.equal(sync1.data.created.length, 2)
      assert.equal(sync1.data.completed.length, 0)
    }

    // 2. Mark one checkbox in brief as done
    const briefText2 = `
Project Scope:
- [x] Task from brief 1
- [ ] Task from brief 2
`
    const sync2 = await syncBriefAction({ projectId: pId, brief: briefText2 })
    assert.equal(sync2.ok, true)
    if (sync2.ok) {
      assert.equal(sync2.data.completed.length, 1)
      assert.equal(sync2.data.completed[0].title, 'Task from brief 1')
    }

    // 3. Log feedback
    const fbRes = await logFeedbackAction({
      projectId: pId,
      source: 'Meeting',
      date: today,
      milestoneId: null,
      text: 'Client requested header adjustments',
      items: ['Adjust header font', 'Update nav icons'],
      dueDate: '2026-10-30',
    })
    assert.equal(fbRes.ok, true)
    if (fbRes.ok) {
      assert.equal(fbRes.data.tasks.length, 2)
      assert.equal(fbRes.data.round, 1)
    }
  })

  await t.test('stage-rename-and-reorder', async () => {
    const configRes = await fetchProjectConfigAction()
    assert.equal(configRes.ok, true)
    if (!configRes.ok) return

    const stages = configRes.data.stages
    assert.ok(stages.length >= 5)

    const stageToRename = stages[0]
    const originalName = stageToRename.name
    const originalIds = stages.map((s) => s.id)

    try {
      // 1. Rename first planned stage
      const renamed = await upsertStageAction({
        id: stageToRename.id,
        name: `${originalName} Custom`,
        category: stageToRename.category,
        color: stageToRename.color,
      })
      assert.equal(renamed.ok, true)
      if (renamed.ok) {
        assert.equal(renamed.data.name, `${originalName} Custom`)
      }

      // 2. Reorder stages (reverse first two stages in same category)
      const reversedIds = [...originalIds]
      const temp = reversedIds[0]
      reversedIds[0] = reversedIds[1]
      reversedIds[1] = temp

      const reorderRes = await reorderStagesAction({ orderedIds: reversedIds })
      assert.equal(reorderRes.ok, true)

      const updatedConfig = await fetchProjectConfigAction()
      assert.equal(updatedConfig.ok, true)
      if (updatedConfig.ok) {
        const updatedStages = updatedConfig.data.stages
        assert.equal(updatedStages[0].id, reversedIds[0])
        assert.equal(updatedStages[1].id, reversedIds[1])
      }
    } finally {
      // Cleanup: restore original stage name and order
      await upsertStageAction({
        id: stageToRename.id,
        name: originalName,
        category: stageToRename.category,
        color: stageToRename.color,
      })
      await reorderStagesAction({ orderedIds: originalIds })
    }
  })

  await t.test('template-duplicate-and-edit', async () => {
    // 1. Built-in template direct edit fails with BUILTIN_TEMPLATE_READONLY
    const editBuiltinRes = await upsertTemplateAction({
      id: 'tpl-blank',
      name: 'Attempted Builtin Edit',
      billingType: 'fixed',
      paymentSchedule: 'none',
      durationDays: 14,
      revisionsIncluded: null,
      milestones: [],
      tasks: [],
    })
    assert.equal(editBuiltinRes.ok, false)
    if (!editBuiltinRes.ok) {
      assert.equal(editBuiltinRes.error.code, 'BUILTIN_TEMPLATE_READONLY')
    }

    // 2. Duplicate built-in template
    const dupRes = await duplicateTemplateAction({ id: 'tpl-website' })
    assert.equal(dupRes.ok, true)
    if (!dupRes.ok) return
    const dupTpl = dupRes.data
    assert.equal(dupTpl.isBuiltin, false)
    assert.notEqual(dupTpl.id, 'tpl-website')
    assert.ok(dupTpl.name.includes('(copy)'))

    // 3. Edit duplicated template
    const editDupRes = await upsertTemplateAction({
      id: dupTpl.id,
      name: 'Custom Web Build Template',
      billingType: dupTpl.billingType,
      paymentSchedule: dupTpl.paymentSchedule,
      durationDays: 45,
      revisionsIncluded: 3,
      milestones: dupTpl.milestones,
      tasks: dupTpl.tasks,
    })
    assert.equal(editDupRes.ok, true)
    if (editDupRes.ok) {
      assert.equal(editDupRes.data.name, 'Custom Web Build Template')
      assert.equal(editDupRes.data.durationDays, 45)
    }

    // 4. Delete duplicated template
    const delRes = await deleteTemplateAction({ id: dupTpl.id })
    assert.equal(delRes.ok, true)
  })
})
