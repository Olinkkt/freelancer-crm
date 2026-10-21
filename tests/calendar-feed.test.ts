import { describe, it, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '../lib/db/client'
import { ensureDbInitialized } from '../lib/db/init'
import {
  getOrCreateCalendarFeedToken,
  regenerateCalendarFeedToken,
  claimWorkspace,
  createDeal,
  logActivity,
} from '../lib/db/repository'
import { GET as getFeedRoute } from '../app/api/calendar/feed/[token]/route'
import {
  getCalendarFeedInfoAction,
  regenerateCalendarFeedTokenAction,
} from '../app/actions/calendar-feed'

describe('Calendar Subscription Feed (iCal / RFC 5545)', () => {
  const originalAuthSecret = process.env.AUTH_SECRET

  beforeEach(async () => {
    delete process.env.AUTH_SECRET
    await ensureDbInitialized(true)

    // Clean up test tables
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('companies').execute()
    await db.deleteFrom('workspace_settings').execute()

    // Seed workspace
    await claimWorkspace({
      operatorName: 'Alex Rivera',
      operatorEmail: 'alex@example.com',
      currency: 'USD',
      currencySymbol: '$',
      locale: 'en-US',
    })
  })

  after(async () => {
    if (originalAuthSecret !== undefined) {
      process.env.AUTH_SECRET = originalAuthSecret
    } else {
      delete process.env.AUTH_SECRET
    }
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('companies').execute()
    await db.deleteFrom('workspace_settings').execute()
  })

  describe('Database Token Management', () => {
    it('getOrCreateCalendarFeedToken creates and persists a token on first call', async () => {
      const token1 = await getOrCreateCalendarFeedToken()
      assert.ok(token1)
      assert.equal(token1.length, 48) // 24 bytes hex

      const token2 = await getOrCreateCalendarFeedToken()
      assert.equal(token2, token1)
    })

    it('regenerateCalendarFeedToken rotates the token and changes it', async () => {
      const initialToken = await getOrCreateCalendarFeedToken()
      const newToken = await regenerateCalendarFeedToken()

      assert.ok(newToken)
      assert.notEqual(newToken, initialToken)

      const currentToken = await getOrCreateCalendarFeedToken()
      assert.equal(currentToken, newToken)
    })
  })

  describe('GET /api/calendar/feed/[token]', () => {
    it('returns 401 when token is invalid or does not match', async () => {
      await getOrCreateCalendarFeedToken()

      const req = new Request('http://localhost:3000/api/calendar/feed/wrong-token')
      const res = await getFeedRoute(req, {
        params: Promise.resolve({ token: 'wrong-token' }),
      })

      assert.equal(res.status, 401)
      const text = await res.text()
      assert.ok(text.includes('Unauthorized'))
    })

    it('returns 200 with text/calendar and valid ICS content when token is valid', async () => {
      const token = await getOrCreateCalendarFeedToken()

      // Seed an active deal with milestone
      await createDeal({
        title: 'Platform Redesign',
        company: 'Apex Labs',
        value: '$15,000',
        rawAmount: 15000,
        stage: 'Proposal',
        probability: '70%',
        next: 'Client design review',
        nextDueDate: '2026-10-30',
        color: 'blue',
      })

      // Seed an upcoming activity
      await logActivity({
        type: 'Call',
        person: 'Sarah Connor',
        company: 'Cyberdyne',
        title: 'Security audit sync',
        date: '2026-10-28T16:00:00.000Z',
        status: 'Upcoming',
        color: 'amber',
        summary: 'Review pentest findings',
      })

      const req = new Request(`http://localhost:3000/api/calendar/feed/${token}`)
      const res = await getFeedRoute(req, {
        params: Promise.resolve({ token }),
      })

      assert.equal(res.status, 200)
      assert.equal(res.headers.get('content-type'), 'text/calendar; charset=utf-8')
      assert.equal(res.headers.get('content-disposition'), 'inline; filename="freelancer-crm.ics"')

      const ics = await res.text()
      assert.ok(ics.startsWith('BEGIN:VCALENDAR\r\n'))
      assert.ok(ics.includes('SUMMARY:Milestone: Client design review (Apex Labs)'))
      assert.ok(ics.includes('SUMMARY:Call: Sarah Connor - Security audit sync'))
      assert.ok(ics.endsWith('END:VCALENDAR\r\n'))
    })

    it('invalidates feed access immediately when token is regenerated', async () => {
      const oldToken = await getOrCreateCalendarFeedToken()

      const reqOld = new Request(`http://localhost:3000/api/calendar/feed/${oldToken}`)
      const resOldBefore = await getFeedRoute(reqOld, {
        params: Promise.resolve({ token: oldToken }),
      })
      assert.equal(resOldBefore.status, 200)

      // Rotate token
      const newToken = await regenerateCalendarFeedToken()

      // Old token should now be 401
      const resOldAfter = await getFeedRoute(reqOld, {
        params: Promise.resolve({ token: oldToken }),
      })
      assert.equal(resOldAfter.status, 401)

      // New token should be 200
      const reqNew = new Request(`http://localhost:3000/api/calendar/feed/${newToken}`)
      const resNew = await getFeedRoute(reqNew, {
        params: Promise.resolve({ token: newToken }),
      })
      assert.equal(resNew.status, 200)
    })
  })

  describe('Server Actions', () => {
    it('getCalendarFeedInfoAction returns webcal and google calendar subscription URLs', async () => {
      const info = await getCalendarFeedInfoAction()
      assert.equal(info.success, true)
      assert.ok(info.token)
      assert.ok(info.feedUrl.includes(`/api/calendar/feed/${info.token}`))
      assert.ok(info.webcalUrl.startsWith('webcal://'))
      assert.ok(info.googleCalendarUrl.includes('calendar.google.com/calendar/r/settings/addbyurl'))
    })

    it('regenerateCalendarFeedTokenAction returns new token and updated URLs', async () => {
      const initial = await getCalendarFeedInfoAction()
      const regenerated = await regenerateCalendarFeedTokenAction()

      assert.equal(regenerated.success, true)
      assert.notEqual(regenerated.token, initial.token)
      assert.ok(regenerated.feedUrl.includes(regenerated.token))
    })

    it('rejects unauthenticated requests when AUTH_SECRET is set', async () => {
      process.env.AUTH_SECRET = 'super-secret-passcode'

      await assert.rejects(
        () => getCalendarFeedInfoAction(),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () => regenerateCalendarFeedTokenAction(),
        /Unauthorized: Please authenticate to access workspace/
      )
    })
  })
})
