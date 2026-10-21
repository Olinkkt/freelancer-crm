import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar/client'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { sanitizeErrorMessage } from '@/lib/errors'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId || !clientId.trim()) {
    return NextResponse.json(
      { error: 'GOOGLE_CLIENT_ID is not configured' },
      { status: 400 }
    )
  }

  const reqUrl = new URL(req.url)
  const state = reqUrl.searchParams.get('state') || undefined
  const scope = reqUrl.searchParams.get('scope') || undefined

  const defaultRedirectUri = `${reqUrl.origin}/api/integrations/google-calendar/callback`
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || defaultRedirectUri

  try {
    const url = getGoogleAuthUrl({
      clientId: clientId.trim(),
      redirectUri,
      state,
      scope,
    })
    return NextResponse.json({ url })
  } catch (err: any) {
    return NextResponse.json(
      { error: sanitizeErrorMessage(err, 'Failed to generate auth URL') },
      { status: 400 }
    )
  }
}
