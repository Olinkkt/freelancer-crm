import type { Platform } from './types'

export const NAMED_KEYS = [
  'enter',
  'escape',
  'backspace',
  'delete',
  'tab',
  'arrowup',
  'arrowdown',
  'arrowleft',
  'arrowright',
  'space',
] as const

export function getPlatform(): Platform {
  if (typeof navigator !== 'undefined') {
    const p = (navigator.platform || navigator.userAgent || '').toLowerCase()
    if (/mac|iphone|ipad|ipod/.test(p)) return 'mac'
  }
  return 'other'
}

export function eventToStep(
  e: { key: string; metaKey?: boolean; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean },
  platform?: Platform
): string | null {
  const k = e.key.toLowerCase()
  if (k === 'meta' || k === 'control' || k === 'alt' || k === 'shift') {
    return null
  }

  const p = platform ?? (typeof navigator !== 'undefined' ? getPlatform() : e.metaKey ? 'mac' : 'other')
  const isMod = p === 'mac' ? Boolean(e.metaKey) : Boolean(e.ctrlKey)
  const isAlt = Boolean(e.altKey)
  const isShift = Boolean(e.shiftKey)

  let key = k
  if (key === ' ') key = 'space'
  if (key === 'esc') key = 'escape'

  const parts: string[] = []
  if (isMod) parts.push('mod')
  if (isAlt) parts.push('alt')

  const isLetter = /^[a-z]$/.test(key)
  const isDigit = /^[0-9]$/.test(key)
  const isNamedKey = (NAMED_KEYS as readonly string[]).includes(key)

  if (isShift && (isLetter || isDigit || isNamedKey)) {
    parts.push('shift')
  }

  parts.push(key)
  return parts.join('+')
}

export function isTypingTarget(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false
  const tag = target.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true
  if (target.isContentEditable) return true
  if (target.getAttribute('contenteditable') === 'true') return true
  return false
}

export function parseStep(step: string): string | null {
  const raw = step.trim().toLowerCase()
  if (!raw) return null

  const parts = raw.split('+')
  if (parts.length === 0) return null

  let hasMod = false
  let hasAlt = false
  let hasShift = false
  let key: string | null = null

  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    if (part === 'mod') {
      if (hasMod || hasAlt || hasShift || key !== null) return null
      hasMod = true
    } else if (part === 'alt') {
      if (hasAlt || hasShift || key !== null) return null
      hasAlt = true
    } else if (part === 'shift') {
      if (hasShift || key !== null) return null
      hasShift = true
    } else {
      if (key !== null) return null
      key = part
    }
  }

  if (!key) return null

  if (key === ' ') key = 'space'
  if (key === 'esc') key = 'escape'

  const isLetter = /^[a-z]$/.test(key)
  const isDigit = /^[0-9]$/.test(key)
  const isNamedKey = (NAMED_KEYS as readonly string[]).includes(key)

  // Shift is only allowed for letters, digits and named keys
  if (hasShift && !isLetter && !isDigit && !isNamedKey) {
    return null
  }

  const resultParts: string[] = []
  if (hasMod) resultParts.push('mod')
  if (hasAlt) resultParts.push('alt')
  if (hasShift) resultParts.push('shift')
  resultParts.push(key)

  return resultParts.join('+')
}

export function parseBinding(binding: string): string[] | null {
  const trimmed = binding.trim()
  if (!trimmed) return null

  const rawSteps = trimmed.split(/\s+/)
  if (rawSteps.length < 1 || rawSteps.length > 2) return null

  const steps: string[] = []
  for (const s of rawSteps) {
    const parsed = parseStep(s)
    if (!parsed) return null
    steps.push(parsed)
  }

  return steps
}

export function stepsEqual(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase()
}

export function formatStep(step: string, platform: Platform = getPlatform()): string {
  const parts = step.split('+')
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)

  const hasMod = modifiers.includes('mod')
  const hasAlt = modifiers.includes('alt')
  const hasShift = modifiers.includes('shift')

  let formattedKey = key
  if (key === 'arrowup') formattedKey = '↑'
  else if (key === 'arrowdown') formattedKey = '↓'
  else if (key === 'arrowleft') formattedKey = '←'
  else if (key === 'arrowright') formattedKey = '→'
  else if (key === 'escape') formattedKey = 'Esc'
  else if (key === 'space') formattedKey = 'Space'
  else if (key === 'enter') formattedKey = platform === 'mac' && modifiers.length > 0 ? '↵' : 'Enter'
  else if (key === 'backspace') formattedKey = platform === 'mac' && modifiers.length > 0 ? '⌫' : 'Backspace'
  else if (key === 'delete') formattedKey = 'Delete'
  else if (key === 'tab') formattedKey = 'Tab'
  else if (/^[a-z]$/.test(key)) formattedKey = key.toUpperCase()

  if (platform === 'mac') {
    let modStr = ''
    if (hasMod) modStr += '⌘'
    if (hasAlt) modStr += '⌥'
    if (hasShift) modStr += '⇧'
    return `${modStr}${formattedKey}`
  }

  const prefixParts: string[] = []
  if (hasMod) prefixParts.push('Ctrl')
  if (hasAlt) prefixParts.push('Alt')
  if (hasShift) prefixParts.push('Shift')

  if (prefixParts.length === 0) {
    return formattedKey
  }

  return `${prefixParts.join('+')}+${formattedKey}`
}

export function formatBinding(binding: string, platform: Platform = getPlatform()): string {
  const parsed = parseBinding(binding)
  if (!parsed || parsed.length === 0) return binding

  if (parsed.length === 1) {
    return formatStep(parsed[0], platform)
  }

  return `${formatStep(parsed[0], platform)} then ${formatStep(parsed[1], platform)}`
}
