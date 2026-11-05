import { z } from 'zod'
import { OPERATIONS } from './operations'
import { operationInput } from './registry'
import { rulesMarkdown } from './rules'
import { API_BASE } from './rest'

/** llms.txt: a short index for agents (https://llmstxt.org) */
export function llmsTxt(origin: string): string {
  return `# Freelancer CRM

> Single-operator CRM for a freelancer: clients (people), deals moving through one pipeline, tasks, invoices and notes. Agents can use it through a REST API or an MCP server, with scoped bearer tokens.

## Docs

- [Model and rules, every operation](${origin}/llms-full.txt): read this first
- [OpenAPI 3.1 spec](${origin}${API_BASE}/openapi.json): machine-readable REST API
- [API reference](${origin}/api/docs): human-readable REST docs

## Connect

- REST base URL: ${origin}${API_BASE}
- MCP (Streamable HTTP): ${origin}/api/mcp
- Auth: \`Authorization: Bearer fcrm_…\`, created in Settings → API. Read-only tokens cannot write.
`
}

function fieldList(schema: z.ZodObject): string {
  const json = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input' }) as Record<string, any>
  const required: string[] = json.required ?? []
  const props = Object.entries((json.properties ?? {}) as Record<string, any>)
  if (!props.length) return '  - (no input)'
  return props
    .map(([name, p]) => {
      const type = p.enum ? p.enum.map((v: unknown) => JSON.stringify(v)).join(' | ') : p.type === 'array' ? `${p.items?.type ?? 'item'}[]` : p.type ?? (p.$ref ? p.$ref.split('/').pop() : 'any')
      return `  - \`${name}\`${required.includes(name) ? ' (required)' : ''}: ${type}${p.description ? `. ${p.description}` : ''}`
    })
    .join('\n')
}

/** llms-full.txt: the rules plus every operation, in one file an agent can read */
export function llmsFullTxt(origin: string): string {
  const ops = OPERATIONS.map((op) => {
    const mcp = op.mcp !== false ? `MCP tool \`${op.name}\`` : 'REST only'
    return `### ${op.name}

\`${op.http.method} ${API_BASE}${op.http.path}\` · scope: ${op.scope} · ${mcp}${op.destructive ? ' · destructive' : ''}

${op.description}

${fieldList(operationInput(op))}`
  }).join('\n\n')

  return `${rulesMarkdown()}
## Connect

- REST: ${origin}${API_BASE} (OpenAPI: ${origin}${API_BASE}/openapi.json)
- MCP: ${origin}/api/mcp (Streamable HTTP, same bearer token)
- Path parameters ({id}) go in the URL; GET filters go in the query string (arrays comma-separated); POST/PATCH take a JSON body.

## Operations

${ops}
`
}
