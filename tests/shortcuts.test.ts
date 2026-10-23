import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { SHORTCUTS } from '@/lib/shortcuts/registry'
import { findConflicts, RESERVED_BINDINGS } from '@/lib/shortcuts/conflicts'
import { resolveBindings } from '@/lib/shortcuts/overrides'
import { renderShortcutsMarkdown } from '@/lib/shortcuts/readme'
import { eventToStep, parseBinding } from '@/lib/shortcuts/keys'

test('default-bindings-have-no-conflicts', () => {
  const resolved = resolveBindings(SHORTCUTS, {})
  const conflicts = findConflicts(resolved)
  assert.deepStrictEqual(conflicts, [], `Expected 0 conflicts but found: ${JSON.stringify(conflicts)}`)
})

test('readme-shortcuts-in-sync', () => {
  const readmePath = path.resolve(process.cwd(), 'README.md')
  const content = fs.readFileSync(readmePath, 'utf-8')

  const startMarker = '<!-- shortcuts:start -->'
  const endMarker = '<!-- shortcuts:end -->'

  assert.ok(content.includes(startMarker), 'README.md is missing <!-- shortcuts:start -->')
  assert.ok(content.includes(endMarker), 'README.md is missing <!-- shortcuts:end -->')

  const startIndex = content.indexOf(startMarker) + startMarker.length
  const endIndex = content.indexOf(endMarker)
  const extracted = content.slice(startIndex, endIndex).trim()

  const generated = renderShortcutsMarkdown(SHORTCUTS).trim()
  assert.strictEqual(
    extracted,
    generated,
    'README shortcuts are out of date. Run pnpm shortcuts:readme'
  )
})

test('no-hardcoded-key-listeners', () => {
  function scanDir(dir: string, out: string[] = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        scanDir(fullPath, out)
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        out.push(fullPath)
      }
    }
    return out
  }

  const appFiles = scanDir(path.resolve(process.cwd(), 'app'))
  const componentFiles = scanDir(path.resolve(process.cwd(), 'components'))
  const allFiles = [...appFiles, ...componentFiles]

  const violations: string[] = []

  for (const filePath of allFiles) {
    const relPath = path.relative(process.cwd(), filePath).replace(/\\/g, '/')

    // Allowlist: components/shortcuts/* and components/calendar/calendar-view.tsx
    if (
      relPath.startsWith('components/shortcuts/') ||
      relPath === 'components/calendar/calendar-view.tsx'
    ) {
      continue
    }

    const code = fs.readFileSync(filePath, 'utf-8')
    if (/addEventListener\(\s*['"]keydown['"]/.test(code)) {
      violations.push(relPath)
    }
  }

  assert.deepStrictEqual(
    violations,
    [],
    `Found hardcoded addEventListener('keydown') in: ${violations.join(', ')}`
  )
})

test('registry-ids-unique', () => {
  const ids = SHORTCUTS.map((s) => s.id)
  const unique = new Set(ids)
  assert.strictEqual(ids.length, unique.size, 'Duplicate shortcut IDs detected in SHORTCUTS registry')
})

test('event-to-step-normalisation', () => {
  // Mod on Mac vs Other
  assert.strictEqual(
    eventToStep({ key: 'k', metaKey: true }, 'mac'),
    'mod+k'
  )
  assert.strictEqual(
    eventToStep({ key: 'k', ctrlKey: true }, 'other'),
    'mod+k'
  )

  // Shift with letters & uppercase
  assert.strictEqual(
    eventToStep({ key: 'e', shiftKey: true }, 'mac'),
    'shift+e'
  )
  assert.strictEqual(
    eventToStep({ key: 'E', shiftKey: true }, 'other'),
    'shift+e'
  )

  // Shift with digits
  assert.strictEqual(
    eventToStep({ key: '1', shiftKey: true }, 'mac'),
    'shift+1'
  )

  // Shift with symbols (shift is implied, produced character is the key)
  assert.strictEqual(
    eventToStep({ key: '?', shiftKey: true }, 'mac'),
    '?'
  )
  assert.strictEqual(
    eventToStep({ key: '$', shiftKey: true }, 'other'),
    '$'
  )
  assert.strictEqual(
    eventToStep({ key: '[', shiftKey: true }, 'mac'),
    '['
  )
  assert.strictEqual(
    eventToStep({ key: ']', shiftKey: true }, 'mac'),
    ']'
  )
  assert.strictEqual(
    eventToStep({ key: '/', shiftKey: true }, 'mac'),
    '/'
  )

  // Space
  assert.strictEqual(
    eventToStep({ key: ' ' }, 'mac'),
    'space'
  )

  // Bare modifiers return null
  assert.strictEqual(eventToStep({ key: 'Shift' }, 'mac'), null)
  assert.strictEqual(eventToStep({ key: 'Meta' }, 'mac'), null)
  assert.strictEqual(eventToStep({ key: 'Control' }, 'other'), null)
  assert.strictEqual(eventToStep({ key: 'Alt' }, 'other'), null)

  // Named keys with modifiers
  assert.strictEqual(
    eventToStep({ key: 'ArrowUp', altKey: true }, 'mac'),
    'alt+arrowup'
  )
  assert.strictEqual(
    eventToStep({ key: 'Enter', metaKey: true }, 'mac'),
    'mod+enter'
  )
  assert.strictEqual(
    eventToStep({ key: 'Backspace', metaKey: true }, 'mac'),
    'mod+backspace'
  )
  assert.strictEqual(
    eventToStep({ key: 'r', shiftKey: true }, 'other'),
    'shift+r'
  )
})

