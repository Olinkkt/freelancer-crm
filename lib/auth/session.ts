import crypto from 'crypto'
import { cookies, headers } from 'next/headers'

const COOKIE_NAME = 'crm_operator_session'
const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60 // 30 days

export function hashPasscode(passcode: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const derived = crypto.scryptSync(passcode.trim(), salt, 32).toString('hex')
  return `scrypt:${salt}:${derived}`
}

export function verifyPasscode(passcode: string, storedHash?: string | null): boolean {
  if (!storedHash) return false
  if (storedHash.startsWith('scrypt:')) {
    const parts = storedHash.split(':')
    if (parts.length !== 3) return false
    const [, salt, expectedHash] = parts
    const derived = crypto.scryptSync(passcode.trim(), salt, 32)
    try {
      const expected = Buffer.from(expectedHash, 'hex')
      return derived.length === expected.length && crypto.timingSafeEqual(derived, expected)
    } catch {
      return false
    }
  }
  // Fallback to legacy SHA-256 for backward compatibility
  const legacyHash = crypto.createHash('sha256').update(passcode.trim()).digest('hex')
  return legacyHash === storedHash
}

export function isAuthRequired(): boolean {
  const secret = process.env.AUTH_SECRET
  return Boolean(secret && secret.trim().length > 0)
}

function getAuthSecret(): string {
  return (process.env.AUTH_SECRET || '').trim()
}

export async function getEffectiveAuthSecret(): Promise<string> {
  const envSecret = getAuthSecret()
  if (envSecret) return envSecret

  try {
    const { getWorkspaceSettings } = await import('@/lib/db/repository')
    const settings = await getWorkspaceSettings()
    if (settings?.passcodeHash) {
      return settings.passcodeHash
    }
  } catch {
    // DB not available or running outside repository context
  }
  return ''
}

export function createSessionToken(secretOverride?: string): string {
  const secret = secretOverride || getAuthSecret()
  if (!secret) return 'unprotected'

  const timestamp = Date.now().toString()
  const payload = `operator:${timestamp}`
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return `${payload}:${signature}`
}

export function verifySessionToken(token: string | undefined | null, secretOverride?: string): boolean {
  const secret = secretOverride || getAuthSecret()
  if (!secret) {
    return token === 'unprotected'
  }
  if (!token || token === 'unprotected') return false

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
    .createHmac('sha256', secret)
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
  const effectiveSecret = await getEffectiveAuthSecret()
  if (!effectiveSecret) return true

  const isValidCred = (token: string) => {
    return (
      verifySessionToken(token, effectiveSecret) ||
      verifyPassword(token) ||
      verifyPasscode(token, effectiveSecret)
    )
  }

  // 1. Direct Request object inspection if provided (Route Handlers & Tests)
  if (req) {
    const authHeader = req.headers.get('authorization')
    if (authHeader) {
      const parts = authHeader.split(' ')
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1].trim()
        if (isValidCred(token)) {
          return true
        }
      }
    }
    const apiKey = req.headers.get('x-api-key')
    if (apiKey && isValidCred(apiKey)) {
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
      if (verifySessionToken(parsedCookies[COOKIE_NAME], effectiveSecret)) {
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
        if (isValidCred(token)) {
          return true
        }
      }
    }
    const apiKey = headerStore.get('x-api-key')
    if (apiKey && isValidCred(apiKey)) {
      return true
    }
  } catch {
    // headers() might throw outside Next.js request context (e.g. scripts/unit tests)
  }

  // 3. Check Next.js Operator Session Cookie (Browser clients)
  try {
    const cookieStore = await cookies()
    const sessionCookie = cookieStore.get(COOKIE_NAME)
    return verifySessionToken(sessionCookie?.value, effectiveSecret)
  } catch {
    return false
  }
}

export async function setOperatorSession(secretOverride?: string): Promise<void> {
  const effectiveSecret = secretOverride || (await getEffectiveAuthSecret())
  const token = createSessionToken(effectiveSecret)
  try {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_SECONDS,
    })
  } catch {
    // cookies() might not be available outside Next.js request context (e.g., node test runner)
  }
}

export async function clearOperatorSession(): Promise<void> {
  try {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  } catch {
    // cookies() might not be available outside Next.js request context
  }
}
