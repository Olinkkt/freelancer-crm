import { CalendarEvent, DayColumn, FeaturedEvent } from './types'

export interface CRMContact {
  id: string
  name: string
  role: string
  company: string
  email: string
  color: 'blue' | 'violet' | 'amber' | 'green'
  initials: string
}

export const CRM_CONTACTS: CRMContact[] = []

export const INITIAL_DAYS: DayColumn[] = [
  { dayNumber: '21', dayName: 'MON', fullDate: new Date(2026, 8, 21), isToday: false },
  { dayNumber: '22', dayName: 'TUE', fullDate: new Date(2026, 8, 22), isToday: true },
  { dayNumber: '23', dayName: 'WED', fullDate: new Date(2026, 8, 23), isToday: false },
  { dayNumber: '24', dayName: 'THU', fullDate: new Date(2026, 8, 24), isToday: false },
  { dayNumber: '25', dayName: 'FRI', fullDate: new Date(2026, 8, 25), isToday: false },
]

export const TOP_FEATURED_EVENTS: FeaturedEvent[] = []

export const INITIAL_EVENTS: CalendarEvent[] = []
