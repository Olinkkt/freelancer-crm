export type ShortcutId =
  | 'palette'
  | 'help'
  | 'newDeal'
  | 'newClient'
  | 'submit'
  | 'save'
  | 'togglePreview'
  | 'paletteNext'
  | 'palettePrev'
  | 'goHome'
  | 'goDeals'
  | 'goClients'
  | 'goSettings'

export interface ShortcutDef {
  id: ShortcutId
  section: string
  label: string
  /** Space-separated steps; a step is "mod+shift+k". "mod" = Ctrl or ⌘. */
  default: string
  /** 'input' shortcuts fire inside fields too, so they need a modifier. */
  scope: 'global' | 'input'
  /** Can be a two-key chord like "g h". */
  chord?: boolean
}

export const SHORTCUTS: ShortcutDef[] = [
  { id: 'palette', section: 'Global', label: 'Open command palette', default: 'mod+k', scope: 'input' },
  { id: 'help', section: 'Global', label: 'Show shortcuts', default: '?', scope: 'global' },
  { id: 'newDeal', section: 'Quick actions', label: 'New deal', default: 'n', scope: 'global' },
  { id: 'newClient', section: 'Quick actions', label: 'New client', default: 'c', scope: 'global' },
  { id: 'submit', section: 'Quick actions', label: 'Submit quick-add form', default: 'mod+enter', scope: 'input' },
  { id: 'save', section: 'Quick actions', label: 'Save notes or task description now', default: 'mod+s', scope: 'input' },
  { id: 'togglePreview', section: 'Quick actions', label: 'Switch notes between preview and write', default: 'mod+e', scope: 'input' },
  { id: 'paletteNext', section: 'Palette', label: 'Next result (or ↓)', default: 'mod+d', scope: 'input' },
  { id: 'palettePrev', section: 'Palette', label: 'Previous result (or ↑)', default: 'mod+u', scope: 'input' },
  { id: 'goHome', section: 'Go to', label: 'Home', default: 'g h', scope: 'global', chord: true },
  { id: 'goDeals', section: 'Go to', label: 'Deals', default: 'g d', scope: 'global', chord: true },
  { id: 'goClients', section: 'Go to', label: 'Clients', default: 'g c', scope: 'global', chord: true },
  { id: 'goSettings', section: 'Go to', label: 'Settings', default: 'g s', scope: 'global', chord: true },
]

/** Keys that always work the same way and can't be changed. */
export const FIXED_SHORTCUTS = [
  { section: 'Global', label: 'Close modal or palette, or go back from a deal', keys: ['Esc'] },
  { section: 'Deals list', label: 'Focus next deal', keys: ['Tab'] },
  { section: 'Deals list', label: 'Open focused deal', keys: ['↵'] },
]

const SECTION_ORDER = ['Global', 'Quick actions', 'Palette', 'Deals list', 'Go to']

export type Bindings = Record<ShortcutId, string>

export const DEFAULT_BINDINGS = Object.fromEntries(
  SHORTCUTS.map((s) => [s.id, s.default])
) as Bindings

const MODIFIER_KEYS = new Set(['control', 'shift', 'alt', 'meta', 'altgraph', 'os', 'capslock'])

interface KeyLike {
  key: string
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}

/** Turn a key event into a step like "mod+shift+k", or null for a bare modifier press. */
export function eventToStep(e: KeyLike): string | null {
  const key = e.key.toLowerCase()
  if (MODIFIER_KEYS.has(key)) return null
  const parts: string[] = []
  if (e.ctrlKey || e.metaKey) parts.push('mod')
  if (e.altKey) parts.push('alt')
  if (e.shiftKey && (key.length > 1 || /[a-z]/.test(key))) parts.push('shift')
  parts.push(key === ' ' ? 'space' : key)
  return parts.join('+')
}

/** True when the event is exactly this (single-step) binding. */
export function matches(e: KeyLike, binding: string): boolean {
  return eventToStep(e) === binding
}

export function hasModifier(step: string): boolean {
  return step.startsWith('mod+') || step.startsWith('alt+')
}

const KEY_LABELS: Record<string, string> = {
  enter: '↵',
  escape: 'Esc',
  arrowup: '↑',
  arrowdown: '↓',
  arrowleft: '←',
  arrowright: '→',
  space: 'Space',
  backspace: '⌫',
}

function splitStep(step: string): { mods: string[]; key: string } {
  const mods: string[] = []
  let rest = step
  for (const m of ['mod', 'alt', 'shift']) {
    if (rest.startsWith(m + '+') && rest.length > m.length + 1) {
      mods.push(m)
      rest = rest.slice(m.length + 1)
    }
  }
  return { mods, key: rest }
}

function formatStep(step: string, modKey: string): string[] {
  const { mods, key } = splitStep(step)
  const out = mods.map((m) => (m === 'mod' ? modKey : m === 'alt' ? 'Alt' : 'Shift'))
  out.push(KEY_LABELS[key] ?? (key.length === 1 ? key.toUpperCase() : key[0].toUpperCase() + key.slice(1)))
  return out
}

/** Flat list of key caps to render, e.g. "mod+s" -> ["Ctrl","S"], "g h" -> ["G","H"]. */
export function formatBinding(binding: string, modKey: string): string[] {
  return binding.split(' ').flatMap((step) => formatStep(step, modKey))
}

/** Compact text label, e.g. "Ctrl+S" or "G H". */
export function bindingLabel(binding: string, modKey: string): string {
  return binding
    .split(' ')
    .map((step) => formatStep(step, modKey).join('+'))
    .join(' ')
}

// Browsers handle these before the page sees them, so a page can't override them.
const RESERVED = new Set([
  'mod+n', 'mod+t', 'mod+w', 'mod+q',
  'mod+shift+n', 'mod+shift+t', 'mod+shift+w', 'mod+shift+q',
])

/** Returns an error message, or null when the binding is allowed. */
export function validateBinding(id: ShortcutId, binding: string, bindings: Bindings): string | null {
  const def = SHORTCUTS.find((s) => s.id === id)
  if (!def) return 'Unknown shortcut'
  const steps = binding.split(' ').filter(Boolean)
  if (steps.length === 0) return 'Press a key'
  if (steps.length > (def.chord ? 2 : 1)) return 'Too many keys'
  for (const step of steps) {
    const { key } = splitStep(step)
    if (key === 'escape' || key === 'tab') return 'Esc and Tab are reserved'
    if (step === 'enter') return 'Enter needs a modifier'
    if (RESERVED.has(step)) return 'Browsers don’t let pages override this one'
  }
  if (def.scope === 'input' && !hasModifier(steps[0])) return 'Needs Ctrl, ⌘ or Alt, since it works inside fields'
  const joined = steps.join(' ')
  for (const other of SHORTCUTS) {
    if (other.id === id) continue
    const b = bindings[other.id]
    if (b === joined || b.startsWith(joined + ' ') || joined.startsWith(b + ' ')) {
      return `Conflicts with “${other.label}”`
    }
  }
  return null
}

/** Sections with live bindings, for rendering lists. */
export function getShortcutGroups(bindings: Bindings, modKey: string) {
  return SECTION_ORDER.map((title) => ({
    title,
    items: [
      ...SHORTCUTS.filter((s) => s.section === title).map((s) => ({
        id: s.id as ShortcutId | null,
        label: s.label,
        keys: formatBinding(bindings[s.id], modKey),
      })),
      ...FIXED_SHORTCUTS.filter((s) => s.section === title).map((s) => ({
        id: null as ShortcutId | null,
        label: s.label,
        keys: s.keys,
      })),
    ],
  })).filter((g) => g.items.length > 0)
}
