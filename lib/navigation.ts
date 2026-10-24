export const VIEWS = [
  'today',
  'dashboard',
  'deals',
  'projects',
  'companies',
  'contacts',
  'activities',
  'calendar',
  'review',
  'settings',
] as const

export type ViewId = (typeof VIEWS)[number]

export const DEFAULT_VIEW: ViewId = 'today'

export const VIEW_LABELS: Record<ViewId, string> = {
  today: 'Today',
  dashboard: 'Dashboard',
  deals: 'Deals',
  projects: 'Projects',
  companies: 'Companies',
  contacts: 'Contacts',
  activities: 'Activities',
  calendar: 'Calendar',
  review: 'Review',
  settings: 'Settings',
}

export function parseViewParam(param: string | null | undefined): ViewId {
  if (!param) return DEFAULT_VIEW
  const normalized = param.toLowerCase().trim()
  return (VIEWS as readonly string[]).includes(normalized)
    ? (normalized as ViewId)
    : DEFAULT_VIEW
}

export function viewHref(v: ViewId, extra?: Record<string, string>): string {
  const params = new URLSearchParams()
  if (v !== DEFAULT_VIEW || (extra && Object.keys(extra).length > 0)) {
    params.set('view', v)
  }
  if (extra) {
    for (const [key, val] of Object.entries(extra)) {
      if (val !== undefined && val !== null) {
        params.set(key, val)
      }
    }
  }
  const qs = params.toString()
  return qs ? `/?${qs}` : '/'
}
