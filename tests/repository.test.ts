import { describe, it, before, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'

describe('CRM Database Repository', () => {
  before(async () => {
    await ensureDbInitialized()
  })

  beforeEach(async () => {
    // Clean test tables between runs
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
  })

  describe('Database Initialization', () => {
    it('initializes tables and indexes idempotently without throwing', async () => {
      await ensureDbInitialized()
      await ensureDbInitialized()
      const data = await repo.getWorkspaceData()
      assert.deepEqual(data.deals, [])
      assert.deepEqual(data.companies, [])
      assert.deepEqual(data.contacts, [])
      assert.deepEqual(data.activities, [])
      assert.deepEqual(data.followUps, [])
    })
  })

  describe('Companies CRUD', () => {
    it('creates, updates, and deletes a company', async () => {
      const created = await repo.createCompany({
        name: 'Acme Studio',
        type: 'Client',
        contact: 'Alice Smith',
        email: 'alice@acmestudio.com',
        deals: 0,
        value: '0 Kč',
        status: 'Active',
        color: 'violet',
      })

      assert.ok(created.id.startsWith('comp-'))
      assert.equal(created.name, 'Acme Studio')
      assert.equal(created.color, 'violet')

      // Update
      const updated = await repo.updateCompany({
        ...created,
        contact: 'Alice Johnson',
        status: 'Prospect',
      })
      assert.equal(updated.contact, 'Alice Johnson')
      assert.equal(updated.status, 'Prospect')

      // Verify in workspace data
      const data = await repo.getWorkspaceData()
      assert.equal(data.companies.length, 1)
      assert.equal(data.companies[0].name, 'Acme Studio')

      // Delete
      const deleted = await repo.deleteCompany(created.id)
      assert.equal(deleted, true)

      const afterDelete = await repo.getWorkspaceData()
      assert.equal(afterDelete.companies.length, 0)
    })

    it('returns false when deleting a non-existent company', async () => {
      const result = await repo.deleteCompany('comp-does-not-exist')
      assert.equal(result, false)
    })
  })

  describe('Deals CRUD & Auto Company Metrics Sync', () => {
    it('creates a deal and auto-registers company if not present', async () => {
      const deal = await repo.createDeal({
        title: 'Brand Redesign 2026',
        company: 'Stark Industries',
        value: '150 000 Kč',
        rawAmount: 150000,
        stage: 'Lead',
        probability: '40%',
        next: 'Send contract draft',
        nextDueDate: '2026-10-01',
        color: 'amber',
        contactName: 'Tony Stark',
        contactEmail: 'tony@stark.com',
        notes: 'Initial discussion completed.',
        deliverables: [
          { id: 'del-1', title: 'Logo guidelines', status: 'Pending' },
        ],
        invoices: [
          {
            id: 'inv-1',
            type: 'Deposit',
            label: '50% Upfront',
            amount: 75000,
            formattedAmount: '75 000 Kč',
            percentage: 50,
            status: 'Draft',
          },
        ],
      })

      assert.ok(deal.id.startsWith('deal-'))
      assert.equal(deal.title, 'Brand Redesign 2026')
      assert.equal(deal.deliverables?.length, 1)
      assert.equal(deal.invoices?.length, 1)

      // Verify company was auto-created and metrics synced
      const data = await repo.getWorkspaceData()
      assert.equal(data.companies.length, 1)
      const starkComp = data.companies[0]
      assert.equal(starkComp.name, 'Stark Industries')
      assert.equal(starkComp.deals, 1)
      assert.ok(starkComp.value.includes('150 000'))
    })

    it('recalculates metrics for both old and new company when deal company changes', async () => {
      // Create first company with deal
      const deal = await repo.createDeal({
        title: 'Web Platform',
        company: 'Alpha Corp',
        value: '50 000 Kč',
        rawAmount: 50000,
        stage: 'Qualified',
        probability: '50%',
        next: 'Demo call',
        color: 'blue',
      })

      // Create a second company
      await repo.createCompany({
        name: 'Beta LLC',
        type: 'Client',
        contact: 'Bob',
        email: 'bob@beta.com',
        deals: 0,
        value: '0 Kč',
        status: 'Active',
        color: 'green',
      })

      let data = await repo.getWorkspaceData()
      let alpha = data.companies.find((c) => c.name === 'Alpha Corp')!
      let beta = data.companies.find((c) => c.name === 'Beta LLC')!
      assert.equal(alpha.deals, 1)
      assert.ok(alpha.value.includes('50 000'))
      assert.equal(beta.deals, 0)

      // Move deal from Alpha Corp to Beta LLC
      await repo.updateDeal({
        ...deal,
        company: 'Beta LLC',
      })

      data = await repo.getWorkspaceData()
      alpha = data.companies.find((c) => c.name === 'Alpha Corp')!
      beta = data.companies.find((c) => c.name === 'Beta LLC')!

      // Alpha should have 0 deals, Beta should now have 1 deal!
      assert.equal(alpha.deals, 0)
      assert.equal(alpha.value, '0 Kč')
      assert.equal(beta.deals, 1)
      assert.ok(beta.value.includes('50 000'))
    })

    it('moveDealStage sets 100% on Won and preserves custom color', async () => {
      const deal = await repo.createDeal({
        title: 'Mobile App',
        company: 'Innovatech',
        value: '80 000 Kč',
        rawAmount: 80000,
        stage: 'Quote sent',
        probability: '75%',
        next: 'Sign proposal',
        color: 'violet',
      })

      const moved = await repo.moveDealStage(deal.id, 'Won')
      assert.ok(moved)
      assert.equal(moved.stage, 'Won')
      assert.equal(moved.probability, '100%')
      assert.equal(moved.color, 'violet') // Should not be overwritten with 'blue'

      const data = await repo.getWorkspaceData()
      assert.equal(data.deals[0].stage, 'Won')
      assert.equal(data.deals[0].probability, '100%')
      assert.equal(data.deals[0].color, 'violet')
    })

    it('deleteDeal unlinks activities and follow-ups and recalculates metrics', async () => {
      const deal = await repo.createDeal({
        title: 'SEO Audit',
        company: 'Omega Corp',
        value: '20 000 Kč',
        rawAmount: 20000,
        stage: 'Lead',
        probability: '30%',
        next: 'Review site',
        color: 'green',
      })

      // Log activity linked to deal
      await repo.logActivity(
        {
          type: 'Call',
          title: 'Initial brief',
          person: 'John Omega',
          company: 'Omega Corp',
          date: '2026-09-25',
          status: 'Completed',
          color: 'blue',
          summary: 'Discussed keywords',
        },
        {
          day: 'Today',
          company: 'Omega Corp',
          action: 'Send audit report',
          time: '15:00',
          tone: 'urgent',
          completed: false,
        },
        deal.id
      )

      const preData = await repo.getWorkspaceData()
      assert.equal(preData.deals.length, 1)
      assert.equal(preData.activities[0].dealId, deal.id)

      // Delete deal
      const success = await repo.deleteDeal(deal.id)
      assert.equal(success, true)

      const postData = await repo.getWorkspaceData()
      assert.equal(postData.deals.length, 0)
      // Activity and follow-up still exist but unlinked
      assert.equal(postData.activities.length, 1)
      assert.equal(postData.activities[0].dealId, undefined)
      assert.equal(postData.followUps.length, 1)

      // Company deals count should be 0
      const company = postData.companies.find((c) => c.name === 'Omega Corp')!
      assert.equal(company.deals, 0)
      assert.equal(company.value, '0 Kč')
    })
  })

  describe('Contacts CRUD', () => {
    it('creates, updates, and deletes contact with auto-company registration', async () => {
      const contact = await repo.createContact({
        name: 'Sarah Connor',
        role: 'CTO',
        company: 'Cyberdyne',
        email: 'sarah@cyberdyne.io',
        phone: '+420 777 888 999',
        deals: 0,
        lastTouch: 'Today',
        color: 'amber',
      })

      assert.ok(contact.id.startsWith('cont-'))
      assert.equal(contact.name, 'Sarah Connor')

      // Verify Cyberdyne company auto-registered
      const data = await repo.getWorkspaceData()
      assert.ok(data.companies.some((c) => c.name === 'Cyberdyne'))

      // Update contact
      const updated = await repo.updateContact({
        ...contact,
        role: 'VP of Engineering',
        phone: '+420 111 222 333',
      })
      assert.equal(updated.role, 'VP of Engineering')
      assert.equal(updated.phone, '+420 111 222 333')

      // Delete contact
      const deleted = await repo.deleteContact(contact.id)
      assert.equal(deleted, true)

      const finalData = await repo.getWorkspaceData()
      assert.equal(finalData.contacts.length, 0)
    })
  })

  describe('Activities, Follow-ups, and Scratchpad Todos', () => {
    it('logActivity updates linked deal notes and next action', async () => {
      const deal = await repo.createDeal({
        title: 'App Design',
        company: 'DesignHub',
        value: '30 000 Kč',
        rawAmount: 30000,
        stage: 'Lead',
        probability: '30%',
        next: 'Old action',
        color: 'blue',
      })

      const res = await repo.logActivity(
        {
          type: 'Call',
          title: 'Requirement gathering',
          person: 'Eva Design',
          company: 'DesignHub',
          date: '2026-09-25',
          status: 'Completed',
          color: 'blue',
          summary: 'Client needs dark mode support.',
        },
        {
          day: 'Tomorrow',
          company: 'DesignHub',
          action: 'Send dark mode mockups',
          time: '11:00',
          tone: 'urgent',
          completed: false,
        },
        deal.id
      )

      assert.ok(res.activity.id.startsWith('act-'))
      assert.ok(res.followUp)
      assert.equal(res.followUp.action, 'Send dark mode mockups')

      assert.ok(res.updatedDeal)
      assert.equal(res.updatedDeal.next, 'Send dark mode mockups')
      assert.equal(res.updatedDeal.nextDueDate, '11:00')
      assert.ok(res.updatedDeal.notes?.includes('Requirement gathering'))
      assert.ok(res.updatedDeal.notes?.includes('Client needs dark mode support.'))
    })

    it('toggleFollowUp flips completed state', async () => {
      const items = await repo.syncTodos(['Prepare invoice'], 'Acme')
      assert.equal(items.length, 1)
      const fuId = items[0].id
      assert.equal(items[0].completed, false)

      // Toggle to true
      const state1 = await repo.toggleFollowUp(fuId)
      assert.equal(state1, true)

      let data = await repo.getWorkspaceData()
      assert.equal(data.followUps.find((f) => f.id === fuId)?.completed, true)

      // Toggle back to false
      const state2 = await repo.toggleFollowUp(fuId)
      assert.equal(state2, false)

      data = await repo.getWorkspaceData()
      assert.equal(data.followUps.find((f) => f.id === fuId)?.completed, false)
    })

    it('syncTodos creates multiple urgent follow-up items and skips empty strings', async () => {
      const todos = [
        'Call bank about wire transfer',
        '   ',
        'Review contract v2',
        '',
      ]

      const created = await repo.syncTodos(todos, 'FinanceCo')
      assert.equal(created.length, 2)
      assert.equal(created[0].action, 'Call bank about wire transfer')
      assert.equal(created[1].action, 'Review contract v2')
      assert.equal(created[0].tone, 'urgent')
    })
  })
})
