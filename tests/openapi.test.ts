import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import SwaggerParser from '@apidevtools/swagger-parser'
import { buildOpenApiSpec } from '@/lib/api/openapi'
import { OPERATIONS } from '@/lib/api/operations'
import { matchRoute } from '@/lib/api/rest'
import { llmsFullTxt, llmsTxt } from '@/lib/api/llms'
import { GET as getSpec } from '@/app/api/v1/openapi.json/route'

describe('OpenAPI spec', () => {
  const spec = buildOpenApiSpec('http://localhost:3000')

  it('is a valid OpenAPI 3.1 document', async () => {
    await SwaggerParser.validate(structuredClone(spec) as any)
  })

  it('has every operation, once, with a unique operationId', () => {
    const ids: string[] = []
    for (const [path, item] of Object.entries(spec.paths)) {
      for (const [method, op] of Object.entries(item as Record<string, any>)) {
        ids.push(op.operationId)
        const found = OPERATIONS.find((o) => o.name === op.operationId)!
        assert.equal(found.http.path, path)
        assert.equal(found.http.method.toLowerCase(), method)
      }
    }
    assert.deepEqual(ids.sort(), OPERATIONS.map((o) => o.name).sort())
    assert.equal(new Set(ids).size, ids.length)
  })

  it('every spec path is served by the REST router', () => {
    for (const op of OPERATIONS) {
      const concrete = op.http.path.replace(/\{\w+\}/g, 'x1')
      const match = matchRoute(op.http.method, concrete)
      assert.ok(match && match !== 'method_not_allowed', `${op.http.method} ${op.http.path} has no route`)
      assert.equal(match.op.name, op.name)
    }
  })

  it('every operation has a real description and an output schema', () => {
    for (const op of OPERATIONS) {
      assert.ok(op.description.length > 40, `${op.name} needs a longer description`)
      assert.match(op.name, /^[a-z_]+$/)
    }
  })

  it('marks write operations with dry_run and Idempotency-Key', () => {
    const post = (spec.paths as any)['/deals'].post
    const names = post.parameters.map((p: any) => p.name)
    assert.ok(names.includes('dry_run'))
    assert.ok(names.includes('Idempotency-Key'))
    assert.equal(post['x-required-scope'], 'write')
  })

  it('is served publicly with the request origin', async () => {
    const res = await getSpec(new Request('https://crm.example.com/api/v1/openapi.json'))
    const body = await res.json()
    assert.equal(body.servers[0].url, 'https://crm.example.com/api/v1')
  })
})

describe('llms.txt', () => {
  it('links the spec and MCP endpoint', () => {
    const txt = llmsTxt('https://crm.example.com')
    assert.match(txt, /https:\/\/crm\.example\.com\/api\/v1\/openapi\.json/)
    assert.match(txt, /https:\/\/crm\.example\.com\/api\/mcp/)
  })

  it('llms-full lists the rules and every operation', () => {
    const txt = llmsFullTxt('https://crm.example.com')
    assert.match(txt, /Clients? (are|is) .*people|a person/i)
    for (const op of OPERATIONS) assert.ok(txt.includes(`### ${op.name}`), op.name)
  })
})
