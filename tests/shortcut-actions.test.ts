import test from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'
import {
  updateShortcutOverridesAction,
  resetShortcutsAction,
} from '@/app/actions/shortcuts'

async function setup() {
  await ensureDbInitialized()
  delete process.env.AUTH_SECRET
  await db
    .updateTable('workspace_settings')
    .set({ passcode_hash: null, is_claimed: 0 })
    .where('id', '=', 'current')
    .execute()
}

test('save-override-roundtrip', async () => {
  await setup()

  const res = await updateShortcutOverridesAction({
    overrides: {
      'deal.new': ['alt+n'],
    },
  })

  assert.strictEqual(res.ok, true)
  if (res.ok) {
    assert.deepStrictEqual(res.data.overrides['deal.new'], ['alt+n'])
  }

  const settings = await repo.getWorkspaceSettings()
  assert.ok(settings)
  assert.deepStrictEqual(settings.shortcutOverrides?.['deal.new'], ['alt+n'])
})

test('save-conflicting-override-rejected', async () => {
  await setup()

  // 1. Conflict with another action in the same scope (deal.new conflicts with activity.log)
  const resDuplicate = await updateShortcutOverridesAction({
    overrides: {
      'deal.new': ['l'],
    },
  })
  assert.strictEqual(resDuplicate.ok, false)
  if (!resDuplicate.ok) {
    assert.strictEqual(resDuplicate.error.code, 'SHORTCUT_CONFLICT')
  }

  // 2. Conflict with browser reserved shortcut
  const resReserved = await updateShortcutOverridesAction({
    overrides: {
      'deal.new': ['mod+w'],
    },
  })
  assert.strictEqual(resReserved.ok, false)
  if (!resReserved.ok) {
    assert.strictEqual(resReserved.error.code, 'SHORTCUT_CONFLICT')
  }
})

test('save-locked-override-rejected', async () => {
  await setup()

  const res = await updateShortcutOverridesAction({
    overrides: {
      'palette.open': ['mod+p'],
    },
  })

  assert.strictEqual(res.ok, false)
  if (!res.ok) {
    assert.strictEqual(res.error.code, 'SHORTCUT_LOCKED')
  }
})

test('override-equal-to-default-is-dropped', async () => {
  await setup()

  // 'deal.new' default is ['n']. Passing ['n'] should drop it from saved diff.
  const res = await updateShortcutOverridesAction({
    overrides: {
      'deal.new': ['n'],
      'contact.new': ['alt+c'],
    },
  })

  assert.strictEqual(res.ok, true)
  if (res.ok) {
    assert.strictEqual(res.data.overrides['deal.new'], undefined)
    assert.deepStrictEqual(res.data.overrides['contact.new'], ['alt+c'])
  }

  const settings = await repo.getWorkspaceSettings()
  assert.ok(settings)
  assert.strictEqual(settings.shortcutOverrides?.['deal.new'], undefined)
  assert.deepStrictEqual(settings.shortcutOverrides?.['contact.new'], ['alt+c'])
})

test('reset-clears-overrides', async () => {
  await setup()

  // Save an override first
  await updateShortcutOverridesAction({
    overrides: {
      'contact.new': ['alt+c'],
    },
  })

  // Reset
  const res = await resetShortcutsAction()
  assert.strictEqual(res.ok, true)
  if (res.ok) {
    assert.deepStrictEqual(res.data.overrides, {})
  }

  const settings = await repo.getWorkspaceSettings()
  assert.ok(settings)
  assert.deepStrictEqual(settings.shortcutOverrides, {})
})
