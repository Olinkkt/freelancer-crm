import { describe, it, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'crypto'
import {
  isAuthRequired,
  createSessionToken,
  verifySessionToken,
  verifyPassword,
  checkIsAuthenticated,
} from '@/lib/auth/session'

describe('Auth & Session Security', () => {
  const originalSecret = process.env.AUTH_SECRET

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret
  })

  describe('isAuthRequired()', () => {
    it('returns false when AUTH_SECRET is not defined or empty', () => {
      delete process.env.AUTH_SECRET
      assert.equal(isAuthRequired(), false)

      process.env.AUTH_SECRET = ''
      assert.equal(isAuthRequired(), false)

      process.env.AUTH_SECRET = '   '
      assert.equal(isAuthRequired(), false)
    })

    it('returns true when AUTH_SECRET is set', () => {
      process.env.AUTH_SECRET = 'super-secret-key-123'
      assert.equal(isAuthRequired(), true)
    })
  })

  describe('createSessionToken() & verifySessionToken()', () => {
    it('returns "unprotected" when auth is not required', () => {
      delete process.env.AUTH_SECRET
      const token = createSessionToken()
      assert.equal(token, 'unprotected')
      assert.equal(verifySessionToken(token), true)
    })

    it('creates and verifies a valid HMAC-SHA256 session token', () => {
      process.env.AUTH_SECRET = 'correct-operator-passcode'
      const token = createSessionToken()

      assert.ok(token.startsWith('operator:'))
      assert.equal(verifySessionToken(token), true)
    })

    it('rejects tampered signatures', () => {
      process.env.AUTH_SECRET = 'correct-operator-passcode'
      const token = createSessionToken()
      const parts = token.split(':')
      const tamperedSig = parts[2].slice(0, -2) + (parts[2].endsWith('a') ? 'b' : 'a')
      const tamperedToken = `${parts[0]}:${parts[1]}:${tamperedSig}`

      assert.equal(verifySessionToken(tamperedToken), false)
    })

    it('rejects expired tokens older than 30 days', () => {
      const secret = 'test-secret'
      process.env.AUTH_SECRET = secret
      const thirtyOneDaysAgo = Date.now() - 31 * 24 * 60 * 60 * 1000
      const payload = `operator:${thirtyOneDaysAgo}`
      const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
      const expiredToken = `${payload}:${sig}`

      assert.equal(verifySessionToken(expiredToken), false)
    })

    it('rejects tokens from the far future', () => {
      const secret = 'test-secret'
      process.env.AUTH_SECRET = secret
      const futureTime = Date.now() + 120 * 1000 // 2 minutes in future
      const payload = `operator:${futureTime}`
      const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex')
      const futureToken = `${payload}:${sig}`

      assert.equal(verifySessionToken(futureToken), false)
    })

    it('rejects malformed tokens or tokens with wrong prefix', () => {
      process.env.AUTH_SECRET = 'test-secret'
      assert.equal(verifySessionToken(''), false)
      assert.equal(verifySessionToken(null), false)
      assert.equal(verifySessionToken(undefined), false)
      assert.equal(verifySessionToken('random-string'), false)
      assert.equal(verifySessionToken('admin:12345:abc'), false)
    })
  })

  describe('verifyPassword()', () => {
    it('returns true when AUTH_SECRET is not configured', () => {
      delete process.env.AUTH_SECRET
      assert.equal(verifyPassword('any-password'), true)
    })

    it('validates correct password and rejects incorrect passwords', () => {
      process.env.AUTH_SECRET = 'secret-pass-2026'
      assert.equal(verifyPassword('secret-pass-2026'), true)
      assert.equal(verifyPassword('wrong-pass'), false)
      assert.equal(verifyPassword('secret-pass-202'), false)
      assert.equal(verifyPassword(''), false)
    })
  })

  describe('checkIsAuthenticated(req)', () => {
    beforeEach(() => {
      process.env.AUTH_SECRET = 'operator-master-key'
    })

    it('authenticates with Bearer token containing valid session token', async () => {
      const token = createSessionToken()
      const req = new Request('http://localhost:3000/api/deals', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      assert.equal(await checkIsAuthenticated(req), true)
    })

    it('authenticates with Bearer token containing master passcode', async () => {
      const req = new Request('http://localhost:3000/api/deals', {
        headers: {
          Authorization: `Bearer operator-master-key`,
        },
      })
      assert.equal(await checkIsAuthenticated(req), true)
    })

    it('authenticates with x-api-key header', async () => {
      const req = new Request('http://localhost:3000/api/deals', {
        headers: {
          'x-api-key': 'operator-master-key',
        },
      })
      assert.equal(await checkIsAuthenticated(req), true)
    })

    it('authenticates with Cookie header', async () => {
      const token = createSessionToken()
      const req = new Request('http://localhost:3000/api/deals', {
        headers: {
          Cookie: `other_cookie=123; crm_operator_session=${token}; visited=true`,
        },
      })
      assert.equal(await checkIsAuthenticated(req), true)
    })

    it('rejects invalid or missing credentials when auth is required', async () => {
      const unauthReq = new Request('http://localhost:3000/api/deals')
      assert.equal(await checkIsAuthenticated(unauthReq), false)

      const badTokenReq = new Request('http://localhost:3000/api/deals', {
        headers: { Authorization: 'Bearer bad-token' },
      })
      assert.equal(await checkIsAuthenticated(badTokenReq), false)

      const badKeyReq = new Request('http://localhost:3000/api/deals', {
        headers: { 'x-api-key': 'wrong-key' },
      })
      assert.equal(await checkIsAuthenticated(badKeyReq), false)
    })
  })
})
