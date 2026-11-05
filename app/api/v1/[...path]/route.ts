import { handleRest } from '@/lib/api/rest'

export const dynamic = 'force-dynamic'

type Ctx = { params: Promise<{ path: string[] }> }

const handle = async (req: Request, ctx: Ctx) => handleRest(req, (await ctx.params).path)

export const GET = handle
export const POST = handle
export const PATCH = handle
export const DELETE = handle
