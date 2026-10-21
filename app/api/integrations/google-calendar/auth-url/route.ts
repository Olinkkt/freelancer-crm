import { NextResponse } from 'next/server'
import { getGoogleAuthUrl } from '@/lib/google-calendar/client'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
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
      { error: err?.message || 'Failed to generate auth URL' },
      { status: 400 }
    )
  }
}