test('find-conflicts-duplicate-prefix-reserved', () => {
  // 1. Duplicate
  const duplicateOverrides = {
    'deal.new': ['l'], // conflicts with activity.log: ['l'] in global scope
  }
  const resolvedDup = resolveBindings(SHORTCUTS, duplicateOverrides)
  const dupConflicts = findConflicts(resolvedDup)
  const dupMatch = dupConflicts.find((c) => c.type === 'duplicate' && c.binding === 'l')
  assert.ok(dupMatch, 'Expected duplicate conflict for "l"')
  assert.ok(dupMatch.ids.includes('deal.new'))
  assert.ok(dupMatch.ids.includes('activity.log'))

  // 2. Prefix
  const prefixOverrides = {
    'deal.new': ['g'], // 'g' conflicts with two-step chords like 'g d', 'g p'
  }
  const resolvedPrefix = resolveBindings(SHORTCUTS, prefixOverrides)
  const prefixConflicts = findConflicts(resolvedPrefix)
  const prefixMatch = prefixConflicts.find((c) => c.type === 'prefix' && c.binding === 'g')
  assert.ok(prefixMatch, 'Expected prefix conflict for "g"')
  assert.ok(prefixMatch.ids.includes('deal.new'))

  // 3. Reserved (browser reserved key)
  const reservedOverrides = {
    'deal.new': ['mod+w'],
  }
  const resolvedReserved = resolveBindings(SHORTCUTS, reservedOverrides)
  const reservedConflicts = findConflicts(resolvedReserved)
  const reservedMatch = reservedConflicts.find((c) => c.type === 'reserved' && c.binding === 'mod+w')
  assert.ok(reservedMatch, 'Expected reserved conflict for "mod+w"')

  // 4. Reserved (unlocked action using a locked action's key)
  const lockedKeyOverrides = {
    'deal.new': ['mod+k'], // locked action 'palette.open' uses 'mod+k'
  }
  const resolvedLockedKey = resolveBindings(SHORTCUTS, lockedKeyOverrides)
  const lockedKeyConflicts = findConflicts(resolvedLockedKey)
  const lockedKeyMatch = lockedKeyConflicts.find(
    (c) => c.type === 'reserved' && c.binding === 'mod+k'
  )
  assert.ok(lockedKeyMatch, 'Expected reserved conflict when unlocked action uses locked binding')
})

test('resolve-bindings-ignores-invalid-overrides', () => {
  const overrides: Record<string, string[]> = {
    'deal.new': ['invalid+++binding'],
    'contact.new': [''],
    'activity.log': [] as any,
  }

  const resolved = resolveBindings(SHORTCUTS, overrides)
  assert.deepStrictEqual(resolved['deal.new'], ['n'])
  assert.deepStrictEqual(resolved['contact.new'], ['c'])
  assert.deepStrictEqual(resolved['activity.log'], ['l'])
})

test('locked-ids-ignore-overrides', () => {
  const overrides = {
    'palette.open': ['mod+p'],
    'help.open': ['h'],
    'ui.escape': ['backspace'],
    'form.submit': ['enter'],
    'form.delete': ['delete'],
  }

  const resolved = resolveBindings(SHORTCUTS, overrides)
  assert.deepStrictEqual(resolved['palette.open'], ['mod+k'])
  assert.deepStrictEqual(resolved['help.open'], ['?'])
  assert.deepStrictEqual(resolved['ui.escape'], ['escape'])
  assert.deepStrictEqual(resolved['form.submit'], ['mod+enter'])
  assert.deepStrictEqual(resolved['form.delete'], ['mod+backspace'])
})
