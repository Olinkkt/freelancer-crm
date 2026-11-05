import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { createSessionToken } from '@/lib/auth/session'
import { createApiToken, listAuditLog, revokeApiToken, verifyApiToken } from '@/lib/db/api-tokens'
import { resetRateLimits } from '@/lib/api/rate-limit'
import { handleRest } from '@/lib/api/rest'

const BASE = 'http://localhost/api/v1'

async function wipe() {
  await db.deleteFrom('api_audit_log').execute()
  await db.deleteFrom('api_tokens').execute()
  await db.deleteFrom('follow_ups').execute()
  await db.deleteFrom('deals').execute()
  await db.deleteFrom('contacts').execute()
}

describe('API v1', () => {
  const originalSecret = process.env.AUTH_SECRET
  let readToken: string
  let writeToken: string

  before(async () => {
    await ensureDbInitialized()
    process.env.AUTH_SECRET = 'api-v1-test-secret'
  })

  after(async () => {
    process.env.AUTH_SECRET = originalSecret
    await wipe()
  })

  beforeEach(async () => {
    await wipe()
    resetRateLimits()
    readToken = (await createApiToken({ name: 'reader', scopes: ['read'] })).plaintext
    writeToken = (await createApiToken({ name: 'writer', scopes: ['read', 'write'] })).plaintext
  })

  async function call(method: string, path: string, opts: { token?: string | null; body?: unknown; headers?: Record<string, string> } = {}) {
    const token = opts.token === undefined ? writeToken : opts.token
    const url = new URL(BASE + path)
    const req = new Request(url, {
      method,
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        'Content-Type': 'application/json',
        ...opts.headers,
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    })
    const segments = url.pathname.replace('/api/v1/', '').split('/').filter(Boolean)
    const res = await handleRest(req, segments)
    return { status: res.status, headers: res.headers, body: await res.json() }
  }

  async function makeDeal(over: Record<string, unknown> = {}) {
    const res = await call('POST', '/deals', {
      body: { title: 'Website', contactName: 'Jana', next: 'Send proposal', nextDueDate: '2026-11-20', rawAmount: 40000, ...over },
    })
    assert.equal(res.status, 201, JSON.stringify(res.body))
    return res.body
  }

  describe('tokens', () => {
    it('stores only a hash and verifies the plaintext', async () => {
      const { token, plaintext } = await createApiToken({ name: 'x', scopes: ['read'] })
      assert.ok(plaintext.startsWith('fcrm_'))
      const row = await db.selectFrom('api_tokens').selectAll().where('id', '=', token.id).executeTakeFirstOrThrow()
      assert.notEqual(row.token_hash, plaintext)
      assert.ok(!JSON.stringify(row).includes(plaintext))
      assert.equal((await verifyApiToken(plaintext))?.id, token.id)
    })

    it('rejects revoked tokens with 401', async () => {
      const { token, plaintext } = await createApiToken({ name: 'old', scopes: ['read'] })
      await revokeApiToken(token.id)
      const res = await call('GET', '/today', { token: plaintext })
      assert.equal(res.status, 401)
      assert.equal(res.body.error.code, 'unauthorized')
    })

    it('rejects missing credentials and the raw AUTH_SECRET', async () => {
      assert.equal((await call('GET', '/today', { token: null })).status, 401)
      assert.equal((await call('GET', '/today', { token: 'api-v1-test-secret' })).status, 401)
    })

    it('accepts the browser session cookie', async () => {
      const cookie = `crm_operator_session=${createSessionToken()}`
      const res = await call('GET', '/workspace', { token: null, headers: { cookie } })
      assert.equal(res.status, 200)
    })

    it('blocks writes with a read token (403)', async () => {
      const res = await call('POST', '/deals', { token: readToken, body: { title: 'X', contactName: 'Y', waiting: true } })
      assert.equal(res.status, 403)
      assert.equal(res.body.error.code, 'insufficient_scope')
      assert.equal(await db.selectFrom('deals').select('id').executeTakeFirst(), undefined)
    })
  })

  describe('operations', () => {
    it('creates a deal and reads it back', async () => {
      const deal = await makeDeal()
      assert.equal(deal.stage, 'Lead')
      assert.equal(deal.contactName, 'Jana')
      assert.match(deal.value, /40/)
      const got = await call('GET', `/deals/${deal.id}`, { token: readToken })
      assert.equal(got.body.title, 'Website')
    })

    it('enforces the next-action rule with a hint', async () => {
      const res = await call('POST', '/deals', { body: { title: 'No next', contactName: 'Jana' } })
      assert.equal(res.status, 400)
      assert.equal(res.body.error.code, 'validation_failed')
      assert.equal(res.body.error.field, 'next')
      assert.ok(res.body.error.hint)
      const ok = await call('POST', '/deals', { body: { title: 'Waiting', contactName: 'Jana', waiting: true } })
      assert.equal(ok.status, 201)
    })

    it('understands natural due dates and rejects nonsense', async () => {
      const deal = await makeDeal({ nextDueDate: 'tomorrow' })
      assert.match(deal.nextDueDate, /^\d{4}-\d{2}-\d{2}$/)
      const bad = await call('POST', `/deals/${deal.id}/next-action`, { body: { next: 'Call', nextDueDate: 'whenever' } })
      assert.equal(bad.status, 400)
      assert.equal(bad.body.error.field, 'nextDueDate')
    })

    it('advances to the next stage and to a given stage', async () => {
      const deal = await makeDeal()
      const one = await call('POST', `/deals/${deal.id}/stage`, { body: {} })
      assert.equal(one.body.stage, 'Qualified')
      const closed = await call('POST', `/deals/${deal.id}/stage`, { body: { stage: 'Closed', next: 'Send deposit invoice', nextDueDate: '2026-11-21' } })
      assert.equal(closed.body.stage, 'Closed')
      assert.equal(closed.body.next, 'Send deposit invoice')
    })

    it('sets and clears waiting', async () => {
      const deal = await makeDeal()
      const w = await call('POST', `/deals/${deal.id}/waiting`, { body: { waiting: true } })
      assert.equal(w.body.waiting, true)
      assert.ok(w.body.waitingSince)
      const back = await call('POST', `/deals/${deal.id}/waiting`, { body: { waiting: false } })
      assert.equal(back.body.waiting, false)
    })

    it('adds, moves and deletes tasks', async () => {
      const deal = await makeDeal()
      const added = await call('POST', `/deals/${deal.id}/tasks`, { body: { title: 'Homepage' } })
      assert.equal(added.status, 201)
      const taskId = added.body.task.id
      const moved = await call('PATCH', `/deals/${deal.id}/tasks/${taskId}`, { body: { column: 'done' } })
      assert.equal(moved.body.task.status, 'Done')
      assert.equal(moved.body.task.column, 'done')
      const bad = await call('PATCH', `/deals/${deal.id}/tasks/${taskId}`, { body: { column: 'nowhere' } })
      assert.equal(bad.status, 400)
      const del = await call('DELETE', `/deals/${deal.id}/tasks/${taskId}`)
      assert.equal(del.body.deleted, true)
      const after = await call('GET', `/deals/${deal.id}`)
      assert.equal(after.body.deliverables.length, 0)
    })

    it('appends notes with a date stamp', async () => {
      const deal = await makeDeal({ notes: 'First' })
      const res = await call('POST', `/deals/${deal.id}/notes`, { body: { text: 'Second' } })
      assert.match(res.body.notes, /^First\n\n\*\*\d{4}-\d{2}-\d{2}\*\* Second$/)
    })

    it('adds an invoice by percentage and marks it paid', async () => {
      const deal = await makeDeal({ rawAmount: 40000 })
      const inv = await call('POST', `/deals/${deal.id}/invoices`, { body: { type: 'Deposit', percentage: 50 } })
      assert.equal(inv.body.invoice.amount, 20000)
      const paid = await call('PATCH', `/deals/${deal.id}/invoices/${inv.body.invoice.id}`, { body: { status: 'Paid' } })
      assert.equal(paid.body.invoice.status, 'Paid')
      assert.ok(paid.body.invoice.paidAt)
    })

    it('creates clients and refuses duplicate emails', async () => {
      const c = await call('POST', '/clients', { body: { name: 'Petr', email: 'petr@example.com' } })
      assert.equal(c.status, 201)
      const dupe = await call('POST', '/clients', { body: { name: 'Petr 2', email: 'PETR@example.com' } })
      assert.equal(dupe.status, 409)
      assert.match(dupe.body.error.hint, new RegExp(c.body.id))
    })

    it('lists, filters and paginates deals', async () => {
      await makeDeal({ title: 'A' })
      await makeDeal({ title: 'B', stage: 'Build' })
      await makeDeal({ title: 'C', stage: 'Build' })
      const pm = await call('GET', '/deals?side=pm', { token: readToken })
      assert.equal(pm.body.items.length, 2)
      const byStage = await call('GET', '/deals?stage=Lead,Qualified', { token: readToken })
      assert.equal(byStage.body.items.length, 1)
      const p1 = await call('GET', '/deals?limit=2', { token: readToken })
      assert.equal(p1.body.items.length, 2)
      assert.ok(p1.body.nextCursor)
      const p2 = await call('GET', `/deals?limit=2&cursor=${p1.body.nextCursor}`, { token: readToken })
      assert.equal(p2.body.items.length, 1)
      assert.equal(p2.body.nextCursor, null)
    })

    it('searches deals and clients', async () => {
      await makeDeal({ title: 'Portfolio website', contactName: 'Jana Nováková' })
      const res = await call('GET', '/search?q=portfolio', { token: readToken })
      assert.equal(res.body.results[0].type, 'deal')
      assert.equal(res.body.results[0].title, 'Portfolio website')
    })

    it('returns today and projects', async () => {
      await makeDeal({ title: 'Overdue', nextDueDate: '2020-01-01' })
      await makeDeal({ title: 'Project', stage: 'Build' })
      const today = await call('GET', '/today', { token: readToken })
      assert.equal(today.status, 200)
      assert.equal(today.body.due[0].detail.startsWith('Overdue'), true)
      assert.equal(today.body.due[0].tone, 'overdue')
      const projects = await call('GET', '/projects', { token: readToken })
      assert.equal(projects.body.projects.length, 1)
      assert.equal(projects.body.projects[0].title, 'Project')
    })

    it('never leaks secrets from get_workspace', async () => {
      const res = await call('GET', '/workspace', { token: readToken })
      const text = JSON.stringify(res.body)
      assert.ok(!/passcode|hash|calendarFeedToken/i.test(text))
    })

    it('returns 404 with a hint for unknown deals and endpoints', async () => {
      const res = await call('GET', '/deals/nope', { token: readToken })
      assert.equal(res.status, 404)
      assert.ok(res.body.error.hint)
      assert.equal((await call('GET', '/nothing-here', { token: readToken })).status, 404)
      assert.equal((await call('PUT', '/deals', { token: readToken })).status, 405)
    })
  })

  describe('audit, dry run, idempotency', () => {
    it('audits writes but not reads', async () => {
      const deal = await makeDeal()
      await call('GET', `/deals/${deal.id}`)
      await call('POST', `/deals/${deal.id}/stage`, { body: {} })
      const log = await listAuditLog()
      assert.deepEqual(log.map((e) => e.operation).sort(), ['advance_deal_stage', 'create_deal'])
      const move = log.find((e) => e.operation === 'advance_deal_stage')!
      assert.equal((move.before as any).stage, 'Lead')
      assert.equal((move.after as any).stage, 'Qualified')
      assert.equal(move.entityId, deal.id)
      assert.ok(move.tokenId)
    })

    it('dry run saves nothing but is logged as dry run', async () => {
      const deal = await makeDeal()
      const res = await call('POST', `/deals/${deal.id}/stage?dry_run=true`, { body: { stage: 'Closed' } })
      assert.equal(res.status, 200)
      assert.equal(res.headers.get('x-dry-run'), 'true')
      assert.equal(res.body.stage, 'Closed')
      const stored = await call('GET', `/deals/${deal.id}`)
      assert.equal(stored.body.stage, 'Lead')
      const created = await call('POST', '/deals', { body: { title: 'Preview', contactName: 'Z', waiting: true, dryRun: true } })
      assert.equal(created.body.id, 'dry-run')
      assert.equal((await db.selectFrom('deals').select('id').execute()).length, 1)
      const log = await listAuditLog()
      assert.equal(log.filter((e) => e.dryRun).length, 2)
    })

    it('replays an idempotent retry once', async () => {
      const body = { title: 'Once', contactName: 'Jana', waiting: true }
      const headers = { 'Idempotency-Key': 'abc-123' }
      const first = await call('POST', '/deals', { body, headers })
      const second = await call('POST', '/deals', { body, headers })
      assert.equal(second.headers.get('idempotent-replayed'), 'true')
      assert.equal(second.body.id, first.body.id)
      assert.equal((await db.selectFrom('deals').select('id').execute()).length, 1)
      const other = await call('POST', `/deals/${first.body.id}/notes`, { body: { text: 'x' }, headers })
      assert.equal(other.status, 409)
    })
  })
})
