import { z } from 'zod'
import { OPERATIONS } from './operations'
import { operationInput, type Operation } from './registry'
import { ErrorSchema } from './schemas'
import { API_BASE } from './rest'

type JsonSchema = Record<string, any>

const COMPONENT_PREFIX = '#/components/schemas/'

/**
 * Converts a zod schema to JSON Schema, moving named schemas ($defs) into the
 * shared components map and pointing refs at it.
 */
function toSchema(schema: z.ZodType, io: 'input' | 'output', components: Record<string, JsonSchema>): JsonSchema {
  const json = z.toJSONSchema(schema, { target: 'draft-2020-12', unrepresentable: 'any', io }) as JsonSchema
  delete json.$schema
  const defs = json.$defs as Record<string, JsonSchema> | undefined
  delete json.$defs
  const rewrite = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(rewrite)
    if (node && typeof node === 'object') {
      const out: Record<string, unknown> = {}
      for (const [k, v] of Object.entries(node)) {
        out[k] = k === '$ref' && typeof v === 'string' ? v.replace('#/$defs/', COMPONENT_PREFIX) : rewrite(v)
      }
      return out
    }
    return node
  }
  if (defs) {
    for (const [name, def] of Object.entries(defs)) components[name] ??= rewrite(def) as JsonSchema
  }
  return rewrite(json) as JsonSchema
}

const pathParams = (op: Operation) => [...op.http.path.matchAll(/\{(\w+)\}/g)].map((m) => m[1])

const errorRef = { $ref: `${COMPONENT_PREFIX}Error` }
const errorResponse = (description: string) => ({
  description,
  content: { 'application/json': { schema: errorRef } },
})

function operationObject(op: Operation, components: Record<string, JsonSchema>) {
  const input = toSchema(operationInput(op), 'input', components)
  const props: Record<string, JsonSchema> = input.properties ?? {}
  const required: string[] = input.required ?? []
  const inPath = pathParams(op)

  const parameters: JsonSchema[] = inPath.map((name) => ({
    name,
    in: 'path',
    required: true,
    schema: { type: 'string' },
    description: props[name]?.description,
  }))

  const isBodyless = op.http.method === 'GET' || op.http.method === 'DELETE'
  if (isBodyless) {
    for (const [name, schema] of Object.entries(props)) {
      if (inPath.includes(name)) continue
      const { description, ...rest } = schema
      const asQuery = name === 'dryRun' ? 'dry_run' : name
      parameters.push({
        name: asQuery,
        in: 'query',
        required: required.includes(name),
        schema: rest,
        ...(description ? { description } : {}),
        ...(rest.type === 'array' ? { style: 'form', explode: false } : {}),
      })
    }
  } else if (op.scope === 'write') {
    parameters.push({
      name: 'dry_run',
      in: 'query',
      required: false,
      schema: { type: 'boolean' },
      description: 'Validate and return the would-be result without saving. Same as dryRun in the body.',
    })
  }

  if (op.scope === 'write') {
    parameters.push({
      name: 'Idempotency-Key',
      in: 'header',
      required: false,
      schema: { type: 'string', maxLength: 200 },
      description: 'Retrying with the same key within 24 hours returns the first response instead of writing again.',
    })
  }

  let requestBody: JsonSchema | undefined
  if (!isBodyless) {
    const bodyProps = Object.fromEntries(Object.entries(props).filter(([k]) => !inPath.includes(k)))
    const bodyRequired = required.filter((k) => !inPath.includes(k))
    const bodySchema: JsonSchema = {
      type: 'object',
      properties: bodyProps,
      ...(bodyRequired.length ? { required: bodyRequired } : {}),
      additionalProperties: false,
    }
    const example = op.example ? Object.fromEntries(Object.entries(op.example).filter(([k]) => !inPath.includes(k))) : undefined
    requestBody = {
      required: bodyRequired.length > 0,
      content: { 'application/json': { schema: bodySchema, ...(example ? { example } : {}) } },
    }
  }

  const status = String(op.http.status ?? 200)
  const responses: Record<string, unknown> = {
    [status]: {
      description: 'Success',
      content: { 'application/json': { schema: toSchema(op.output, 'output', components) } },
    },
    '400': errorResponse('Invalid input (validation_failed). The hint says how to fix it.'),
    '401': errorResponse('Missing, invalid or revoked token (unauthorized)'),
    '429': errorResponse('Rate limited'),
  }
  if (op.scope === 'write') responses['403'] = errorResponse('Token lacks the write scope (insufficient_scope)')
  if (inPath.length) responses['404'] = errorResponse('Not found')
  if (op.scope === 'write') responses['409'] = errorResponse('Conflict, e.g. duplicate client or reused Idempotency-Key')

  return {
    operationId: op.name,
    summary: op.title,
    description: op.description,
    tags: [tagFor(op)],
    ...(parameters.length ? { parameters } : {}),
    ...(requestBody ? { requestBody } : {}),
    responses,
    security: [{ bearerAuth: [] }],
    'x-required-scope': op.scope,
    'x-mcp-tool': op.mcp !== false ? op.name : null,
    ...(op.destructive ? { 'x-destructive': true } : {}),
  }
}

