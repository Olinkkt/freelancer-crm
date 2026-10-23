import { parseBinding } from './keys'
import { SHORTCUTS } from './registry'
import type { ShortcutDef, ShortcutId } from './types'

export function resolveBindings(
  shortcuts: readonly ShortcutDef[] = SHORTCUTS,
  overrides?: Record<string, string[]> | null
): Record<ShortcutId, string[]> {
  const result: Record<string, string[]> = {}

  for (const s of shortcuts) {
    if (s.locked) {
      result[s.id] = [...s.defaults]
      continue
    }

    const candidate = overrides?.[s.id]
    if (candidate && Array.isArray(candidate) && candidate.length > 0) {
      let allValid = true
      const parsedList: string[] = []
      for (const b of candidate) {
        if (typeof b !== 'string') {
          allValid = false
          break
        }
        const parsed = parseBinding(b)
        if (!parsed || parsed.length === 0) {
          allValid = false
          break
        }
        parsedList.push(parsed.join(' '))
      }

      if (allValid && parsedList.length > 0) {
        result[s.id] = parsedList
      } else {
        result[s.id] = [...s.defaults]
      }
    } else {
      result[s.id] = [...s.defaults]
    }
  }

  return result
}

export function normalizeOverrides(
  overrides: Record<string, string[]>,
  shortcuts: readonly ShortcutDef[] = SHORTCUTS
): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  const shortcutMap = new Map<string, ShortcutDef>(shortcuts.map((s) => [s.id, s]))

  for (const [id, bindings] of Object.entries(overrides)) {
    const s = shortcutMap.get(id)
    if (!s || s.locked) continue
    if (!Array.isArray(bindings) || bindings.length === 0) continue

    let allValid = true
    const parsedList: string[] = []
    for (const b of bindings) {
      if (typeof b !== 'string') {
        allValid = false
        break
      }
      const parsed = parseBinding(b)
      if (!parsed || parsed.length === 0) {
        allValid = false
        break
      }
      parsedList.push(parsed.join(' '))
    }

    if (!allValid || parsedList.length === 0) continue

    // If equal to defaults, drop it
    const defaultCanonical = s.defaults.map((d) => {
      const p = parseBinding(d)
      return p ? p.join(' ') : d
    })

    const isSameAsDefault =
      parsedList.length === defaultCanonical.length &&
      parsedList.every((val, idx) => val === defaultCanonical[idx])

    if (!isSameAsDefault) {
      result[id] = parsedList
    }
  }

  return result
}
