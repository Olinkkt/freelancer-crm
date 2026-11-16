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

/** Assigning undefined to an env var stores the text "undefined", which would switch auth on */
function restoreSecret(value: string | undefined) {
  if (value === undefined) delete process.env.AUTH_SECRET
  else process.env.AUTH_SECRET = value
}

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
    restoreSecret(originalSecret)
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

describe('Money, dates and exports', () => {
  it('reads typed amounts without inflating decimals', async () => {
    const { parseMoneyInput, formatDealValue } = await import('@/lib/config')
    assert.equal(parseMoneyInput('25 000 Kč'), 25000)
    assert.equal(parseMoneyInput('$25,000'), 25000)
    assert.equal(parseMoneyInput('1500.50'), 1501)
    assert.equal(parseMoneyInput('$25,000.00'), 25000)
    assert.equal(parseMoneyInput('1.234,56 €'), 1235)
    assert.equal(parseMoneyInput('1.234.567'), 1234567)
    assert.equal(parseMoneyInput('45 000,5 Kč'), 45001)
    assert.equal(parseMoneyInput('1 500 Kč.'), 1500)
    assert.equal(parseMoneyInput('—'), 0)
    assert.equal(parseMoneyInput(''), 0)
    assert.equal(formatDealValue('1500.50', { currencySymbol: '$', locale: 'en-US' }), '$1,501')
  })

  it('rejects dates that do not exist instead of rolling them over', async () => {
    const { normalizeDueDate } = await import('@/lib/due-date')
    const now = new Date(2026, 10, 16) // Monday
    assert.equal(normalizeDueDate('2026-02-28', now), '2026-02-28')
    assert.equal(normalizeDueDate('2026-11-20T10:00:00.000Z', now), '2026-11-20')
    assert.equal(normalizeDueDate('2026-02-31', now), null)
    assert.equal(normalizeDueDate('2026-13-01', now), null)
    assert.equal(normalizeDueDate('45.13.', now), null)
    assert.equal(normalizeDueDate('22.9.', now), '2026-09-22')
    // An explicit date wins over the weekday abbreviation next to it
    assert.equal(normalizeDueDate('po 23. 11. 2026', now), '2026-11-23')
    assert.equal(normalizeDueDate('pátek', now), '2026-11-20')
  })

  it('CSV export defuses formulas but keeps phone numbers and amounts', async () => {
    const { generateCSV } = await import('@/lib/csv-export')
    const csv = generateCSV(
      [{ name: '=HYPERLINK("http://evil","x")', phone: '+420 111 222 333', note: '-2+3', at: '@SUM(A1)', amount: -5 }],
      ['name', 'phone', 'note', 'at', 'amount'].map((key) => ({ key: key as 'name', label: key }))
    )
    const row = csv.split('\n')[1]
    assert.ok(row.startsWith(`"'=HYPERLINK`))
    assert.ok(row.includes('"+420 111 222 333"'))
    assert.ok(row.includes('"-2+3"'))
    assert.ok(row.includes(`"'@SUM(A1)"`))
    assert.ok(row.endsWith('"-5"'))
  })

  it('a backup file cannot set the passcode', () => {
    const parsed = BackupPayloadSchema.parse({
      contacts: [{ id: 'c1', name: 'A' }],
      settings: { operatorName: 'X', passcodeHash: 'scrypt:aa:bb' },
    })
    assert.equal((parsed.settings as Record<string, unknown>).passcodeHash, undefined)
    assert.equal(parsed.settings?.operatorName, 'X')
  })
})

describe('Login attempt limit', () => {
  it('pauses a client after five wrong passcodes and doubles the pause', async () => {
    const t = await import('@/lib/auth/login-throttle')
    t.resetLoginThrottle()
    const now = 1_000_000
    for (let i = 0; i < 4; i++) t.recordLoginFailure('1.2.3.4', now)
    assert.equal(t.loginRetryAfter('1.2.3.4', now), 0)
    t.recordLoginFailure('1.2.3.4', now)
    assert.equal(t.loginRetryAfter('1.2.3.4', now), 30)
    assert.equal(t.loginRetryAfter('5.6.7.8', now), 0, 'other clients are not affected')
    assert.equal(t.loginRetryAfter('1.2.3.4', now + 31_000), 0)
    t.recordLoginFailure('1.2.3.4', now + 31_000)
    assert.equal(t.loginRetryAfter('1.2.3.4', now + 31_000), 60)
    t.recordLoginSuccess('1.2.3.4')
    assert.equal(t.loginRetryAfter('1.2.3.4', now + 31_000), 0)
    t.resetLoginThrottle()
  })

  it('pauses everyone briefly when guesses come from many addresses', async () => {
    const t = await import('@/lib/auth/login-throttle')
    t.resetLoginThrottle()
    const now = 2_000_000
    for (let i = 0; i < 30; i++) t.recordLoginFailure(`10.0.0.${i}`, now)
    assert.equal(t.loginRetryAfter('192.168.1.1', now), 60)
    assert.equal(t.loginRetryAfter('192.168.1.1', now + 61_000), 0)
    t.resetLoginThrottle()
  })

  it('loginOperator refuses further guesses once the limit is hit', async () => {
    const { loginOperator } = await import('@/app/actions/auth')
    const t = await import('@/lib/auth/login-throttle')
    const original = process.env.AUTH_SECRET
    process.env.AUTH_SECRET = 'throttle-test-secret'
    t.resetLoginThrottle()
    try {
      for (let i = 0; i < 5; i++) assert.equal((await loginOperator('nope')).error, 'Incorrect operator passcode.')
      const blocked = await loginOperator('throttle-test-secret')
      assert.equal(blocked.success, false)
      assert.match(blocked.error ?? '', /Too many wrong passcodes/)
      t.resetLoginThrottle()
      assert.equal((await loginOperator('throttle-test-secret')).success, true)
    } finally {
      restoreSecret(original)
      t.resetLoginThrottle()
    }
  })
})

describe('Server actions check their input', () => {
  it('reject a bad stage, a negative amount and an empty title', async () => {
    const { createDealAction } = await import('@/app/actions/crm')
    const base = { title: 'Site', value: '', rawAmount: 100, stage: 'Lead', next: 'Call', color: 'blue', contactName: 'Jana' }
    await assert.rejects(() => createDealAction({ ...base, stage: 'Paid' } as any), /stage/)
    await assert.rejects(() => createDealAction({ ...base, rawAmount: -5 } as any), /cannot be negative/)
    await assert.rejects(() => createDealAction({ ...base, title: '   ' } as any), /Title is required/)
    await assert.rejects(() => createDealAction({ ...base, title: { $ne: 1 } } as any), /title/)
  })

  it('keep createdAt and drop unknown fields when a deal is edited', async () => {
    const { createDealAction, updateDealAction, deleteDealAction } = await import('@/app/actions/crm')
    const deal = await createDealAction({
      title: 'Site', value: '', rawAmount: 100, stage: 'Lead', next: 'Call', nextDueDate: '2030-01-15', color: 'blue', contactName: 'Jana',
    } as any)
    const saved = await updateDealAction({ ...deal, title: 'Site v2', bogus: true } as any)
    assert.equal(saved.title, 'Site v2')
    assert.equal(saved.createdAt, deal.createdAt)
    assert.equal((saved as any).bogus, undefined)
    await deleteDealAction(deal.id)
    await db.deleteFrom('contacts').execute()
  })
})
