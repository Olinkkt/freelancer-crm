import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import { createApiToken, listAuditLog } from '@/lib/db/api-tokens'
import { resetRateLimits } from '@/lib/api/rate-limit'
import { POST, GET, DELETE } from '@/app/api/mcp/route'

async function wipe() {
  await db.deleteFrom('api_audit_log').execute()
  await db.deleteFrom('api_tokens').execute()
  await db.deleteFrom('follow_ups').execute()
  await db.deleteFrom('deals').execute()
  await db.deleteFrom('contacts').execute()
}

/** fetch that sends requests straight to the route handler, no server needed */
const routeFetch: typeof fetch = async (input, init) => {
  const req = new Request(input as RequestInfo, init)
  const handler = req.method === 'POST' ? POST : req.method === 'GET' ? GET : DELETE
  return handler(req)
}

async function connect(token?: string) {
  const client = new Client({ name: 'test', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL('http://localhost/api/mcp'), {
    fetch: routeFetch,
    requestInit: token ? { headers: { Authorization: `Bearer ${token}` } } : undefined,
  })
  await client.connect(transport)
  return client
}

const parse = (res: any) => JSON.parse(res.content[0].text.replace(/^DRY RUN[^\n]*\n/, ''))

describe('MCP server', () => {
  const originalSecret = process.env.AUTH_SECRET
  let readToken: string
  let writeToken: string

  before(async () => {
    await ensureDbInitialized()
    process.env.AUTH_SECRET = 'mcp-test-secret'
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

  it('rejects requests without a token', async () => {
    const res = await POST(
      new Request('http://localhost/api/mcp', {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      })
    )
    assert.equal(res.status, 401)
    assert.match(res.headers.get('www-authenticate') ?? '', /Bearer/)
  })

  it('initializes with instructions', async () => {
    const client = await connect(readToken)
    assert.equal(client.getServerVersion()?.name, 'freelancer-crm')
    assert.match(client.getInstructions() ?? '', /next action/)
    await client.close()
  })

  it('lists only read tools for a read token', async () => {
    const reader = await connect(readToken)
    const writer = await connect(writeToken)
    const readTools = (await reader.listTools()).tools.map((t) => t.name)
    const writeTools = (await writer.listTools()).tools.map((t) => t.name)
    assert.ok(readTools.includes('get_today'))
    assert.ok(!readTools.includes('create_deal'))
    assert.ok(writeTools.includes('create_deal'))
    assert.ok(!writeTools.includes('delete_deal'), 'REST-only operations stay out of MCP')
    const today = (await reader.listTools()).tools.find((t) => t.name === 'get_today')!
    assert.equal(today.annotations?.readOnlyHint, true)
    const create = (await writer.listTools()).tools.find((t) => t.name === 'create_deal')!
    assert.equal(create.inputSchema.type, 'object')
    assert.ok(!JSON.stringify(create.inputSchema).includes('$ref'), 'schemas are inlined')
    await reader.close()
    await writer.close()
  })

  it('refuses a write tool called with a read token', async () => {
    const client = await connect(readToken)
    const res: any = await client.callTool({ name: 'create_deal', arguments: { title: 'X', contactName: 'Y', waiting: true } })
    assert.equal(res.isError, true)
    assert.equal(parse(res).error.code, 'insufficient_scope')
    await client.close()
  })

  it('creates and updates a deal, audited as mcp', async () => {
    const client = await connect(writeToken)
    const created: any = await client.callTool({
      name: 'create_deal',
      arguments: { title: 'Website', contactName: 'Jana', next: 'Send proposal', nextDueDate: '2026-11-20' },
    })
    assert.ok(!created.isError, created.content?.[0]?.text)
    const deal = created.structuredContent
    assert.equal(deal.title, 'Website')

    const moved: any = await client.callTool({ name: 'advance_deal_stage', arguments: { id: deal.id } })
    assert.equal(moved.structuredContent.stage, 'Qualified')

    const log = await listAuditLog()
    assert.ok(log.length >= 2)
    assert.ok(log.every((e) => e.via === 'mcp'))
    await client.close()
  })

  it('returns validation errors with a hint', async () => {
    const client = await connect(writeToken)
    const res: any = await client.callTool({ name: 'create_deal', arguments: { title: 'No next', contactName: 'Jana' } })
    assert.equal(res.isError, true)
    const body = parse(res)
    assert.equal(body.error.code, 'validation_failed')
    assert.ok(body.error.hint)
    await client.close()
  })

  it('supports dry run', async () => {
    const client = await connect(writeToken)
    const res: any = await client.callTool({
      name: 'create_deal',
      arguments: { title: 'Preview', contactName: 'Jana', waiting: true, dryRun: true },
    })
    assert.match(res.content[0].text, /^DRY RUN/)
    assert.equal((await db.selectFrom('deals').select('id').execute()).length, 0)
    await client.close()
  })

  it('serves resources and prompts', async () => {
    const client = await connect(readToken)
    const resources = (await client.listResources()).resources.map((r) => r.uri)
    assert.deepEqual(resources.sort(), ['crm://pipeline', 'crm://rules', 'crm://today'])
    const rules: any = await client.readResource({ uri: 'crm://rules' })
    assert.match(rules.contents[0].text, /Clients?\*\*?: a person|a person/)
    const pipeline: any = await client.readResource({ uri: 'crm://pipeline' })
    assert.equal(JSON.parse(pipeline.contents[0].text).stages.length, 10)
    const templates = (await client.listResourceTemplates()).resourceTemplates
    assert.equal(templates[0].uriTemplate, 'crm://deal/{id}')

    const prompts = (await client.listPrompts()).prompts.map((p) => p.name)
    assert.deepEqual(prompts.sort(), ['draft_follow_up', 'triage_to_deals', 'weekly_review'])
    const triage = await client.getPrompt({ name: 'triage_to_deals', arguments: { text: 'Hi, can you build my site?' } })
    assert.match((triage.messages[0].content as any).text, /build my site/)
    await client.close()
  })
})
