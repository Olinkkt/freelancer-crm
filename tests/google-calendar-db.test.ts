import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as gcalRepo from '@/lib/db/google-calendar-repository'

describe('Google Calendar Database Repository', () => {
  before(async () => {
    await ensureDbInitialized()
  })

  after(async () => {
    await db.deleteFrom('google_calendar_integrations').execute()
    await db.deleteFrom('google_calendar_events').execute()
  })

  beforeEach(async () => {
    await db.deleteFrom('google_calendar_integrations').execute()
    await db.deleteFrom('google_calendar_events').execute()
  })

  describe('Integration & OAuth Tokens CRUD', () => {
    it('returns null when no integration exists', async () => {
      const integration = await gcalRepo.getGoogleCalendarIntegration()
      assert.equal(integration, null)
    })

    it('inserts a new integration when saving tokens for the first time', async () => {
      const expiry = Date.now() + 3600 * 1000
      const saved = await gcalRepo.saveGoogleCalendarTokens({
        access_token: 'ya29.initial_test_token',
        refresh_token: '1//refresh_initial_test',
        token_expiry: expiry,
        calendar_id: 'freelancer-cal@group.calendar.google.com',
        calendar_name: 'Freelancer Work',
      })

      assert.equal(saved.id, 'singleton')
      assert.equal(saved.access_token, 'ya29.initial_test_token')
      assert.equal(saved.refresh_token, '1//refresh_initial_test')
      assert.equal(saved.token_expiry, expiry)
      assert.equal(saved.calendar_id, 'freelancer-cal@group.calendar.google.com')
      assert.equal(saved.calendar_name, 'Freelancer Work')
      assert.equal(saved.auto_sync, true)
      assert.equal(saved.last_synced_at, null)
      assert.ok(saved.created_at)
      assert.ok(saved.updated_at)

      const fetched = await gcalRepo.getGoogleCalendarIntegration()
      assert.notEqual(fetched, null)
      assert.equal(fetched?.access_token, 'ya29.initial_test_token')
      assert.equal(fetched?.refresh_token, '1//refresh_initial_test')
      assert.equal(fetched?.auto_sync, true)
      assert.equal(typeof fetched?.token_expiry, 'number')
    })

    it('updates existing tokens and preserves refresh_token if not provided on token refresh', async () => {
      const expiry1 = Date.now() + 3600 * 1000
      await gcalRepo.saveGoogleCalendarTokens({
        access_token: 'ya29.token_v1',
        refresh_token: '1//persistent_refresh_token',
        token_expiry: expiry1,
      })

      const expiry2 = Date.now() + 7200 * 1000
      const updated = await gcalRepo.saveGoogleCalendarTokens({
        access_token: 'ya29.token_v2_refreshed',
        // Note: refresh_token omitted, typical for token refresh responses
        token_expiry: expiry2,
      })

      assert.equal(updated.access_token, 'ya29.token_v2_refreshed')
      assert.equal(updated.refresh_token, '1//persistent_refresh_token')
      assert.equal(updated.token_expiry, expiry2)

      const fetched = await gcalRepo.getGoogleCalendarIntegration()
      assert.equal(fetched?.access_token, 'ya29.token_v2_refreshed')
      assert.equal(fetched?.refresh_token, '1//persistent_refresh_token')
    })

    it('updates integration settings (calendar_id, calendar_name, auto_sync, last_synced_at)', async () => {
      // Should return null when updating settings on non-existent integration
      const nonExistent = await gcalRepo.updateGoogleCalendarSettings({
        auto_sync: false,
      })
      assert.equal(nonExistent, null)

      // Create integration first
      await gcalRepo.saveGoogleCalendarTokens({
        access_token: 'ya29.valid_token',
        token_expiry: Date.now() + 3600000,
      })

      const nowIso = new Date().toISOString()
      const updated = await gcalRepo.updateGoogleCalendarSettings({
        calendar_id: 'primary',
        calendar_name: 'Personal Primary',
        auto_sync: false,
        last_synced_at: nowIso,
      })

      assert.notEqual(updated, null)
      assert.equal(updated?.calendar_id, 'primary')
      assert.equal(updated?.calendar_name, 'Personal Primary')
      assert.equal(updated?.auto_sync, false)
      assert.equal(updated?.last_synced_at, nowIso)

      // Verify persistence in DB
      const fetched = await gcalRepo.getGoogleCalendarIntegration()
      assert.equal(fetched?.auto_sync, false)
      assert.equal(fetched?.calendar_name, 'Personal Primary')
      assert.equal(fetched?.last_synced_at, nowIso)
    })

    it('deletes integration and returns true when existed, false when empty', async () => {
      // When empty
      const emptyDelete = await gcalRepo.deleteGoogleCalendarIntegration()
      assert.equal(emptyDelete, false)

      // When populated
      await gcalRepo.saveGoogleCalendarTokens({
        access_token: 'ya29.to_delete',
        token_expiry: Date.now() + 3600000,
      })

      const deleteResult = await gcalRepo.deleteGoogleCalendarIntegration()
      assert.equal(deleteResult, true)

      const fetchedAfter = await gcalRepo.getGoogleCalendarIntegration()
      assert.equal(fetchedAfter, null)
    })
  })

  describe('Event Mapping CRUD', () => {
    it('creates, reads, and deletes event mappings by CRM entity', async () => {
      const mapping = await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'activity',
        crm_id: 'act-101',
        google_event_id: 'gcal_evt_abc123',
      })

      assert.ok(mapping.id)
      assert.equal(mapping.crm_type, 'activity')
      assert.equal(mapping.crm_id, 'act-101')
      assert.equal(mapping.google_event_id, 'gcal_evt_abc123')
      assert.ok(mapping.synced_at)

      // Lookup by crm_id and crm_type
      const found = await gcalRepo.getGoogleCalendarEventMapping('act-101', 'activity')
      assert.notEqual(found, null)
      assert.equal(found?.google_event_id, 'gcal_evt_abc123')

      // Lookup with non-matching type returns null
      const notFound = await gcalRepo.getGoogleCalendarEventMapping('act-101', 'deal')
      assert.equal(notFound, null)

      // Lookup by Google ID
      const foundByGoogle = await gcalRepo.getGoogleCalendarEventMappingByGoogleId('gcal_evt_abc123')
      assert.notEqual(foundByGoogle, null)
      assert.equal(foundByGoogle?.crm_id, 'act-101')

      // Delete by crm_id and crm_type
      const deleted = await gcalRepo.deleteGoogleCalendarEventMapping('act-101', 'activity')
      assert.equal(deleted, true)

      // Second deletion returns false
      const deletedAgain = await gcalRepo.deleteGoogleCalendarEventMapping('act-101', 'activity')
      assert.equal(deletedAgain, false)

      const afterDelete = await gcalRepo.getGoogleCalendarEventMapping('act-101', 'activity')
      assert.equal(afterDelete, null)
    })

    it('updates mapping when saving same crm_id and crm_type with new google_event_id', async () => {
      const original = await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'deal',
        crm_id: 'deal-999',
        google_event_id: 'old_gcal_id_1',
      })

      const updated = await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'deal',
        crm_id: 'deal-999',
        google_event_id: 'new_gcal_id_2',
      })

      assert.equal(updated.id, original.id)
      assert.equal(updated.google_event_id, 'new_gcal_id_2')

      const fetched = await gcalRepo.getGoogleCalendarEventMapping('deal-999', 'deal')
      assert.equal(fetched?.google_event_id, 'new_gcal_id_2')
    })

    it('updates mapping when saving same google_event_id with new CRM entity', async () => {
      const original = await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'milestone',
        crm_id: 'ms-1',
        google_event_id: 'shared_google_event_id',
      })

      const updated = await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'milestone',
        crm_id: 'ms-2',
        google_event_id: 'shared_google_event_id',
      })

      assert.equal(updated.id, original.id)
      assert.equal(updated.crm_id, 'ms-2')

      const foundOld = await gcalRepo.getGoogleCalendarEventMapping('ms-1', 'milestone')
      assert.equal(foundOld, null)

      const foundNew = await gcalRepo.getGoogleCalendarEventMapping('ms-2', 'milestone')
      assert.notEqual(foundNew, null)
      assert.equal(foundNew?.google_event_id, 'shared_google_event_id')
    })

    it('deletes mapping by googleEventId and supports batch list/clear', async () => {
      await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'activity',
        crm_id: 'act-1',
        google_event_id: 'gid-1',
      })
      await gcalRepo.saveGoogleCalendarEventMapping({
        crm_type: 'activity',
        crm_id: 'act-2',
        google_event_id: 'gid-2',
      })

      let all = await gcalRepo.listGoogleCalendarEventMappings()
      assert.equal(all.length, 2)

      const deletedByGid = await gcalRepo.deleteGoogleCalendarEventMappingByGoogleId('gid-1')
      assert.equal(deletedByGid, true)

      const deletedAgain = await gcalRepo.deleteGoogleCalendarEventMappingByGoogleId('gid-1')
      assert.equal(deletedAgain, false)

      all = await gcalRepo.listGoogleCalendarEventMappings()
      assert.equal(all.length, 1)
      assert.equal(all[0].google_event_id, 'gid-2')

      const clearedCount = await gcalRepo.clearAllGoogleCalendarEventMappings()
      assert.equal(clearedCount, 1)

      const finalMappings = await gcalRepo.listGoogleCalendarEventMappings()
      assert.equal(finalMappings.length, 0)
    })
  })
})
