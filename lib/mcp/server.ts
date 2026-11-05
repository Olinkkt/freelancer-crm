import { z } from 'zod'
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  McpError,
  ErrorCode,
} from '@modelcontextprotocol/sdk/types.js'
import { OPERATIONS, OPERATIONS_BY_NAME } from '@/lib/api/operations'
import { operationInput, type Operation } from '@/lib/api/registry'
import { runOperation } from '@/lib/api/run'
import { toApiError } from '@/lib/api/errors'
import { takeRateLimit } from '@/lib/api/rate-limit'
import { rulesMarkdown } from '@/lib/api/rules'
import type { Principal } from '@/lib/api/auth'
import { MCP_PROMPTS, renderPrompt } from './prompts'

export const MCP_SERVER_NAME = 'freelancer-crm'
export const MCP_SERVER_VERSION = '1.0.0'

const INSTRUCTIONS = `Freelancer CRM for one operator. Clients are people (no companies). One pipeline: Lead → Qualified → Proposal → Closed (contract signed) → Deposit → Materials → Build → Handoff → Revisions → Completed.
Every deal needs a next action with a due date, unless it is waiting on the client.
Start with get_today for what's due. Resolve names to ids with search before writing; ask the user if several match. Preview risky writes with dryRun: true. Errors include a hint: follow it.
Full rules: resource crm://rules.`

type JsonSchema = Record<string, any>

/** Inline $defs so every MCP client can read the schema, even ones that don't resolve $ref */
function inlineRefs(schema: JsonSchema): JsonSchema {
  const defs = (schema.$defs ?? {}) as Record<string, JsonSchema>
  const walk = (node: unknown, depth: number): unknown => {
    if (Array.isArray(node)) return node.map((n) => walk(n, depth))
    if (!node || typeof node !== 'object') return node
    const obj = node as Record<string, unknown>
    if (typeof obj.$ref === 'string' && obj.$ref.startsWith('#/$defs/') && depth < 8) {
      const { $ref, ...rest } = obj
      const target = defs[($ref as string).slice('#/$defs/'.length)]
      return { ...(walk(target, depth + 1) as object), ...rest }
    }
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj)) if (k !== '$defs' && k !== '$schema') out[k] = walk(v, depth)
    return out
  }
  return walk(schema, 0) as JsonSchema
}

export function toolInputSchema(op: Operation): JsonSchema {
  const json = z.toJSONSchema(operationInput(op), { target: 'draft-2020-12', unrepresentable: 'any', io: 'input' }) as JsonSchema
  return inlineRefs(json)
}

/** MCP tools this principal may call. Read-only tokens never see write tools. */
export function toolsFor(principal: Principal) {
  return OPERATIONS.filter((op) => op.mcp !== false && principal.scopes.includes(op.scope)).map((op) => ({
    name: op.name,
    title: op.title,
    description: op.description,
    inputSchema: toolInputSchema(op) as { type: 'object'; [k: string]: unknown },
    annotations: {
      title: op.title,
      readOnlyHint: op.scope === 'read',
      destructiveHint: op.scope === 'write' ? !!op.destructive : undefined,
      idempotentHint: op.idempotent ?? false,
      openWorldHint: false,
    },
  }))
}

const json = (value: unknown) => JSON.stringify(value, null, 2)

async function readTool(principal: Principal, name: string, input: Record<string, unknown> = {}) {
  const op = OPERATIONS_BY_NAME.get(name)!
  const { result } = await runOperation(op, input, { principal, via: 'mcp' })
  return result
}

/** One MCP server per request (stateless), bound to the authenticated principal */
export function createMcpServer(principal: Principal): Server {
  const server = new Server(
    { name: MCP_SERVER_NAME, version: MCP_SERVER_VERSION, title: 'Freelancer CRM' },
    {
      capabilities: { tools: {}, resources: {}, prompts: {} },
      instructions: INSTRUCTIONS,
    }
  )

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolsFor(principal) }))

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    const op = OPERATIONS_BY_NAME.get(req.params.name)
    if (!op || op.mcp === false) {
      throw new McpError(ErrorCode.InvalidParams, `Unknown tool: ${req.params.name}`)
    }
    try {
      takeRateLimit(principal.kind === 'token' ? principal.tokenId : 'operator')
      const { result, dryRun } = await runOperation(op, req.params.arguments ?? {}, { principal, via: 'mcp' })
      const text = dryRun ? `DRY RUN: nothing was saved. Would return:\n${json(result)}` : json(result)
      return {
        content: [{ type: 'text', text }],
        structuredContent: (result && typeof result === 'object' && !Array.isArray(result) ? result : { result }) as Record<string, unknown>,
      }
    } catch (err) {
      const apiErr = toApiError(err)
      if (apiErr.code === 'internal_error') console.error('[mcp]', err)
      return { isError: true, content: [{ type: 'text', text: json(apiErr.toJSON()) }] }
    }
  })

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: 'crm://rules', name: 'rules', title: 'Model and rules', description: 'How the CRM works and the rules every write must follow. Read before your first write.', mimeType: 'text/markdown' },
      { uri: 'crm://pipeline', name: 'pipeline', title: 'Pipeline stages', description: 'Stages in order with their meaning and side (CRM or PM), and task board columns.', mimeType: 'application/json' },
      { uri: 'crm://today', name: 'today', title: 'Today', description: 'What is due, waiting and missing a next action right now.', mimeType: 'application/json' },
    ],
  }))

  server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [
      { uriTemplate: 'crm://deal/{id}', name: 'deal', title: 'Deal', description: 'One deal with tasks, notes and invoices.', mimeType: 'application/json' },
    ],
  }))

  server.setRequestHandler(ReadResourceRequestSchema, async (req) => {
    const uri = req.params.uri
    try {
      if (uri === 'crm://rules') {
        return { contents: [{ uri, mimeType: 'text/markdown', text: rulesMarkdown() }] }
      }
      if (uri === 'crm://pipeline') {
        const ws = (await readTool(principal, 'get_workspace')) as Record<string, unknown>
        return { contents: [{ uri, mimeType: 'application/json', text: json({ stages: ws.stages, boardColumns: ws.boardColumns }) }] }
      }
      if (uri === 'crm://today') {
        return { contents: [{ uri, mimeType: 'application/json', text: json(await readTool(principal, 'get_today')) }] }
      }
      const deal = uri.match(/^crm:\/\/deal\/(.+)$/)
      if (deal) {
        const result = await readTool(principal, 'get_deal', { id: decodeURIComponent(deal[1]) })
        return { contents: [{ uri, mimeType: 'application/json', text: json(result) }] }
      }
    } catch (err) {
      throw new McpError(ErrorCode.InvalidParams, toApiError(err).message)
    }
    throw new McpError(ErrorCode.InvalidParams, `Unknown resource: ${uri}`)
  })

  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: MCP_PROMPTS.map(({ name, title, description, arguments: args }) => ({ name, title, description, arguments: args })),
  }))

  server.setRequestHandler(GetPromptRequestSchema, async (req) => {
    const rendered = renderPrompt(req.params.name, req.params.arguments ?? {})
    if (!rendered) throw new McpError(ErrorCode.InvalidParams, `Unknown prompt: ${req.params.name}`)
    return rendered
  })

  return server
}
