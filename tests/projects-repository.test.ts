import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as pRepo from '@/lib/db/projects-repository'
import * as repo from '@/lib/db/repository'
import { projectMoney } from '@/lib/projects/money'

test('Projects Repository Invariants & Core Operations', async (t) => {
  await ensureDbInitialized()

  await t.test('deal-id-unique (I1)', async () => {
    const now = new Date().toISOString()
    const deal = await repo.createDeal({
      title: 'Unique Deal Project',
      company: 'Unique Corp',
      value: '20 000 Kč',
      rawAmount: 20000,
      stage: 'Won',
      probability: '100%',
      next: 'Do work',
      color: 'blue',
    })

    const project1 = {
      id: `prj-u1-${Date.now()}`,
      title: 'P1',
      company: 'Unique Corp',
      deal_id: deal.id,
      stage_id: 'stg-planned',
      billing_type: 'fixed',
      currency: 'USD',
      stage_changed_at: now,
      created_at: now,
      updated_at: now,
    }

    await pRepo.insertProjectGraph({ project: project1 })

    const project2 = {
      id: `prj-u2-${Date.now()}`,
      title: 'P2',
      company: 'Unique Corp',
      deal_id: deal.id,
      stage_id: 'stg-planned',
      billing_type: 'fixed',
      currency: 'USD',
      stage_changed_at: now,
      created_at: now,
      updated_at: now,
    }

    await assert.rejects(
      async () => {
        await pRepo.insertProjectGraph({ project: project2 })
      },
      (err: any) => {
        return err.code === 'DEAL_ALREADY_HAS_PROJECT' && err.details.projectId === project1.id
      }
    )
  })

  await t.test('delete-project-cascades (I9)', async () => {
    const now = new Date().toISOString()
    const pId = `prj-del-${Date.now()}`
    const mId = `ms-del-${Date.now()}`
    const tId = `tsk-del-${Date.now()}`
    const invId = `inv-del-${Date.now()}`

    await pRepo.insertProjectGraph({
      project: {
        id: pId,
        title: 'Cascade Delete Project',
        company: 'Cascade Corp',
        stage_id: 'stg-active',
        billing_type: 'fixed',
        currency: 'USD',
        stage_changed_at: now,
        created_at: now,
        updated_at: now,
      },
      milestones: [
        {
          id: mId,
          project_id: pId,
          title: 'M1',
          position: 1024,
          status: 'open',
          created_at: now,
          updated_at: now,
        },
      ],
      tasks: [
        {
          id: tId,
          project_id: pId,
          title: 'T1',
          position: 1024,
          kind: 'task',
          created_at: now,
          updated_at: now,
        },
      ],
      invoices: [
        {
          id: invId,
          project_id: pId,
          label: 'I1',
          amount_minor: 10000,
          currency: 'USD',
          status: 'draft',
          created_at: now,
          updated_at: now,
        },
      ],
    })

    // Log an activity linked to this project
    const actId = `act-p-${Date.now()}`
    await db.insertInto('activities').values({
      id: actId,
      project_id: pId,
      type: 'Note',
      title: 'Project Activity',
      person: 'Bob',
      company: 'Cascade Corp',
      date: '2026-10-24',
      status: 'Completed',
      color: 'blue',
      created_at: now,
    }).execute()

    // Delete project
    await pRepo.deleteProject(pId)

    // Verify cascades
    const prjCheck = await db.selectFrom('projects').selectAll().where('id', '=', pId).executeTakeFirst()
    assert.equal(prjCheck, undefined)
    const msCheck = await db.selectFrom('project_milestones').selectAll().where('project_id', '=', pId).execute()
    assert.equal(msCheck.length, 0)
    const taskCheck = await db.selectFrom('project_tasks').selectAll().where('project_id', '=', pId).execute()
    assert.equal(taskCheck.length, 0)
    const invCheck = await db.selectFrom('invoices').selectAll().where('project_id', '=', pId).execute()
    assert.equal(invCheck.length, 0)

    // Activity project_id is nulled
    const actCheck = await db.selectFrom('activities').selectAll().where('id', '=', actId).executeTakeFirst()
    assert.ok(actCheck)
    assert.equal(actCheck.project_id, null)
  })

  await t.test('delete-deal-keeps-project (I11)', async () => {
    const now = new Date().toISOString()
    const deal = await repo.createDeal({
      title: 'Deal To Delete',
      company: 'Keeper Corp',
      value: '30 000 Kč',
      rawAmount: 30000,
      stage: 'Won',
      probability: '100%',
      next: 'Do work',
      color: 'blue',
    })

    const pId = `prj-keep-${Date.now()}`
    await pRepo.insertProjectGraph({
      project: {
        id: pId,
        title: 'Project Kept',
        company: 'Keeper Corp',
        deal_id: deal.id,
        stage_id: 'stg-active',
        billing_type: 'fixed',
        currency: 'USD',
        stage_changed_at: now,
        created_at: now,
        updated_at: now,
      },
    })

    // Delete deal
    await repo.deleteDeal(deal.id)

    // Project still exists, but deal_id is null
    const prj = await db.selectFrom('projects').selectAll().where('id', '=', pId).executeTakeFirst()
    assert.ok(prj)
    assert.equal(prj.deal_id, null)
  })

  await t.test('project-money-percentages-only-with-budget', () => {
    // Zero or null budget does not throw division by zero and has budgetMinor: null
    const calc1 = projectMoney({ budget_minor: null, currency: 'USD' }, [])
    assert.equal(calc1.budgetMinor, null)

    const calc2 = projectMoney(
      { budget_minor: 100000, currency: 'USD' },
      [
        { amount_minor: 50000, status: 'paid', hours: 0 },
        { amount_minor: 50000, status: 'sent', hours: 0 },
      ]
    )
    assert.equal(calc2.budgetMinor, 100000)
    assert.equal(calc2.paidMinor, 50000)
    assert.equal(calc2.outstandingMinor, 50000)
    assert.equal(calc2.invoicedMinor, 100000)
  })
})
