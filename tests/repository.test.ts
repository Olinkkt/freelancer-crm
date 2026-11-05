import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'

describe('CRM Database Repository', () => {
  before(async () => {
    await ensureDbInitialized()
  })

  after(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('workspace_settings').execute()
  })

  beforeEach(async () => {
    // Clean test tables between runs
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('workspace_settings').execute()
  })

  describe('Database Initialization', () => {
    it('initializes tables and indexes idempotently without throwing', async () => {
      await ensureDbInitialized()
      await ensureDbInitialized()
      const data = await repo.getWorkspaceData()
      assert.deepEqual(data.deals, [])
      assert.deepEqual(data.contacts, [])
      assert.deepEqual(data.activities, [])
      assert.deepEqual(data.followUps, [])
    })
  })

  describe('Deals CRUD', () => {
    it('creates a deal with deliverables and invoices', async () => {
      const deal = await repo.createDeal({
        title: 'Brand Redesign 2026',
        value: '150 000 Kč',
        rawAmount: 150000,
        stage: 'Lead',
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

      // A deal without an existing client creates and links one
      assert.ok(deal.contactId)
      const data = await repo.getWorkspaceData()
      const client = data.contacts.find((c) => c.id === deal.contactId)
      assert.ok(client)
      assert.equal(client.name, 'Tony Stark')
      assert.equal(client.email, 'tony@stark.com')
    })

    it('links a deal to an existing client by id and rejects deals without a client', async () => {
      const client = await repo.createContact({
        name: 'Pepper Potts',
        email: 'pepper@example.com',
        deals: 0,
        lastTouch: 'Today',
        color: 'blue',
      })
      const deal = await repo.createDeal({
        title: 'Retainer',
        contactId: client.id,
        contactName: '',
        value: '10 000 Kč',
        rawAmount: 10000,
        stage: 'Lead',
        next: '',
        color: 'blue',
      })
      assert.equal(deal.contactId, client.id)
      assert.equal(deal.contactName, 'Pepper Potts')

      // Renaming the client updates the deal's client name
      await repo.updateContact({ ...client, name: 'Virginia Potts' })
      const renamed = await repo.getDealById(deal.id)
      assert.equal(renamed?.contactName, 'Virginia Potts')

      // Clients with deals cannot be deleted
      await assert.rejects(() => repo.deleteContact(client.id), /still has deals/)

      await assert.rejects(
        () =>
          repo.createDeal({
            title: 'Orphan',
            contactName: '',
            value: '0',
            rawAmount: 0,
            stage: 'Lead',
            next: '',
            color: 'blue',
          }),
        /Client is required/
      )
    })

    it('moveDealStage sets 100% on Won and preserves custom color', async () => {
      const deal = await repo.createDeal({
        title: 'Mobile App',
        contactName: 'Innovatech',
        value: '80 000 Kč',
        rawAmount: 80000,
        stage: 'Proposal',
        next: 'Sign proposal',
        color: 'violet',
      })

      const moved = await repo.moveDealStage(deal.id, 'Won')
      assert.ok(moved)
      assert.equal(moved.stage, 'Won')
      assert.equal(moved.color, 'violet') // Should not be overwritten with 'blue'

      const data = await repo.getWorkspaceData()
      assert.equal(data.deals[0].stage, 'Won')
      assert.equal(data.deals[0].color, 'violet')
    })

    it('moveDealStage sets 100% and clears next on Paid stage', async () => {
      const deal = await repo.createDeal({
        title: 'API Integration',
        contactName: 'Fintech Co',
        value: '60 000 Kč',
        rawAmount: 60000,
        stage: 'Won',
        next: 'Deliver milestones',
        color: 'green',
        invoices: [
          {
            id: 'inv-1',
            type: 'Final',
            label: 'Final invoice',
            amount: 60000,
            formattedAmount: '60 000 Kč',
            percentage: 100,
            status: 'Sent',
            dueDate: 'End of month',
          },
        ],
      })

      const paid = await repo.moveDealStage(deal.id, 'Paid')
      assert.ok(paid)
      assert.equal(paid.stage, 'Paid')
      assert.equal(paid.next, '')
      assert.equal(paid.nextDueDate, undefined)
      assert.equal(paid.invoices?.[0]?.status, 'Sent')
    })

    it('deleteDeal unlinks activities and follow-ups', async () => {
      const deal = await repo.createDeal({
        title: 'SEO Audit',
        contactName: 'Omega Corp',
        value: '20 000 Kč',
        rawAmount: 20000,
        stage: 'Lead',
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

    })

    it('retrieves a deal by ID or slug and fetches linked activities', async () => {
      const deal = await repo.createDeal({
        title: 'Full Stack App Development',
        contactName: 'Stripe Europe',
        value: '180 000 Kč',
        rawAmount: 180000,
        stage: 'Qualified',
        next: 'Send technical proposal',
        color: 'blue',
      })

      // Fetch by exact ID
      const byId = await repo.getDealById(deal.id)
      assert.ok(byId)
      assert.equal(byId.id, deal.id)
      assert.equal(byId.title, 'Full Stack App Development')

      // Fetch by slug / title match
      const bySlug = await repo.getDealById('full-stack-app-development')
      assert.ok(bySlug)
      assert.equal(bySlug.id, deal.id)

      // Log an activity linked to deal
      await repo.logActivity({
        dealId: deal.id,
        type: 'Call',
        title: 'Technical Scope Sync',
        person: 'Tech Lead',
        company: 'Stripe Europe',
        date: 'Today',
        status: 'Completed',
        color: 'blue',
        summary: 'Discussed API endpoints and schemas',
      })

      const acts = await repo.getDealActivities(deal.id)
      assert.equal(acts.length, 1)
      assert.equal(acts[0].title, 'Technical Scope Sync')
      assert.equal(acts[0].dealId, deal.id)
    })
  })

  describe('Contacts CRUD', () => {
    it('creates, updates, and deletes a contact', async () => {
      const contact = await repo.createContact({
        name: 'Sarah Connor',
        email: 'sarah@cyberdyne.io',
        phone: '+420 777 888 999',
        deals: 0,
        lastTouch: 'Today',
        color: 'amber',
      })

      assert.ok(contact.id.startsWith('cont-'))
      assert.equal(contact.name, 'Sarah Connor')

      // Update contact
      const updated = await repo.updateContact({
        ...contact,
        notes: 'Prefers async updates',
        phone: '+420 111 222 333',
      })
      assert.ok(updated)
      assert.equal(updated.notes, 'Prefers async updates')
      assert.equal(updated.phone, '+420 111 222 333')

      // Delete contact
      const deleted = await repo.deleteContact(contact.id)
      assert.equal(deleted, true)

      const finalData = await repo.getWorkspaceData()
      assert.equal(finalData.contacts.length, 0)
    })

    it('creates a client without notes and persists notes on update', async () => {
      const contact = await repo.createContact({
        name: 'Kyle Reese',
        email: 'kyle@resistance.org',
        deals: 0,
        lastTouch: 'Today',
        color: 'blue',
      })

      await repo.updateContact({ ...contact, notes: 'Met at a meetup' })

      const data = await repo.getWorkspaceData()
      const found = data.contacts.find((c) => c.id === contact.id)
      assert.ok(found)
      assert.equal(found.notes, 'Met at a meetup')
      assert.equal('company' in found, false)

      await repo.deleteContact(contact.id)
    })
  })

  describe('Activities, Follow-ups, and Scratchpad Todos', () => {
    it('logActivity updates linked deal notes and next action', async () => {
      const deal = await repo.createDeal({
        title: 'App Design',
        contactName: 'DesignHub',
        value: '30 000 Kč',
        rawAmount: 30000,
        stage: 'Lead',
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
      // follow-up time-of-day is not a date, so the deal's due date is left alone
      assert.equal(res.updatedDeal.nextDueDate, undefined)
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
