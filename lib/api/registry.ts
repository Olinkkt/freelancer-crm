import { z } from 'zod'
import type { ApiScope } from '@/lib/db/api-tokens'
import type { Principal } from './auth'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export interface AuditRecord {
  entityType: 'deal' | 'client' | 'follow_up'
  entityId: string
  before?: unknown
  after?: unknown
}

export interface OperationContext {
  principal: Principal
  via: 'rest' | 'mcp'
  /** Validate and compute the result, but save nothing */
  dryRun: boolean
  /** Writes call this with what changed; the runner turns it into audit rows */
  record: (r: AuditRecord) => void
}

/**
 * One API operation. REST routes, the OpenAPI spec and MCP tools are all
 * generated from these, so each operation is defined exactly once.
 */
export interface Operation<I extends z.ZodObject = z.ZodObject, O extends z.ZodType = z.ZodType> {
  name: string
  title: string
  /** Written for an LLM: when to use it, when not, what it returns */
  description: string
  scope: ApiScope
  input: I
  output: O
  http: { method: HttpMethod; path: string; status?: number }
  /** Deletes data. MCP marks it destructive so clients ask before calling. */
  destructive?: boolean
  /** Calling it twice with the same input has no extra effect */
  idempotent?: boolean
  /** Expose as an MCP tool (default true). REST always has every operation. */
  mcp?: boolean
  /** Example input for docs */
  example?: Record<string, unknown>
  handler: (input: z.output<I>, ctx: OperationContext) => Promise<z.output<O>>
}

export function defineOperation<I extends z.ZodObject, O extends z.ZodType>(op: Operation<I, O>): Operation<I, O> {
  return op
}

export const DryRunField = z
  .boolean()
  .optional()
  .describe('Validate and return the would-be result without saving anything. Use it to preview risky changes.')

/** The input an operation actually accepts: write operations also take dryRun */
export function operationInput(op: Operation): z.ZodObject {
  return op.scope === 'write' ? op.input.extend({ dryRun: DryRunField }) : op.input
}
