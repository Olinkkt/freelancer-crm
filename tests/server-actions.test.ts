import { describe, it, before, beforeEach, afterEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import {
  getAuthStatus,
  loginOperator,
  claimWorkspaceAction,
  updateWorkspaceSettingsAction,
} from '@/app/actions/auth'
import {
  fetchWorkspaceData,
  createDealAction,
  updateDealAction,
  deleteDealAction,
  moveDealStageAction,
  createCompanyAction,
  createContactAction,
  logActivityAction,
  toggleFollowUpAction,
  syncTodosAction,
} from '@/app/actions/crm'

describe('Server Actions Integration', () => {
  const originalSecret = process.env.AUTH_SECRET

  before(async () => {
    await ensureDbInitialized()
  })

  after(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
    await db.updateTable('workspace_settings').set({ passcode_hash: null, is_claimed: 0 }).where('id', '=', 'current').execute()
  })

  beforeEach(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
  })

  afterEach(() => {
    process.env.AUTH_SECRET = originalSecret
  })

  describe('Auth Gated Mode (AUTH_SECRET is set)', () => {
    beforeEach(() => {
      process.env.AUTH_SECRET = 'secure-key-999'
    })

    it('getAuthStatus reports required=true and authenticated=false without session', async () => {
      const status = await getAuthStatus()
      assert.equal(status.required, true)
      assert.equal(status.authenticated, false)
    })

    it('loginOperator rejects incorrect passcode without setting cookie', async () => {
      const result = await loginOperator('wrong-passcode')
      assert.equal(result.success, false)
      assert.equal(result.error, 'Incorrect operator passcode.')
    })

    it('rejects CRM server actions with Unauthorized error when unauthenticated', async () => {
      await assert.rejects(
        () => fetchWorkspaceData(),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () =>
          createDealAction({
            title: 'Hacked Deal',
            company: 'EvilCorp',
            value: '1000 Kč',
            rawAmount: 1000,
            stage: 'Lead',
            probability: '10%',
            next: 'Call',
            color: 'blue',
          }),
        /Unauthorized: Please authenticate to access workspace/
      )

      await assert.rejects(
        () =>
          createCompanyAction({
            name: 'EvilCorp',
            type: 'Client',
            contact: 'None',
            email: 'none@evil.com',
            deals: 0,
            value: '0 Kč',
            status: 'Active',
            color: 'blue',
          }),
        /Unauthorized: Please authenticate to access workspace/
      )
    })
  })

  describe('Open Workspace Mode (AUTH_SECRET is unset)', () => {
    beforeEach(() => {
      delete process.env.AUTH_SECRET
    })

    it('getAuthStatus reports required=false and authenticated=true', async () => {
      const status = await getAuthStatus()
      assert.equal(status.required, false)
      assert.equal(status.authenticated, true)
    })

    it('loginOperator returns success=true immediately', async () => {
      const res = await loginOperator('')
      assert.equal(res.success, true)
    })

    it('allows all CRM server actions without restrictions', async () => {
      // 1. Create deal action
      const deal = await createDealAction({
        title: 'Ecommerce Redesign',
        company: 'RetailHub',
        value: '120 000 Kč',
        rawAmount: 120000,
        stage: 'Lead',
        probability: '40%',
        next: 'Demo call',
        color: 'blue',
      })
      assert.ok(deal.id)
      assert.equal(deal.title, 'Ecommerce Redesign')

      // 2. Fetch workspace action
      const workspace = await fetchWorkspaceData()
      assert.equal(workspace.deals.length, 1)
      assert.equal(workspace.companies.length, 1)

      // 3. Move stage action
      const moved = await moveDealStageAction(deal.id, 'Won')
      assert.ok(moved)
      assert.equal(moved.stage, 'Won')
      assert.equal(moved.probability, '100%')

      // 4. Update deal action
      const updated = await updateDealAction({
        ...deal,
        title: 'Ecommerce Redesign Pro',
        stage: 'Won',
      })
      assert.equal(updated.title, 'Ecommerce Redesign Pro')

      // 5. Create contact action
      const contact = await createContactAction({
        name: 'George Retail',
        company: 'RetailHub',
        role: 'COO',
        email: 'george@retailhub.com',
        deals: 1,
        lastTouch: 'Today',
        color: 'blue',
      })
      assert.ok(contact.id)

      // 6. Log activity action
      const actResult = await logActivityAction(
        {
          type: 'Call',
          title: 'Contract signing',
          person: 'George Retail',
          company: 'RetailHub',
          date: '2026-09-25',
          status: 'Completed',
          color: 'blue',
        },
        {
          day: 'Tomorrow',
          company: 'RetailHub',
          action: 'Send invoice #1',
          time: '09:00',
          tone: 'urgent',
          completed: false,
        },
        deal.id
      )
      assert.ok(actResult.activity.id)
      assert.ok(actResult.followUp)

      // 7. Toggle follow up action
      const toggled = await toggleFollowUpAction(actResult.followUp.id)
      assert.equal(toggled, true)

      // 8. Sync todos action
      const todos = await syncTodosAction(['Prepare kickoff meeting'], 'RetailHub', deal.id)
      assert.equal(todos.length, 1)

      // 9. Delete deal action
      const deleted = await deleteDealAction(deal.id)
      assert.equal(deleted, true)
    })
  })

  describe('First-Run Setup Wizard & Workspace Settings', () => {
    beforeEach(async () => {
      delete process.env.AUTH_SECRET
      await db.deleteFrom('workspace_settings').execute()
    })

    it('claims workspace and locks it from subsequent claims', async () => {
      let status = await getAuthStatus()
      assert.equal(status.isSetupComplete, false)

      // First run claim
      const claimRes = await claimWorkspaceAction({
        operatorName: 'Alex River',
        operatorEmail: 'alex@river.dev',
        operatorRole: 'Mobile Architect',
        currency: 'EUR',
        currencySymbol: '€',
        locale: 'de-DE',
        passcode: 'mypass123',
      })

      assert.equal(claimRes.success, true)
      assert.equal(claimRes.settings?.operatorName, 'Alex River')
      assert.equal(claimRes.settings?.currency, 'EUR')
      assert.equal(claimRes.settings?.currencySymbol, '€')

      // Verification: Setup is now marked complete
      status = await getAuthStatus()
      assert.equal(status.isSetupComplete, true)
      assert.equal(status.settings?.operatorName, 'Alex River')

      // Second claim attempt should fail
      const secondClaim = await claimWorkspaceAction({
        operatorName: 'Intruder',
        operatorEmail: 'intruder@bad.com',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
      })
      assert.equal(secondClaim.success, false)
      assert.equal(secondClaim.error, 'Workspace is already claimed.')
    })

    it('updates workspace settings when authenticated', async () => {
      // Claim initial
      await claimWorkspaceAction({
        operatorName: 'Taylor Swift',
        operatorEmail: 'taylor@music.com',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
      })

      // Update settings
      const updateRes = await updateWorkspaceSettingsAction({
        operatorRole: 'Lead Producer & Songwriter',
        currency: 'GBP',
        currencySymbol: '£',
      })

      assert.equal(updateRes.success, true)
      assert.equal(updateRes.settings?.operatorRole, 'Lead Producer & Songwriter')
      assert.equal(updateRes.settings?.currency, 'GBP')
      assert.equal(updateRes.settings?.currencySymbol, '£')
    })

    it('requires valid AUTH_SECRET setup token when AUTH_SECRET is set', async () => {
      process.env.AUTH_SECRET = 'admin-guard-secret'

      // Attempt claim without setupToken
      const failedClaim = await claimWorkspaceAction({
        operatorName: 'Unauthorized Claimer',
        operatorEmail: 'unauth@bad.com',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
      })
      assert.equal(failedClaim.success, false)
      assert.match(failedClaim.error || '', /AUTH_SECRET.*required/i)

      // Attempt claim with wrong setupToken
      const wrongClaim = await claimWorkspaceAction({
        operatorName: 'Unauthorized Claimer',
        operatorEmail: 'unauth@bad.com',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
        setupToken: 'wrong-secret',
      })
      assert.equal(wrongClaim.success, false)

      // Successful claim with correct setupToken
      const okClaim = await claimWorkspaceAction({
        operatorName: 'Authorized Admin',
        operatorEmail: 'admin@correct.com',
        currency: 'USD',
        currencySymbol: '$',
        locale: 'en-US',
        setupToken: 'admin-guard-secret',
      })
      assert.equal(okClaim.success, true)
    })
  })
})
