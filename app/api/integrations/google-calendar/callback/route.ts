import { NextResponse } from 'next/server'
import { exchangeGoogleCode } from '@/lib/google-calendar/client'
import { saveGoogleCalendarTokens } from '@/lib/db/google-calendar-repository'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const reqUrl = new URL(req.url)
  const code = reqUrl.searchParams.get('code')
  const error = reqUrl.searchParams.get('error')

  const baseUrl = `${reqUrl.origin}/`

  if (error) {
    const redirectUrl = new URL(baseUrl)
    redirectUrl.searchParams.set('settings', 'open')
    redirectUrl.searchParams.set('gcal', 'error')
    redirectUrl.searchParams.set('message', error)
    return NextResponse.redirect(redirectUrl)
  }

  if (!code || !code.trim()) {
    const redirectUrl = new URL(baseUrl)
    redirectUrl.searchParams.set('settings', 'open')
    redirectUrl.searchParams.set('gcal', 'error')
    redirectUrl.searchParams.set('message', 'Authorization code missing')
    return NextResponse.redirect(redirectUrl)
  }

  const clientId = process.env.GOOGLE_CLIENT_ID?.trim()
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim()

  if (!clientId || !clientSecret) {
    const redirectUrl = new URL(baseUrl)
    redirectUrl.searchParams.set('settings', 'open')
    redirectUrl.searchParams.set('gcal', 'error')
    redirectUrl.searchParams.set('message', 'Google OAuth credentials not configured')
    return NextResponse.redirect(redirectUrl)
  }

  const defaultRedirectUri = `${reqUrl.origin}/api/integrations/google-calendar/callback`
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || defaultRedirectUri

  try {
    const tokens = await exchangeGoogleCode({
      code: code.trim(),
      clientId,
      clientSecret,
      redirectUri,
    })

    await saveGoogleCalendarTokens({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      token_expiry: tokens.token_expiry,
    })

    const redirectUrl = new URL(baseUrl)
    redirectUrl.searchParams.set('settings', 'open')
    redirectUrl.searchParams.set('gcal', 'connected')
    return NextResponse.redirect(redirectUrl)
  } catch (err: any) {
    const redirectUrl = new URL(baseUrl)
    redirectUrl.searchParams.set('settings', 'open')
    redirectUrl.searchParams.set('gcal', 'error')
    redirectUrl.searchParams.set('message', err?.message || 'Token exchange failed')
    return NextResponse.redirect(redirectUrl)
  }
}
