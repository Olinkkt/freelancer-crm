import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js'
import { authenticateApi } from '@/lib/api/auth'
import { errorResponse } from '@/lib/api/rest'
import { createMcpServer } from '@/lib/mcp/server'

export const dynamic = 'force-dynamic'

/**
 * MCP over Streamable HTTP, stateless: every request gets a fresh server
 * bound to the caller's token, so it fits route handlers and serverless hosts.
 */
async function handle(req: Request): Promise<Response> {
  let principal
  try {
    principal = await authenticateApi(req)
  } catch (err) {
    return errorResponse(err)
  }

  const server = createMcpServer(principal)
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  try {
    return await transport.handleRequest(req)
  } finally {
    // JSON responses are complete once handleRequest resolves
    void transport.close()
    void server.close()
  }
}

export const GET = handle
export const POST = handle
export const DELETE = handle
