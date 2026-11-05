import { llmsFullTxt } from '@/lib/api/llms'
import { requestOrigin } from '@/lib/api/openapi'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return new Response(llmsFullTxt(requestOrigin(req)), { headers: { 'content-type': 'text/plain; charset=utf-8' } })
}
