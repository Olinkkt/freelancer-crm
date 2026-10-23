import test from 'node:test'
import assert from 'node:assert/strict'
import { GET, POST } from '@/app/api/backup/route'
import { createSessionToken } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { db } from '@/lib/db/client'

test('Backup & Restore API (/api/backup)', async (t) => {
  const secret = 'test-secret-backup-endpoint-32chars!!'
  process.env.AUTH_SECRET = secret

  t.after(() => {
    delete process.env.AUTH_SECRET
  })

  await t.test('returns 401 when unauthenticated', async () => {
    const unauthedReq = new Request('http://localhost:3000/api/backup', {
      method: 'GET',
    })
    const res = await GET(unauthedReq)
    assert.equal(res.status, 401)
  })

  await t.test('exports complete JSON workspace snapshot when authenticated', async () => {
    const token = await createSessionToken()
    const authedReq = new Request('http://localhost:3000/api/backup', {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    const res = await GET(authedReq)
    assert.equal(res.status, 200)
    assert.equal(res.headers.get('content-type'), 'application/json')
    assert.match(res.headers.get('content-disposition') || '', /attachment; filename="freelancer-crm-backup-/)

    const data = await res.json()
    assert.equal(data.version, 3)
    assert.ok(Array.isArray(data.deals))
    assert.ok(Array.isArray(data.companies))
    assert.ok(Array.isArray(data.contacts))
    assert.ok(Array.isArray(data.activities))
    assert.ok(Array.isArray(data.followUps))
    assert.ok(Array.isArray(data.projects))
    assert.ok(Array.isArray(data.projectStages))
  })

  await t.test('backup-v3-roundtrip', async () => {
    const token = await createSessionToken()

    // 1. Export current v3 backup
    const exportReq = new Request('http://localhost:3000/api/backup', {
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
    })
    const exportRes = await GET(exportReq)
    assert.equal(exportRes.status, 200)
    const backupJson = await exportRes.json()
    assert.equal(backupJson.version, 3)

    // 2. Restore it
    const restoreReq = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(backupJson),
    })
    const restoreRes = await POST(restoreReq)
    assert.equal(restoreRes.status, 200)
    const result = await restoreRes.json()
    assert.equal(result.success, true)
  })

  await t.test('restore-legacy-backup-converts-deliverables', async () => {
    const token = await createSessionToken()
    const legacySnapshot = {
      version: '1.0',
      deals: [
        {
          id: 'deal-legacy-backup-1',
          title: 'Legacy Website Deal',
          company: 'Legacy Corp',
          value: '45 000 Kč',
          rawAmount: 45000,
          stage: 'Won',
          probability: '100%',
          next: 'Begin kickoff',
          color: 'blue',
          deliverables: [
            { id: 'del-1', title: 'Audit Scope', status: 'Done', clientSignOff: true },
          ],
          invoices: [
            {
              id: 'inv-1',
              label: 'Deposit',
              amount: 22500,
              status: 'Paid',
              paidAt: '2026-09-01',
            },
          ],
        },
      ],
      companies: [
        {
          id: 'comp-legacy-1',
          name: 'Legacy Corp',
          type: 'Direct Client',
          dealsCount: 1,
          pipelineVal: '45 000 Kč',
        },
      ],
      contacts: [],
      activities: [],
      followUps: [],
    }

    const restoreReq = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(legacySnapshot),
    })

    const res = await POST(restoreReq)
    assert.equal(res.status, 200)

    // Verify converted project exists in database
    const prj = await db
      .selectFrom('projects')
      .selectAll()
      .where('deal_id', '=', 'deal-legacy-backup-1')
      .executeTakeFirst()
    assert.ok(prj)
    assert.equal(prj.title, 'Legacy Website Deal')
    assert.equal(prj.budget_minor, 4500000)

    // Milestones and Invoices created
    const ms = await db.selectFrom('project_milestones').selectAll().where('project_id', '=', prj.id).execute()
    assert.equal(ms.length, 1)
    assert.equal(ms[0].title, 'Audit Scope')
    assert.equal(ms[0].status, 'approved')

    const invs = await db.selectFrom('invoices').selectAll().where('project_id', '=', prj.id).execute()
    assert.equal(invs.length, 1)
    assert.equal(invs[0].status, 'paid')
    assert.equal(invs[0].amount_minor, 2250000)
  })

  await t.test('current-backup-rejects-paid-stage', async () => {
    const token = await createSessionToken()
    const invalidV3Snapshot = {
      version: 3,
      deals: [
        {
          id: 'deal-invalid-paid',
          title: 'Invalid Deal',
          company: 'Disallowed Corp',
          value: '10 000 Kč',
          stage: 'Paid', // Not allowed in v3+
        },
      ],
      companies: [{ id: 'comp-1', name: 'Disallowed Corp' }],
    }

    const restoreReq = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(invalidV3Snapshot),
    })

    const res = await POST(restoreReq)
    assert.equal(res.status, 400)
    const json = await res.json()
    assert.equal(json.error, 'Invalid backup payload structure')
  })

  await t.test('rejects empty backup with 400 and preserves existing workspace data', async () => {
    const token = await createSessionToken()

    const beforeRestore = await repo.getWorkspaceData()

    // 1. Attempt restore with empty object {}
    const emptyReq1 = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({}),
    })

    const res1 = await POST(emptyReq1)
    assert.equal(res1.status, 400)
    const json1 = await res1.json()
    assert.equal(json1.error, 'Invalid backup payload structure')

    // 2. Attempt restore with explicit empty arrays
    const emptyReq2 = new Request('http://localhost:3000/api/backup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        version: 3,
        deals: [],
        companies: [],
        contacts: [],
        activities: [],
        followUps: [],
      }),
    })

    const res2 = await POST(emptyReq2)
    assert.equal(res2.status, 400)

    // 3. Verify workspace data was NOT wiped
    const afterRestore = await repo.getWorkspaceData()
    assert.equal(afterRestore.deals.length, beforeRestore.deals.length)
  })
})
