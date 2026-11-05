import { buildOpenApiSpec, requestOrigin } from '@/lib/api/openapi'

export const dynamic = 'force-dynamic'

/** Public: the spec describes the API, it holds no workspace data */
export async function GET(req: Request) {
  return new Response(JSON.stringify(buildOpenApiSpec(requestOrigin(req)), null, 2), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*' },
  })
}
