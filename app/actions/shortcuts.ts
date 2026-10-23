'use server'

import { z } from 'zod'
import { runAction, DomainError, type ActionResult } from '@/lib/projects/action-result'
import { shortcutOverridesInput } from '@/lib/validations/projects'
import { SHORTCUTS } from '@/lib/shortcuts/registry'
import { parseBinding } from '@/lib/shortcuts/keys'
import { findConflicts } from '@/lib/shortcuts/conflicts'
import { resolveBindings, normalizeOverrides } from '@/lib/shortcuts/overrides'
import { updateShortcutOverrides } from '@/lib/db/repository'

const emptyInput = z.object({}).optional()

export async function updateShortcutOverridesAction(
  input: z.input<typeof shortcutOverridesInput>
): Promise<ActionResult<{ overrides: Record<string, string[]> }>> {
  return runAction<typeof shortcutOverridesInput, { overrides: Record<string, string[]> }>(
    shortcutOverridesInput,
    input,
    async (data) => {
      const shortcutMap = new Map(SHORTCUTS.map((s) => [s.id, s]))

      // 1. Validate shortcut IDs and bindings
      for (const [id, bindings] of Object.entries(data.overrides)) {
        const def = shortcutMap.get(id)
        if (!def) {
          throw new DomainError('VALIDATION', `Unknown shortcut id: ${id}`, { id })
        }
        if (def.locked) {
          throw new DomainError('SHORTCUT_LOCKED', `Shortcut cannot be rebound: ${id}`, { id })
        }
        for (const b of bindings) {
          const parsed = parseBinding(b)
          if (!parsed) {
            throw new DomainError('VALIDATION', `Invalid binding syntax: ${b}`, { id, binding: b })
          }
        }
      }

      // 2. Resolve proposed bindings and find conflicts
      const resolved = resolveBindings(SHORTCUTS, data.overrides)
      const conflicts = findConflicts(resolved)
      if (conflicts.length > 0) {
        throw new DomainError('SHORTCUT_CONFLICT', 'Shortcut conflicts detected', { conflicts })
      }

      // 3. Normalise (drop defaults and locked/invalid) and persist
      const normalised = normalizeOverrides(data.overrides)
      await updateShortcutOverrides(normalised)

      return { data: { overrides: normalised } }
    },
    'Failed to update shortcuts'
  )
}

export async function resetShortcutsAction(
  input: z.input<typeof emptyInput> = {}
): Promise<ActionResult<{ overrides: Record<string, string[]> }>> {
  return runAction<typeof emptyInput, { overrides: Record<string, string[]> }>(
    emptyInput,
    input,
    async () => {
      await updateShortcutOverrides({})
      return { data: { overrides: {} } }
    },
    'Failed to reset shortcuts'
  )
}
