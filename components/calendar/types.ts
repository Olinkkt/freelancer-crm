export interface CalendarAttendee {
  id: string
  name: string
  role?: string
  colorTheme?: 'blue' | 'violet' | 'amber' | 'green' | 'dark'
  initials: string
}

export interface CalendarEvent {
  id: string
  title: string
  description?: string
  subtitle?: string
  company?: string
  person?: string
  dayIndex: number // 0: Mon, 1: Tue, 2: Wed, 3: Thu, 4: Fri
  dateString: string // e.g. "2026-09-22"
  startHour: number // decimal: 9.0 = 09:00, 10.5 = 10:30, 14.5 = 14:30
  durationHours: number // 1.0, 1.5, 2.0
  startTimeLabel: string // "10:00"
  endTimeLabel: string // "11:30"
  category: 'follow-up' | 'meeting' | 'call' | 'review' | 'milestone'
  colorTheme: 'blue' | 'violet' | 'amber' | 'green'
  attendees: CalendarAttendee[]
  overflowAttendeesCount?: number // e.g. +7
  actionLabel?: string // e.g. "Chalupa U lesa" or "Client meeting"
  dealId?: string
  amountLabel?: string
}

export interface FeaturedEvent {
  id: string
  title: string
  subtitle: string
  company: string
  person: string
  time: string
  colorTheme: 'blue' | 'violet' | 'amber' | 'green'
  category: 'follow-up' | 'meeting' | 'call' | 'review' | 'milestone'
  actionLabel: string
  dealId?: string
  attendees: CalendarAttendee[]
}

export interface DayColumn {
  dayNumber: string // "21"
  dayName: string // "MON"
  fullDate: Date
  isToday?: boolean
  isBlockedAfterHour?: number // e.g. 12 for hatched pattern
}
