import { findIdempotentResponse, writeAuditEntry } from '@/lib/db/api-tokens'
import { principalTokenId, requireScope, type Principal } from './auth'
import { operationInput, type AuditRecord, type Operation } from './registry'

export interface RunOptions {
  principal: Principal
  via: 'rest' | 'mcp'
  idempotencyKey?: string
}

export interface RunResult {
  result: unknown
  dryRun: boolean
  /** The response was replayed from an earlier call with the same Idempotency-Key */
  replayed: boolean
}

/**
 * Runs one operation: scope check, input validation, idempotent replay,
 * dry run, and audit rows for every write. REST and MCP both go through here.
 */
export async function runOperation(op: Operation, rawInput: unknown, opts: RunOptions): Promise<RunResult> {
  requireScope(opts.principal, op.scope)

  const parsed = operationInput(op).parse(rawInput ?? {}) as Record<string, unknown>
  const dryRun = op.scope === 'write' && parsed.dryRun === true
  delete parsed.dryRun

  const tokenId = principalTokenId(opts.principal)
  const key = op.scope === 'write' && !dryRun ? opts.idempotencyKey?.trim().slice(0, 200) || undefined : undefined
  if (key) {
    const prior = await findIdempotentResponse({ tokenId, key, operation: op.name })
    if (prior.found) return { result: prior.response, dryRun: false, replayed: true }
  }

  const records: AuditRecord[] = []
  const result = await op.handler(parsed, {
    principal: opts.principal,
    via: opts.via,
    dryRun,
    record: (r) => records.push(r),
  })

  if (op.scope === 'write') {
    const rows = records.length ? records : [{ entityType: undefined, entityId: undefined } as Partial<AuditRecord>]
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i]
      await writeAuditEntry({
        tokenId: tokenId ?? undefined,
        via: opts.via,
        operation: op.name,
        entityType: r.entityType,
        entityId: r.entityId,
        before: r.before,
        after: r.after ?? (dryRun ? result : undefined),
        dryRun,
        // Only the first row carries the key and response, so a retry replays once
        idempotencyKey: i === 0 ? key : undefined,
        response: i === 0 && key ? result : undefined,
      })
    }
  }

  return { result, dryRun, replayed: false }
}
