import { ApiError, toApiError } from './errors'
import { authenticateApi } from './auth'
import { takeRateLimit } from './rate-limit'
import { OPERATIONS } from './operations'
import { operationInput, type HttpMethod, type Operation } from './registry'
import { runOperation } from './run'

export const API_BASE = '/api/v1'

interface Route {
  op: Operation
  method: HttpMethod
  regex: RegExp
  params: string[]
}

const ROUTES: Route[] = OPERATIONS.map((op) => {
  const params: string[] = []
  const pattern = op.http.path.replace(/\{(\w+)\}/g, (_, name) => {
    params.push(name)
    return '([^/]+)'
  })
  return { op, method: op.http.method, regex: new RegExp(`^${pattern}/?$`), params }
})

export function matchRoute(method: string, path: string): { op: Operation; params: Record<string, string> } | 'method_not_allowed' | null {
  let pathMatched = false
  for (const r of ROUTES) {
    const m = r.regex.exec(path)
    if (!m) continue
    pathMatched = true
    if (r.method !== method) continue
    const params: Record<string, string> = {}
    r.params.forEach((name, i) => (params[name] = decodeURIComponent(m[i + 1])))
    return { op: r.op, params }
  }
  return pathMatched ? 'method_not_allowed' : null
}

/** The zod type name under optional/default/nullable wrappers */
function baseType(schema: unknown): string | undefined {
  let s = schema as { _zod?: { def: { type: string; innerType?: unknown; in?: unknown } } } | undefined
  for (let i = 0; i < 10 && s?._zod; i++) {
    const def = s._zod.def
    if (def.type === 'optional' || def.type === 'default' || def.type === 'nullable' || def.type === 'prefault') {
      s = def.innerType as typeof s
    } else if (def.type === 'pipe') {
      s = def.in as typeof s
    } else {
      return def.type
    }
  }
  return undefined
}

/** Query strings are text; turn them into the numbers, booleans and arrays the schema expects */
function coerceQuery(op: Operation, searchParams: URLSearchParams): Record<string, unknown> {
  const shape = operationInput(op).shape as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [rawKey, value] of searchParams) {
    // dry_run is the documented spelling in URLs
    const key = rawKey === 'dry_run' ? 'dryRun' : rawKey
    const type = baseType(shape[key])
    if (type === 'number') out[key] = value.trim() === '' ? undefined : Number(value)
    else if (type === 'boolean') out[key] = value === 'true' || value === '1'
    else if (type === 'array') out[key] = value.split(',').map((v) => v.trim()).filter(Boolean)
    else out[key] = value
  }
  return out
}

function json(body: unknown, status: number, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  })
}

export function errorResponse(err: unknown): Response {
  const apiErr = toApiError(err)
  if (apiErr.code === 'internal_error') console.error('[api/v1]', err)
  const headers: Record<string, string> = {}
  if (apiErr.code === 'unauthorized') headers['www-authenticate'] = 'Bearer realm="freelancer-crm"'
  return json(apiErr.toJSON(), apiErr.status, headers)
}

/** Entry point for every /api/v1/* request except the spec */
export async function handleRest(req: Request, segments: string[]): Promise<Response> {
  try {
    const path = '/' + segments.map(encodeURIComponent).join('/')
    const match = matchRoute(req.method, '/' + segments.join('/'))
    if (match === null) {
      throw new ApiError('not_found', `No endpoint ${req.method} ${API_BASE}${path}`, {
        hint: `See ${API_BASE}/openapi.json for every endpoint.`,
      })
    }
    if (match === 'method_not_allowed') {
      return json(
        new ApiError('validation_failed', `${req.method} is not allowed on ${API_BASE}${path}`, {
          hint: `See ${API_BASE}/openapi.json for the allowed methods.`,
        }).toJSON(),
        405
      )
    }

    const principal = await authenticateApi(req)
    takeRateLimit(principal.kind === 'token' ? principal.tokenId : 'operator')

    const { op, params } = match
    const url = new URL(req.url)
    let body: Record<string, unknown> = {}
    if (req.method === 'POST' || req.method === 'PATCH') {
      const text = await req.text()
      if (text.trim()) {
        try {
          const parsed = JSON.parse(text)
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error()
          body = parsed
        } catch {
          throw new ApiError('validation_failed', 'Request body must be a JSON object')
        }
      }
    }
    // Path params win over anything in the body or query
    const input = { ...coerceQuery(op, url.searchParams), ...body, ...params }

    const { result, dryRun, replayed } = await runOperation(op, input, {
      principal,
      via: 'rest',
      idempotencyKey: req.headers.get('idempotency-key') ?? undefined,
    })

    const headers: Record<string, string> = {}
    if (dryRun) headers['x-dry-run'] = 'true'
    if (replayed) headers['idempotent-replayed'] = 'true'
    return json(result, dryRun ? 200 : op.http.status ?? 200, headers)
  } catch (err) {
    return errorResponse(err)
  }
}
