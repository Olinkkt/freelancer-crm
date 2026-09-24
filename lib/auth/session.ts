import crypto from 'crypto'
import { cookies } from 'next/headers'

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

export async function checkIsAuthenticated(): Promise<boolean> {
  if (!isAuthRequired()) return true

  const cookieStore = await cookies()
  const sessionCookie = cookieStore.get(COOKIE_NAME)
  return verifySessionToken(sessionCookie?.value)
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
