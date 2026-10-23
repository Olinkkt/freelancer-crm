import type { ShortcutScope } from './types'

export type ShortcutContext =
  | 'default'
  | 'todayList'
  | 'projectList'
  | 'projectRail'
  | 'board'
  | 'drawer'
  | 'review'
  | 'form'
  | 'help'
  | 'shortcutSettings'
  | 'stageSettings'
  | 'templateSettings'

export const CONTEXT_SCOPES: Record<ShortcutContext, ShortcutScope[]> = {
  default: ['global'],
  todayList: ['global', 'list', 'today'],
  projectList: ['global', 'project', 'list'],
  projectRail: ['global', 'project', 'rail'],
  board: ['global', 'board'],
  drawer: ['global', 'drawer'],
  review: ['global', 'review', 'list'],
  form: ['form'],
  help: ['help'],
  shortcutSettings: ['global', 'shortcut-settings'],
  stageSettings: ['global', 'stage-settings'],
  templateSettings: ['global', 'template-settings'],
}
