import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { createSessionToken } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { BackupPayloadSchema } from '@/lib/validations'
import { foldIcsLine, generateIcsCalendar } from '@/lib/calendar/ical-generator'
import { PUT as putDeal } from '@/app/api/deals/route'
import { PUT as putContact } from '@/app/api/contacts/route'
import type { Deal } from '@/lib/crm-types'

describe('Partial updates and restore keep existing data', () => {
  const originalSecret = process.env.AUTH_SECRET
  let token: string

  const wipe = async () => {
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
  }

  before(async () => {
    await ensureDbInitialized()
    process.env.AUTH_SECRET = 'review-fixes-test-secret'
    token = createSessionToken()
  })
  beforeEach(wipe)
  after(async () => {
    process.env.AUTH_SECRET = originalSecret
    await wipe()
  })

  const put = (path: string, body: unknown) =>
    new Request(`http://localhost:3000${path}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })

  const seedDeal = () =>
    repo.createDeal({
      title: 'Portfolio website',
      value: '',
      rawAmount: 45000,
      stage: 'Proposal',
      next: 'Send proposal',
      nextDueDate: '2030-01-15',
      color: 'blue',
      contactName: 'Jana Nováková',
      contactEmail: 'jana@example.com',
      notes: 'Wants a dark theme',
      deliverables: [{ id: 't1', title: 'Homepage', status: 'Pending' }],
      invoices: [],
    } as Omit<Deal, 'id'>)

  it('PUT /api/deals with only a stage leaves every other field alone', async () => {
    const deal = await seedDeal()
    const res = await putDeal(put('/api/deals', { id: deal.id, stage: 'Closed' }))
    assert.equal(res.status, 200)

    const saved = await repo.getDealById(deal.id)
    assert.equal(saved?.stage, 'Closed')
    assert.equal(saved?.title, 'Portfolio website')
    assert.equal(saved?.rawAmount, 45000)
    assert.equal(saved?.next, 'Send proposal')
    assert.equal(saved?.nextDueDate, '2030-01-15')
    assert.equal(saved?.notes, 'Wants a dark theme')
    assert.equal(saved?.deliverables?.length, 1)
    assert.equal(saved?.contactName, 'Jana Nováková')
  })

  it('PUT /api/deals with a new client name moves the deal to that client', async () => {
    const deal = await seedDeal()
    const res = await putDeal(put('/api/deals', { id: deal.id, contactName: 'Petr Svoboda' }))
    assert.equal(res.status, 200)
    const saved = await repo.getDealById(deal.id)
    assert.equal(saved?.contactName, 'Petr Svoboda')
    assert.notEqual(saved?.contactId, deal.contactId)
    assert.equal(saved?.next, 'Send proposal')
  })

  it('PUT /api/deals returns 404 for an unknown id', async () => {
    const res = await putDeal(put('/api/deals', { id: 'deal-missing', stage: 'Closed' }))
    assert.equal(res.status, 404)
  })

  it('PUT /api/contacts with only notes keeps phone, email and the email on deals', async () => {
    const deal = await seedDeal()
    const { contacts } = await repo.getWorkspaceData()
    const client = contacts.find((c) => c.id === deal.contactId)!
    await repo.updateContact({ ...client, phone: '+420 111 222 333' })

    const res = await putContact(put('/api/contacts', { id: client.id, notes: 'Pays on time' }))
    assert.equal(res.status, 200)

    const after = (await repo.getWorkspaceData()).contacts.find((c) => c.id === client.id)!
    assert.equal(after.notes, 'Pays on time')
    assert.equal(after.phone, '+420 111 222 333')
    assert.equal(after.email, 'jana@example.com')
    assert.equal((await repo.getDealById(deal.id))?.contactEmail, 'jana@example.com')
  })

  it('PUT /api/contacts ignores fields that are not part of a client', async () => {
    const deal = await seedDeal()
    const res = await putContact(put('/api/contacts', { id: deal.contactId, name: 'Jana N.', color: 'green', bogus: 1 }))
    assert.equal(res.status, 200)
    const body = await res.json()
    assert.equal(body.name, 'Jana N.')
    assert.equal(body.bogus, undefined)
  })

  it('counts a client\'s deals from the deals table', async () => {
    const deal = await seedDeal()
    await repo.createDeal({ ...(await repo.getDealById(deal.id))!, title: 'Second project' })
    const { contacts } = await repo.getWorkspaceData()
    assert.equal(contacts.find((c) => c.id === deal.contactId)?.deals, 2)
  })

  it('restore keeps each deal\'s createdAt and updatedAt', async () => {
    const payload = BackupPayloadSchema.parse({
      deals: [
        { id: 'd-old', title: 'Old', stage: 'Lead', contactName: 'A', createdAt: '2024-03-01T10:00:00.000Z', updatedAt: '2024-04-01T10:00:00.000Z' },
        { id: 'd-new', title: 'New', stage: 'Lead', contactName: 'A', createdAt: '2025-06-01T10:00:00.000Z' },
        { id: 'd-none', title: 'Legacy backup without dates', stage: 'Won', contactName: 'A' },
      ],
    })
    await repo.restoreWorkspaceData(payload as any)
    const { deals } = await repo.getWorkspaceData()
    const byId = Object.fromEntries(deals.map((d) => [d.id, d]))
    assert.equal(byId['d-old'].createdAt, '2024-03-01T10:00:00.000Z')
    assert.equal(byId['d-old'].updatedAt, '2024-04-01T10:00:00.000Z')
    assert.equal(byId['d-new'].updatedAt, '2025-06-01T10:00:00.000Z')
    assert.ok(byId['d-none'].createdAt)
    // Newest first, as before the backup
    assert.ok(deals.findIndex((d) => d.id === 'd-new') < deals.findIndex((d) => d.id === 'd-old'))
  })

  it('moveDealStage returns the fresh updatedAt', async () => {
    const deal = await seedDeal()
    const moved = await repo.moveDealStage(deal.id, 'Closed')
    assert.equal(moved?.stage, 'Closed')
    assert.ok(moved?.updatedAt)
    assert.equal(moved?.deliverables?.length, 1)
  })
})

describe('Calendar feed', () => {
  it('folds by bytes and never splits a multi-byte character', () => {
    const line = 'SUMMARY:' + 'Příliš žluťoučký kůň úpěl ďábelské ódy 🎉 '.repeat(6)
    const folded = foldIcsLine(line)
    for (const part of folded.split('\r\n')) {
      assert.ok(Buffer.byteLength(part, 'utf8') <= 75, `line is ${Buffer.byteLength(part, 'utf8')} bytes`)
    }
    assert.equal(folded.replace(/\r\n /g, ''), line)
  })

  it('leaves out deals that are waiting on the client', () => {
    const base = { title: 'Site', value: '1', rawAmount: 1, stage: 'Build', color: 'blue', contactName: 'Jana', nextDueDate: '2030-01-15' }
    const ics = generateIcsCalendar({
      deals: [
        { ...base, id: 'a', next: 'Ship homepage' },
        { ...base, id: 'b', next: 'Stale action', waiting: true },
      ] as Deal[],
    })
    assert.match(ics, /Ship homepage/)
    assert.doesNotMatch(ics, /Stale action/)
  })
})
