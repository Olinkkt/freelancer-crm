#!/usr/bin/env node
/**
 * stdio MCP server for Freelancer CRM.
 *
 * It holds no logic of its own: every request is forwarded to the CRM's
 * Streamable HTTP endpoint (/api/mcp), so tools, scopes, validation and the
 * audit log behave exactly as over HTTP.
 *
 * Env:
 *   CRM_TOKEN  API token from Settings → API (required, starts with fcrm_)
 *   CRM_URL    Base URL of the CRM (default http://localhost:3000)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js'

const log = (...args) => console.error('[freelancer-crm-mcp]', ...args)

const token = process.env.CRM_TOKEN?.trim()
const baseUrl = (process.env.CRM_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, '')

if (!token) {
  log('CRM_TOKEN is not set. Create a token in the CRM under Settings → API and pass it as CRM_TOKEN.')
  process.exit(1)
}

const remote = new Client({ name: 'freelancer-crm-mcp-proxy', version: '1.0.0' })
const remoteTransport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/api/mcp`), {
  requestInit: { headers: { Authorization: `Bearer ${token}` } },
})

try {
  await remote.connect(remoteTransport)
} catch (err) {
  log(`Could not connect to ${baseUrl}/api/mcp: ${err?.message ?? err}`)
  log('Is the CRM running, and is CRM_TOKEN valid and not revoked?')
  process.exit(1)
}

const info = remote.getServerVersion()
const server = new Server(
  { name: info?.name ?? 'freelancer-crm', version: info?.version ?? '1.0.0', title: 'Freelancer CRM' },
  {
    capabilities: { tools: {}, resources: {}, prompts: {} },
    instructions: remote.getInstructions(),
  }
)

server.setRequestHandler(ListToolsRequestSchema, (req) => remote.listTools(req.params))
server.setRequestHandler(CallToolRequestSchema, (req) => remote.callTool(req.params))
server.setRequestHandler(ListResourcesRequestSchema, (req) => remote.listResources(req.params))
server.setRequestHandler(ListResourceTemplatesRequestSchema, (req) => remote.listResourceTemplates(req.params))
server.setRequestHandler(ReadResourceRequestSchema, (req) => remote.readResource(req.params))
server.setRequestHandler(ListPromptsRequestSchema, (req) => remote.listPrompts(req.params))
server.setRequestHandler(GetPromptRequestSchema, (req) => remote.getPrompt(req.params))

const shutdown = async () => {
  await Promise.allSettled([server.close(), remote.close()])
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await server.connect(new StdioServerTransport())
log(`connected to ${baseUrl}`)
