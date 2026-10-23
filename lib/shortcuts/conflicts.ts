import { CONTEXT_SCOPES, ShortcutContext } from './contexts'
import { SHORTCUTS } from './registry'
import type { Conflict, ShortcutDef, ShortcutId } from './types'
import { parseBinding } from './keys'

export const RESERVED_BINDINGS = [
  'tab',
  'shift+tab',
  'mod+w',
  'mod+t',
  'mod+n',
  'mod+r',
  'mod+l',
  'mod+q',
] as const

export function findConflicts(
  bindings: Record<string, string[]>,
  shortcuts: readonly ShortcutDef[] = SHORTCUTS
): Conflict[] {
  const conflicts: Conflict[] = []
  const contexts = Object.keys(CONTEXT_SCOPES) as ShortcutContext[]

  // Locked shortcuts in registry
  const lockedShortcutIds = new Set(shortcuts.filter((s) => s.locked).map((s) => s.id))

  for (const context of contexts) {
    const scopes = CONTEXT_SCOPES[context]

    // Active shortcuts in this context
    const activeShortcuts = shortcuts.filter((s) => {
      if (context === 'form' || context === 'help') {
        return scopes.includes(s.scope) || (s.scope === 'global' && s.locked)
      }
      return scopes.includes(s.scope)
    })

    // Map of normalized binding -> array of { shortcutId, isLocked }
    const bindingToShortcuts = new Map<string, { id: ShortcutId; locked: boolean }[]>()
    // Map of single-step binding -> array of shortcutIds
    const singleStepMap = new Map<string, ShortcutId[]>()
    // Map of two-step binding -> array of { prefix, shortcutId }
    const twoStepList: { prefix: string; id: ShortcutId }[] = []

    for (const shortcut of activeShortcuts) {
      const isLocked = lockedShortcutIds.has(shortcut.id)
      const rawBindings = isLocked ? shortcut.defaults : bindings[shortcut.id] ?? shortcut.defaults

      for (const raw of rawBindings) {
        const parsed = parseBinding(raw)
        if (!parsed || parsed.length === 0) continue

        const canonical = parsed.join(' ')

        // 1. Check RESERVED
        if ((RESERVED_BINDINGS as readonly string[]).includes(canonical)) {
          conflicts.push({
            type: 'reserved',
            binding: canonical,
            ids: [shortcut.id],
            context,
          })
        }

        // Store for duplicate and locked check
        const existing = bindingToShortcuts.get(canonical) || []
        existing.push({ id: shortcut.id, locked: isLocked })
        bindingToShortcuts.set(canonical, existing)

        // Store for prefix check
        if (parsed.length === 1) {
          const list = singleStepMap.get(canonical) || []
          list.push(shortcut.id)
          singleStepMap.set(canonical, list)
        } else if (parsed.length === 2) {
          twoStepList.push({ prefix: parsed[0], id: shortcut.id })
        }
      }
    }

    // 2. Check duplicates and locked action usage
    for (const [binding, entries] of bindingToShortcuts.entries()) {
      const uniqueIds = Array.from(new Set(entries.map((e) => e.id)))
      const hasLocked = entries.some((e) => e.locked)
      const hasUnlocked = entries.some((e) => !e.locked)

      if (hasLocked && hasUnlocked) {
        // An unlocked action is using a locked action's binding
        const unlockedIds = entries.filter((e) => !e.locked).map((e) => e.id)
        conflicts.push({
          type: 'reserved',
          binding,
          ids: unlockedIds,
          context,
        })
      } else if (uniqueIds.length > 1) {
        // Two actions sharing the same binding
        conflicts.push({
          type: 'duplicate',
          binding,
          ids: uniqueIds,
          context,
        })
      }
    }

    // 3. Check prefix conflicts: single-step equals first step of two-step
    for (const twoStep of twoStepList) {
      const singleStepIds = singleStepMap.get(twoStep.prefix)
      if (singleStepIds) {
        for (const singleId of singleStepIds) {
          if (singleId !== twoStep.id) {
            conflicts.push({
              type: 'prefix',
              binding: twoStep.prefix,
              ids: [singleId, twoStep.id],
              context,
            })
          }
        }
      }
    }
  }

  // Deduplicate exact duplicate conflict objects if any
  const seen = new Set<string>()
  const deduped: Conflict[] = []
  for (const c of conflicts) {
    const key = `${c.type}:${c.binding}:${c.context}:${[...c.ids].sort().join(',')}`
    if (!seen.has(key)) {
      seen.add(key)
      deduped.push(c)
    }
  }

  return deduped
}