function tagFor(op: Operation): string {
  const p = op.http.path
  if (p.includes('/tasks')) return 'Tasks'
  if (p.includes('/invoices')) return 'Invoices'
  if (p.startsWith('/deals')) return 'Deals'
  if (p.startsWith('/clients')) return 'Clients'
  if (p.startsWith('/follow-ups')) return 'Follow-ups'
  return 'Overview'
}

/** Paths in the spec, as `METHOD /path` (used by the drift test) */
export const specRoutes = () => OPERATIONS.map((op) => `${op.http.method} ${op.http.path}`)

export function buildOpenApiSpec(origin = 'http://localhost:3000') {
  const components: Record<string, JsonSchema> = {}
  components.Error = toSchema(ErrorSchema, 'output', components)
  // ErrorSchema carries its own id; keep the component inline rather than self-ref
  if (components.Error.$ref) components.Error = components[components.Error.$ref.replace(COMPONENT_PREFIX, '')] ?? components.Error

  const paths: Record<string, Record<string, unknown>> = {}
  for (const op of OPERATIONS) {
    const item = (paths[op.http.path] ??= {})
    item[op.http.method.toLowerCase()] = operationObject(op, components)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'Freelancer CRM API',
      version: '1.0.0',
      description: [
        'REST API for a single-operator freelancer CRM. Every endpoint is also an MCP tool at /api/mcp (see x-mcp-tool).',
        '',
        'Auth: `Authorization: Bearer fcrm_…`. Create tokens in Settings → API. Read tokens cannot write.',
        '',
        'Rules agents must know: clients are people (no companies); one pipeline Lead → Qualified → Proposal → Closed (contract signed) → Deposit → Materials → Build → Handoff → Revisions → Completed; every deal needs a next action with a due date unless waiting on the client.',
        '',
        'Writes accept `?dry_run=true` and an `Idempotency-Key` header. Errors are `{ error: { code, message, field?, hint? } }`.',
        '',
        'Full model: /llms-full.txt',
      ].join('\n'),
    },
    servers: [{ url: `${origin}${API_BASE}` }],
    tags: [
      { name: 'Overview', description: 'Start here: workspace, today, projects, search' },
      { name: 'Deals' },
      { name: 'Tasks', description: 'Cards on a deal\'s task board, including client materials' },
      { name: 'Invoices' },
      { name: 'Clients' },
      { name: 'Follow-ups' },
    ],
    paths,
    components: {
      schemas: components,
      securitySchemes: {
        bearerAuth: { type: 'http', scheme: 'bearer', description: 'API token from Settings → API (fcrm_…)' },
      },
    },
  }
}

/** Origin of the incoming request, honouring reverse-proxy headers */
export function requestOrigin(req: Request): string {
  const url = new URL(req.url)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host
  const proto = req.headers.get('x-forwarded-proto') || url.protocol.replace(':', '')
  return `${proto}://${host}`
}
