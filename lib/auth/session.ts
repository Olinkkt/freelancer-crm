import crypto from 'crypto'
import { cookies, headers } from 'next/headers'

const COOKIE_NAME = 'crm_operator_session'
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export function isAuthRequired(): boolean {
  const secret = process.env.AUTH_SECRET
  return Boolean(secret && secret.trim().length > 0)
}

function getAuthSecret(): string {
  return (process.env.AUTH_SECRET || '').trim()
}

export function createSessionToken(): string {
  const secret = getAuthSecret()
  if (!secret) return 'unprotected'

  const timestamp = Date.now().toString()
  const payload = `operator:${timestamp}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return `${payload}:${signature}`
}

export function verifySessionToken(token: string | undefined | null): boolean {
  if (!isAuthRequired()) return true
  if (!token) return false

  const parts = token.split(':')
  if (parts.length !== 3) return false

  const [prefix, timestampStr, providedSignature] = parts
  if (prefix !== 'operator') return false

  const timestamp = parseInt(timestampStr, 10)
  if (isNaN(timestamp)) return false

  // Verify expiry (30 days)
  const age = Date.now() - timestamp
  if (age > SESSION_MAX_AGE_SECONDS * 1000 || age < -60000) return false

  const payload = `${prefix}:${timestampStr}`
  const expectedSignature = crypto
    .createHmac('sha256', getAuthSecret())
    .update(payload)
    .digest('hex')

  // Timing safe comparison to protect against timing attacks
  try {
    const a = Buffer.from(providedSignature, 'hex')
    const b = Buffer.from(expectedSignature, 'hex')
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export function verifyPassword(providedPassword: string): boolean {
  if (!isAuthRequired()) return true
  const secret = getAuthSecret()

  try {
    const a = Buffer.from(providedPassword.trim())
    const b = Buffer.from(secret)
    return a.length === b.length && crypto.timingSafeEqual(a, b)
  } catch {
    return false
  }
}

export async function checkIsAuthenticated(req?: Request): Promise<boolean> {
  if (!isAuthRequired()) return true

  // 1. Direct Request object inspection if provided (Route Handlers & Tests)
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1].trim()
        if (verifySessionToken(token) || verifyPassword(token)) {
          return true
        }
      }
    }
    const apiKey = req.headers.get('x-api-key')
    if (apiKey && verifyPassword(apiKey)) {
      return true
    }

    const cookieHeader = req.headers.get('cookie')
    if (cookieHeader) {
      const parsedCookies = Object.fromEntries(
        cookieHeader.split(';').map((c) => {
          const [k, ...v] = c.trim().split('=')
          return [k, v.join('=')]
        })
      )
      if (verifySessionToken(parsedCookies[COOKIE_NAME])) {
        return true
      }
    }
  }

  // 2. Check Next.js HTTP Headers (Bearer token or x-api-key for external API clients)
  try {
    const headerStore = await headers()
    const authHeader = headerStore.get('authorization')
    if (authHeader) {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1].trim()
        if (verifySessionToken(token) || verifyPassword(token)) {
          return true
        }
      }
    }
    const apiKey = headerStore.get('x-api-key')
    if (apiKey && verifyPassword(apiKey)) {
      return true
    }
  } catch {
    // headers() might throw outside Next.js request context (e.g. scripts/unit tests)
  }

  // 3. Check Next.js Operator Session Cookie (Browser clients)
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(COOKIE_NAME)
    return verifySessionToken(sessionCookie?.value)
  } catch {
    return false
  }
}

export async function setOperatorSession(): Promise<void> {
  const token = createSessionToken()
  const cookieStore = await cookies()

  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_MAX_AGE_SECONDS,
  })
}

export async function clearOperatorSession(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
