import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { createSessionToken } from '@/lib/auth/session'

import { GET as getHealth } from '@/app/api/health/route'
import {
  GET as getDeals,
  POST as postDeal,
  PUT as putDeal,
  DELETE as deleteDeal,
} from '@/app/api/deals/route'
import {
  GET as getCompanies,
  POST as postCompany,
  PUT as putCompany,
  DELETE as deleteCompany,
} from '@/app/api/companies/route'
import {
  GET as getContacts,
  POST as postContact,
  PUT as putContact,
  DELETE as deleteContact,
} from '@/app/api/contacts/route'
import {
  GET as getActivities,
  POST as postActivity,
} from '@/app/api/activities/route'
import {
  GET as getFollowUps,
  PATCH as patchFollowUp,
  POST as postFollowUps,
} from '@/app/api/follow-ups/route'

describe('API Route Handlers', () => {
  const TEST_SECRET = 'api-integration-test-secret'
  const originalSecret = process.env.AUTH_SECRET
  let validToken: string

  before(async () => {
    await ensureDbInitialized()
    process.env.AUTH_SECRET = TEST_SECRET
    validToken = createSessionToken()
  })

  after(() => {
    process.env.AUTH_SECRET = originalSecret
  })

  beforeEach(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
  })

  function createAuthedRequest(url: string, method: string = 'GET', body?: any): Request {
    return new Request(url, {
      method,
      headers: {
        Authorization: `Bearer ${validToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  function createUnauthedRequest(url: string, method: string = 'GET', body?: any): Request {
    return new Request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    })
  }

  describe('Health Check API (/api/health)', () => {
    it('returns healthy status and connected database without requiring auth', async () => {
      const res = await getHealth()
      assert.equal(res.status, 200)

      const body = await res.json()
      assert.equal(body.status, 'healthy')
      assert.equal(body.app, 'freelancer-crm')
      assert.equal(body.database, 'connected')
      assert.ok(typeof body.uptime === 'number')
    })
  })

  describe('Deals API (/api/deals)', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await getDeals(createUnauthedRequest('http://localhost:3000/api/deals'))
      assert.equal(getRes.status, 401)

      const postRes = await postDeal(createUnauthedRequest('http://localhost:3000/api/deals', 'POST', {}))
      assert.equal(postRes.status, 401)

      const putRes = await putDeal(createUnauthedRequest('http://localhost:3000/api/deals', 'PUT', {}))
      assert.equal(putRes.status, 401)

      const delRes = await deleteDeal(createUnauthedRequest('http://localhost:3000/api/deals?id=123', 'DELETE'))
      assert.equal(delRes.status, 401)
    })

    it('performs full CRUD when authenticated', async () => {
      // 1. CREATE (POST)
      const postReq = createAuthedRequest('http://localhost:3000/api/deals', 'POST', {
        title: 'New Portal',
        company: 'PortalCorp',
        value: '75 000 Kč',
        rawAmount: 75000,
        stage: 'Lead',
        probability: '30%',
        color: 'blue',
      })
      const postRes = await postDeal(postReq)
      assert.equal(postRes.status, 201)
      const createdDeal = await postRes.json()
      assert.ok(createdDeal.id)
      assert.equal(createdDeal.title, 'New Portal')

      // 2. READ (GET)
      const getReq = createAuthedRequest('http://localhost:3000/api/deals')
      const getRes = await getDeals(getReq)
      assert.equal(getRes.status, 200)
      const deals = await getRes.json()
      assert.equal(deals.length, 1)
      assert.equal(deals[0].id, createdDeal.id)

      // 3. UPDATE (PUT)
      const putReq = createAuthedRequest('http://localhost:3000/api/deals', 'PUT', {
        ...createdDeal,
        title: 'New Portal - Phase 2',
        stage: 'Proposal Sent',
      })
      const putRes = await putDeal(putReq)
      assert.equal(putRes.status, 200)
      const updatedDeal = await putRes.json()
      assert.equal(updatedDeal.title, 'New Portal - Phase 2')

      // 4. DELETE (DELETE)
      const delReq = createAuthedRequest(`http://localhost:3000/api/deals?id=${createdDeal.id}`, 'DELETE')
      const delRes = await deleteDeal(delReq)
      assert.equal(delRes.status, 200)
      const delBody = await delRes.json()
      assert.equal(delBody.success, true)

      // Verify empty
      const afterGet = await getDeals(createAuthedRequest('http://localhost:3000/api/deals'))
      const afterDeals = await afterGet.json()
      assert.equal(afterDeals.length, 0)
    })
  })

  describe('Companies API (/api/companies)', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await getCompanies(createUnauthedRequest('http://localhost:3000/api/companies'))
      assert.equal(getRes.status, 401)
    })

    it('performs full CRUD when authenticated', async () => {
      // CREATE
      const postReq = createAuthedRequest('http://localhost:3000/api/companies', 'POST', {
        name: 'Nexus Tech',
        type: 'Client',
        contact: 'Nexus Admin',
        email: 'admin@nexustech.io',
        deals: 0,
        value: '0 Kč',
        status: 'Active',
        color: 'green',
      })
      const postRes = await postCompany(postReq)
      assert.equal(postRes.status, 201)
      const company = await postRes.json()
      assert.ok(company.id)

      // READ
      const getRes = await getCompanies(createAuthedRequest('http://localhost:3000/api/companies'))
      assert.equal(getRes.status, 200)
      const list = await getRes.json()
      assert.equal(list.length, 1)

      // UPDATE
      const putReq = createAuthedRequest('http://localhost:3000/api/companies', 'PUT', {
        ...company,
        status: 'Inactive',
      })
      const putRes = await putCompany(putReq)
      assert.equal(putRes.status, 200)
      const updated = await putRes.json()
      assert.equal(updated.status, 'Inactive')

      // DELETE
      const delReq = createAuthedRequest(`http://localhost:3000/api/companies?id=${company.id}`, 'DELETE')
      const delRes = await deleteCompany(delReq)
      assert.equal(delRes.status, 200)
    })
  })

  describe('Contacts API (/api/contacts)', () => {
    it('returns 401 when unauthenticated', async () => {
      const getRes = await getContacts(createUnauthedRequest('http://localhost:3000/api/contacts'))
      assert.equal(getRes.status, 401)
    })

    it('performs full CRUD when authenticated', async () => {
      // CREATE
      const postReq = createAuthedRequest('http://localhost:3000/api/contacts', 'POST', {
        name: 'John Miller',
        role: 'Founder',
        company: 'Miller Media',
        email: 'john@millermedia.com',
        color: 'blue',
      })
      const postRes = await postContact(postReq)
      assert.equal(postRes.status, 201)
      const contact = await postRes.json()

      // READ
      const getRes = await getContacts(createAuthedRequest('http://localhost:3000/api/contacts'))
      assert.equal(getRes.status, 200)
      const list = await getRes.json()
      assert.equal(list.length, 1)

      // UPDATE
      const putReq = createAuthedRequest('http://localhost:3000/api/contacts', 'PUT', {
        ...contact,
        role: 'CEO',
      })
      const putRes = await putContact(putReq)
      assert.equal(putRes.status, 200)
      const updated = await putRes.json()
      assert.equal(updated.role, 'CEO')

      // DELETE
      const delReq = createAuthedRequest(`http://localhost:3000/api/contacts?id=${contact.id}`, 'DELETE')
      const delRes = await deleteContact(delReq)
      assert.equal(delRes.status, 200)
    })
  })

  describe('Activities & Follow-ups API', () => {
    it('logs activity via POST /api/activities and toggles follow-up via PATCH /api/follow-ups', async () => {
      const actReq = createAuthedRequest('http://localhost:3000/api/activities', 'POST', {
        activity: {
          type: 'Meeting',
          title: 'Quarterly Review',
          person: 'Alice',
          company: 'Acme',
          date: '2026-09-25',
          status: 'Done',
          color: 'blue',
        },
        followUp: {
          day: 'Tomorrow',
          company: 'Acme',
          action: 'Send presentation summary',
          time: '10:00',
          tone: 'urgent',
          completed: false,
        },
      })

      const actRes = await postActivity(actReq)
      assert.equal(actRes.status, 201)
      const actBody = await actRes.json()
      assert.ok(actBody.activity.id)
      assert.ok(actBody.followUp.id)

      // Verify follow-up in GET /api/follow-ups
      const fuGet = await getFollowUps(createAuthedRequest('http://localhost:3000/api/follow-ups'))
      const fuList = await fuGet.json()
      assert.equal(fuList.length, 1)

      // Toggle follow-up
      const patchReq = createAuthedRequest('http://localhost:3000/api/follow-ups', 'PATCH', {
        id: actBody.followUp.id,
      })
      const patchRes = await patchFollowUp(patchReq)
      assert.equal(patchRes.status, 200)
      const patchBody = await patchRes.json()
      assert.equal(patchBody.completed, true)

      // Batch sync todos via POST /api/follow-ups
      const syncReq = createAuthedRequest('http://localhost:3000/api/follow-ups', 'POST', {
        todos: ['Review design system', 'Deploy release v1.2'],
        company: 'DevHQ',
      })
      const syncRes = await postFollowUps(syncReq)
      assert.equal(syncRes.status, 201)
      const syncedItems = await syncRes.json()
      assert.equal(syncedItems.length, 2)
    })
  })
})
