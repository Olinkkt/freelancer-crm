import crypto from 'crypto'
import { db } from './client'
import { ensureDbInitialized } from './init'

export const API_SCOPES = ['read', 'write'] as const
export type ApiScope = (typeof API_SCOPES)[number]

/** Prefix that marks a scoped API token; anything else is not one */
export const TOKEN_PREFIX = 'fcrm_'

export interface ApiToken {
  id: string
  name: string
  /** First characters of the token, for recognising it in the list */
  prefix: string
  scopes: ApiScope[]
  createdAt: string
  lastUsedAt?: string
  revokedAt?: string
}

export interface AuditEntry {
  id: string
  at: string
  tokenId?: string
  via: 'rest' | 'mcp'
  operation: string
  entityType?: string
  entityId?: string
  before?: unknown
  after?: unknown
  dryRun: boolean
  idempotencyKey?: string
}

const hashToken = (plain: string) => crypto.createHash('sha256').update(plain).digest('hex')

const randomId = (prefix: string) => `${prefix}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`

function parseScopes(raw: string): ApiScope[] {
  const scopes = raw.split(',').map((s) => s.trim()).filter((s): s is ApiScope => (API_SCOPES as readonly string[]).includes(s))
  // write always implies read
  return scopes.includes('write') ? ['read', 'write'] : ['read']
}

function mapToken(r: {
  id: string
  name: string
  prefix: string
  scopes: string
  created_at: string
  last_used_at: string | null
  revoked_at: string | null
}): ApiToken {
  return {
    id: r.id,
    name: r.name,
    prefix: r.prefix,
    scopes: parseScopes(r.scopes),
    createdAt: r.created_at,
    lastUsedAt: r.last_used_at ?? undefined,
    revokedAt: r.revoked_at ?? undefined,
  }
}

/** Creates a token. The plaintext is returned once and only its hash is stored. */
export async function createApiToken(params: { name: string; scopes: ApiScope[] }): Promise<{ token: ApiToken; plaintext: string }> {
  await ensureDbInitialized()
  const name = params.name.trim()
  if (!name) throw new Error('Token name is required')
  if (name.length > 80) throw new Error('Token name cannot exceed 80 characters')

  const plaintext = TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url')
  const scopes = params.scopes.includes('write') ? 'read,write' : 'read'
  const row = {
    id: randomId('tok'),
    name,
    token_hash: hashToken(plaintext),
    prefix: plaintext.slice(0, TOKEN_PREFIX.length + 6),
    scopes,
    created_at: new Date().toISOString(),
    last_used_at: null,
    revoked_at: null,
  }
  await db.insertInto('api_tokens').values(row).execute()
  return { token: mapToken(row), plaintext }
}

/** Looks a plaintext token up by hash. Revoked or unknown tokens return null. */
export async function verifyApiToken(plaintext: string): Promise<ApiToken | null> {
  if (!plaintext.startsWith(TOKEN_PREFIX)) return null
  await ensureDbInitialized()
  const row = await db
    .selectFrom('api_tokens')
    .selectAll()
    .where('token_hash', '=', hashToken(plaintext))
    .executeTakeFirst()
  if (!row || row.revoked_at) return null

  // Record use at most once a minute to keep reads cheap
  const now = new Date()
  if (!row.last_used_at || now.getTime() - new Date(row.last_used_at).getTime() > 60_000) {
    await db.updateTable('api_tokens').set({ last_used_at: now.toISOString() }).where('id', '=', row.id).execute()
    row.last_used_at = now.toISOString()
  }
  return mapToken(row)
}

export async function listApiTokens(): Promise<ApiToken[]> {
  await ensureDbInitialized()
  const rows = await db.selectFrom('api_tokens').selectAll().orderBy('created_at', 'desc').execute()
  return rows.map(mapToken)
}

export async function revokeApiToken(id: string): Promise<boolean> {
  await ensureDbInitialized()
  const result = await db
    .updateTable('api_tokens')
    .set({ revoked_at: new Date().toISOString() })
    .where('id', '=', id)
    .where('revoked_at', 'is', null)
    .executeTakeFirst()
  return Number(result.numUpdatedRows) > 0
}

// -------------------------------------------------------------
// AUDIT LOG (written by every API/MCP write, no UI yet)
// -------------------------------------------------------------

const toJson = (v: unknown) => (v === undefined ? null : JSON.stringify(v))
const fromJson = (v: string | null) => {
  if (!v) return undefined
  try {
    return JSON.parse(v)
  } catch {
    return undefined
  }
}

export async function writeAuditEntry(entry: Omit<AuditEntry, 'id' | 'at'> & { response?: unknown }): Promise<void> {
  await ensureDbInitialized()
  await db
    .insertInto('api_audit_log')
    .values({
      id: randomId('aud'),
      at: new Date().toISOString(),
      token_id: entry.tokenId ?? null,
      via: entry.via,
      operation: entry.operation,
      entity_type: entry.entityType ?? null,
      entity_id: entry.entityId ?? null,
      before: toJson(entry.before),
      after: toJson(entry.after),
      dry_run: entry.dryRun ? 1 : 0,
      idempotency_key: entry.idempotencyKey ?? null,
      response: toJson(entry.response),
    })
    .execute()
}

/** Idempotency keys are remembered for 24 hours */
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000

/** The stored response of an earlier write with the same key and operation, if any */
export async function findIdempotentResponse(params: {
  tokenId: string | null
  key: string
  operation: string
}): Promise<{ found: true; response: unknown } | { found: false }> {
  await ensureDbInitialized()
  const since = new Date(Date.now() - IDEMPOTENCY_TTL_MS).toISOString()
  let q = db
    .selectFrom('api_audit_log')
    .select(['response', 'operation'])
    .where('idempotency_key', '=', params.key)
    .where('at', '>=', since)
    .where('dry_run', '=', 0)
  q = params.tokenId ? q.where('token_id', '=', params.tokenId) : q.where('token_id', 'is', null)
  const row = await q.orderBy('at', 'desc').executeTakeFirst()
  if (!row) return { found: false }
  if (row.operation !== params.operation) {
    throw new IdempotencyConflictError()
  }
  return { found: true, response: fromJson(row.response) }
}

export class IdempotencyConflictError extends Error {
  constructor() {
    super('This Idempotency-Key was already used for a different operation')
    this.name = 'IdempotencyConflictError'
  }
}

export async function listAuditLog(params: { tokenId?: string; since?: string; limit?: number } = {}): Promise<AuditEntry[]> {
  await ensureDbInitialized()
  let q = db.selectFrom('api_audit_log').selectAll()
  if (params.tokenId) q = q.where('token_id', '=', params.tokenId)
  if (params.since) q = q.where('at', '>=', params.since)
  const rows = await q.orderBy('at', 'desc').limit(Math.min(params.limit ?? 100, 1000)).execute()
  return rows.map((r) => ({
    id: r.id,
    at: r.at,
    tokenId: r.token_id ?? undefined,
    via: r.via === 'mcp' ? 'mcp' : 'rest',
    operation: r.operation,
    entityType: r.entity_type ?? undefined,
    entityId: r.entity_id ?? undefined,
    before: fromJson(r.before),
    after: fromJson(r.after),
    dryRun: Number(r.dry_run) === 1,
    idempotencyKey: r.idempotency_key ?? undefined,
  }))
}
