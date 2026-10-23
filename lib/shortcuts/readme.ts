import type { ShortcutDef, ShortcutScope } from './types'

export const SCOPE_LABELS: Record<ShortcutScope, string> = {
  global: 'Global',
  form: 'Forms',
  help: 'Shortcuts modal',
  board: 'Boards',
  drawer: 'Deal drawer',
  list: 'Task lists',
  today: 'Today',
  project: 'Project workspace',
  rail: 'Milestones & money',
  review: 'Weekly review',
  'shortcut-settings': 'Settings › Keyboard Shortcuts',
  'stage-settings': 'Settings › Projects › Stages',
  'template-settings': 'Settings › Projects › Templates',
}

export function renderStep(step: string): string {
  const parts = step.split('+')
  const key = parts[parts.length - 1]
  const modifiers = parts.slice(0, -1)

  const renderedTokens: string[] = []
  if (modifiers.includes('mod')) {
    renderedTokens.push('<kbd>⌘</kbd>/<kbd>Ctrl</kbd>')
  }
  if (modifiers.includes('alt')) {
    renderedTokens.push('<kbd>Alt</kbd>')
  }
  if (modifiers.includes('shift')) {
    renderedTokens.push('<kbd>Shift</kbd>')
  }

  let keyStr = key
  if (key === 'arrowup') keyStr = '↑'
  else if (key === 'arrowdown') keyStr = '↓'
  else if (key === 'arrowleft') keyStr = '←'
  else if (key === 'arrowright') keyStr = '→'
  else if (key === 'enter') keyStr = 'Enter'
  else if (key === 'escape') keyStr = 'Esc'
  else if (key === 'backspace') keyStr = 'Backspace'
  else if (key === 'delete') keyStr = 'Delete'
  else if (key === 'space') keyStr = 'Space'
  else if (key === 'tab') keyStr = 'Tab'
  else if (/^[a-z]$/.test(key)) keyStr = key.toUpperCase()

  renderedTokens.push(`<kbd>${keyStr}</kbd>`)

  return renderedTokens.join(' + ')
}

export function renderBinding(binding: string): string {
  const steps = binding.trim().split(/\s+/)
  if (steps.length === 2) {
    return `${renderStep(steps[0])} then ${renderStep(steps[1])}`
  }
  return renderStep(steps[0])
}

export function renderShortcutsMarkdown(shortcuts: readonly ShortcutDef[]): string {
  const visible = shortcuts.filter((s) => s.readme !== false)

  // Collect groups in order of first appearance
  const groups: string[] = []
  const groupMap = new Map<string, ShortcutDef[]>()

  for (const s of visible) {
    if (!groupMap.has(s.group)) {
      groups.push(s.group)
      groupMap.set(s.group, [])
    }
    groupMap.get(s.group)!.push(s)
  }

  const sections: string[] = []

  for (const group of groups) {
    const items = groupMap.get(group)!
    const lines: string[] = []
    lines.push(`### ${group}`)
    lines.push('')
    lines.push('| Shortcut | Action | Where |')
    lines.push('|---|---|---|')

    for (const item of items) {
      const shortcutStr = item.defaults.map(renderBinding).join(' / ')
      const whereStr = SCOPE_LABELS[item.scope] || item.scope
      lines.push(`| ${shortcutStr} | ${item.label} | ${whereStr} |`)
    }

    sections.push(lines.join('\n'))
  }

  sections.push('All shortcuts can be changed in **Settings › Keyboard Shortcuts**.')

  return sections.join('\n\n')
}
