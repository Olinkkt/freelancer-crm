import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import type { AddressInfo } from 'node:net'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'
import { fieldsToUpdate, findInvoicerMatch, normalizeInvoicerUrl } from '@/lib/invoicer/match'
import {
  connectInvoicer,
  disconnectInvoicer,
  getInvoicerStatus,
  syncAllContactsToInvoicer,
  syncContactToInvoicer,
} from '@/lib/invoicer/sync'

describe('invoicer matching rules', () => {
  const clients = [
    { id: 'a', name: 'Jana Nováková', email: 'jana@example.com', phone: '' },
    { id: 'b', name: 'Petr Malý', email: '', phone: '' },
    { id: 'c', name: 'Petr Malý', email: 'petr@other.cz', phone: '' },
  ]

  it('prefers the remembered id, then email, then name without email', () => {
    assert.equal(findInvoicerMatch({ id: '1', name: 'X', invoicerClientId: 'c' }, clients)?.id, 'c')
    assert.equal(findInvoicerMatch({ id: '1', name: 'Someone', email: ' JANA@example.com ' }, clients)?.id, 'a')
    assert.equal(findInvoicerMatch({ id: '1', name: 'petr  malý' }, clients)?.id, 'b')
  })

  it('never matches by name when the emails differ', () => {
    assert.equal(findInvoicerMatch({ id: '1', name: 'Petr Malý', email: 'petr@new.cz' }, clients), null)
  })

  it('skips clients already linked to someone else', () => {
    assert.equal(findInvoicerMatch({ id: '1', name: 'Jana', email: 'jana@example.com' }, clients, new Set(['a'])), null)
  })

  it('patches only what changed', () => {
    assert.deepEqual(fieldsToUpdate({ id: '1', name: 'Jana Nováková', email: 'jana@example.com', phone: '+420 1' }, clients[0]), { phone: '+420 1' })
    assert.deepEqual(fieldsToUpdate({ id: '1', name: 'Jana Nováková', email: 'jana@example.com' }, clients[0]), {})
  })

  it('normalises the address', () => {
    assert.equal(normalizeInvoicerUrl('localhost:3100/'), 'http://localhost:3100')
    assert.equal(normalizeInvoicerUrl('https://inv.example.com/api/v1/'), 'https://inv.example.com')
  })
})

/** A tiny stand-in for the Invoicer's /api/v1/clients */
function fakeInvoicer() {
  const clients: { id: string; name: string; email: string; phone: string; address: string }[] = []
  const calls: string[] = []
  let n = 0
  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    const body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}
    const url = new URL(req.url!, 'http://x')
    calls.push(`${req.method} ${url.pathname}${url.search}`)
    const send = (status: number, data: unknown) => {
      res.writeHead(status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(data))
    }
    if (req.headers.authorization !== 'Bearer finv_good_secret_123') return send(401, { error: { code: 'unauthorized', message: 'Bad token' } })
    if (req.method === 'GET' && url.pathname === '/api/v1/clients') return send(200, { items: clients })
    if (req.method === 'POST' && url.pathname === '/api/v1/clients') {
      if (body.dryRun) return send(200, { id: 'dry-run', ...body })
      const c = { id: `cli_${++n}`, email: '', phone: '', address: '', ...body }
      clients.push(c)
      return send(201, c)
    }
    const m = url.pathname.match(/^\/api\/v1\/clients\/(.+)$/)
    if (req.method === 'PATCH' && m) {
      const c = clients.find((x) => x.id === m[1])
      if (!c) return send(404, { error: { message: 'not found' } })
      Object.assign(c, body)
      return send(200, c)
    }
    send(404, {})
  })
  return { server, clients, calls }
}

describe('invoicer sync against a fake Invoicer', () => {
  const fake = fakeInvoicer()
  let base = ''

  before(async () => {
    await ensureDbInitialized()
    await new Promise<void>((r) => fake.server.listen(0, '127.0.0.1', r))
    base = `http://127.0.0.1:${(fake.server.address() as AddressInfo).port}`
  })
  beforeEach(async () => {
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('invoicer_link').execute()
    fake.clients.length = 0
    fake.calls.length = 0
  })
  after(async () => {
    await db.deleteFrom('invoicer_link').execute()
    fake.server.close()
  })

  const person = (name: string, email = '', phone?: string) =>
    repo.createContact({ name, email, phone, deals: 0, lastTouch: 'Today', color: 'blue' })

  it('rejects a bad token and saves nothing', async () => {
    await assert.rejects(connectInvoicer(base, 'finv_bad'), /rejected the token/)
    assert.equal((await getInvoicerStatus()).connected, false)
  })

  it('connects with a dry run, then creates, links and updates without duplicates', async () => {
    fake.clients.push({ id: 'existing', name: 'Jana N.', email: 'jana@example.com', phone: '', address: 'Karlova 3' })
    const jana = await person('Jana Nováková', 'jana@example.com', '+420 777')
    const petr = await person('Petr Malý')

    await connectInvoicer(`${base}/`, 'finv_good_secret_123')
    assert.ok(fake.calls.includes('POST /api/v1/clients?dry_run=true'))
    assert.equal(fake.clients.length, 1, 'the connection check created nothing')

    const first = await syncAllContactsToInvoicer()
    assert.deepEqual([first.created, first.updated, first.unchanged, first.failed], [1, 1, 0, 0])
    const existing = fake.clients.find((c) => c.id === 'existing')!
    assert.equal(existing.name, 'Jana Nováková')
    assert.equal(existing.phone, '+420 777')
    assert.equal(existing.address, 'Karlova 3', 'billing details are never touched')

    const again = await syncAllContactsToInvoicer()
    assert.deepEqual([again.created, again.updated, again.unchanged], [0, 0, 2])

    // Editing the CRM client follows the remembered link, even after the email changes
    await repo.updateContact({ ...jana, email: 'jana@new.cz' })
    await syncContactToInvoicer(jana.id)
    assert.equal(fake.clients.length, 2)
    assert.equal(existing.email, 'jana@new.cz')

    const status = await getInvoicerStatus()
    assert.equal(status.linkedClients, 2)
    assert.equal(status.lastError, null)
    assert.ok(!JSON.stringify(status).includes('finv_good_secret_123'), 'the full token never leaves the server')
    void petr
  })

  it('does nothing when not connected, and records errors without throwing', async () => {
    const c = await person('Solo')
    await syncContactToInvoicer(c.id)
    assert.equal(fake.calls.length, 0)

    await connectInvoicer(base, 'finv_good_secret_123')
    await db.updateTable('invoicer_link').set({ token: 'finv_revoked' }).execute()
    await syncContactToInvoicer(c.id)
    assert.match((await getInvoicerStatus()).lastError ?? '', /rejected the token/)
    await disconnectInvoicer()
    assert.equal((await getInvoicerStatus()).connected, false)
  })
})
