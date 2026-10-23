export type ShortcutScope =
  | 'global'
  | 'form'
  | 'help'
  | 'board'
  | 'drawer'
  | 'list'
  | 'today'
  | 'project'
  | 'rail'
  | 'review'
  | 'shortcut-settings'
  | 'stage-settings'
  | 'template-settings'

export type ShortcutId = string

export interface ShortcutDef {
  id: string // 'nav.today', stable, dot-separated
  scope: ShortcutScope
  defaults: readonly string[] // 1–2 bindings in canonical syntax (§10.2)
  label: string // shown in the help modal, settings and README
  group: string // help/README grouping heading
  locked?: true // cannot be rebound
  readme?: false // hide from README (none are hidden by default)
}

export type Platform = 'mac' | 'other'

export interface Conflict {
  type: 'duplicate' | 'prefix' | 'reserved'
  binding: string
  ids: string[]
  context: string
}
