import test from 'node:test'
import assert from 'node:assert/strict'
import { GET, POST } from '@/app/api/backup/route'
import { createSessionToken } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'

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
    assert.equal(data.version, '1.0')
    assert.ok(Array.isArray(data.deals))
    assert.ok(Array.isArray(data.companies))
    assert.ok(Array.isArray(data.contacts))
    assert.ok(Array.isArray(data.activities))
    assert.ok(Array.isArray(data.followUps))
  })

  await t.test('restores workspace from JSON snapshot when authenticated', async () => {
    const token = await createSessionToken()
    const snapshot = {
      version: '1.0',
      deals: [
        {
          id: 'deal-backup-1',
          title: 'Restored Test Deal',
          company: 'Backup Corp',
          value: '45 000 Kč',
          rawAmount: 45000,
          stage: 'Won',
          probability: '100%',
          next: 'Begin kickoff',
          color: 'blue',
          deliverables: [
            { id: 'del-1', title: 'Audit Scope', status: 'Done', clientSignOff: true },
          ],
        },
      ],
      companies: [
        {
          id: 'comp-backup-1',
          name: 'Backup Corp',
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
      body: JSON.stringify(snapshot),
    })

    const res = await POST(restoreReq)
    assert.equal(res.status, 200)
    const json = await res.json()
    assert.equal(json.success, true)
    assert.equal(json.restored.dealsCount, 1)

    // Verify database has restored deal
    const workspace = await repo.getWorkspaceData()
    const restored = workspace.deals.find((d) => d.id === 'deal-backup-1')
    assert.ok(restored)
    assert.equal(restored.company, 'Backup Corp')
    assert.equal(restored.stage, 'Won')
    assert.equal(restored.deliverables?.[0]?.title, 'Audit Scope')
  })
})
