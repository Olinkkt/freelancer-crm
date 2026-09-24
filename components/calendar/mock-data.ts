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

export const CRM_CONTACTS: CRMContact[] = [
  { id: 'c-1', name: 'Petra Frajmanová', role: 'Founder', company: 'Chalupa U lesa', email: 'petra@chalupau lesa.cz', color: 'blue', initials: 'PF' },
  { id: 'c-2', name: 'Martin Kraj', role: 'Creative director', company: 'Studio Kraj s.r.o.', email: 'martin@studiokraj.cz', color: 'violet', initials: 'MK' },
  { id: 'c-3', name: 'Jan Novák', role: 'Architect', company: 'Novák Architecture', email: 'jan@novakarch.cz', color: 'amber', initials: 'JN' },
  { id: 'c-4', name: 'Lucie Marešová', role: 'Managing partner', company: 'Mareš & Co.', email: 'lucie@maresco.cz', color: 'green', initials: 'LM' },
  { id: 'c-5', name: 'David Formánek', role: 'Design lead', company: 'Forma Studio', email: 'david@formastudio.cz', color: 'blue', initials: 'DF' },
  { id: 'c-6', name: 'Anna Kovářová', role: 'Product manager', company: 'Kovář Digital', email: 'anna@kovardigital.cz', color: 'violet', initials: 'AK' },
]

export const INITIAL_DAYS: DayColumn[] = [
  { dayNumber: '21', dayName: 'MON', fullDate: new Date(2026, 8, 21), isToday: false },
  { dayNumber: '22', dayName: 'TUE', fullDate: new Date(2026, 8, 22), isToday: true },
  { dayNumber: '23', dayName: 'WED', fullDate: new Date(2026, 8, 23), isToday: false },
  { dayNumber: '24', dayName: 'THU', fullDate: new Date(2026, 8, 24), isToday: false, isBlockedAfterHour: 13 },
  { dayNumber: '25', dayName: 'FRI', fullDate: new Date(2026, 8, 25), isToday: false, isBlockedAfterHour: 12 },
]

export const TOP_FEATURED_EVENTS: FeaturedEvent[] = [
  {
    id: 'feat-1',
    title: 'Follow up on quote — Frajmanová',
    subtitle: 'Review revisions and scope breakdown',
    company: 'Chalupa U lesa',
    person: 'Petra Frajmanová',
    time: '10:00 – 11:00',
    colorTheme: 'blue' as const,
    category: 'follow-up' as const,
    actionLabel: 'Open deal (15 000 Kč)',
    attendees: [
      { id: 'pf', name: 'Petra Frajmanová', initials: 'PF', colorTheme: 'blue' as const },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' as const },
    ],
  },
  {
    id: 'feat-2',
    title: 'Send revised scope — Studio Kraj',
    subtitle: 'Brand site negotiation & milestones',
    company: 'Studio Kraj s.r.o.',
    person: 'Martin Kraj',
    time: '14:30 – 15:30',
    colorTheme: 'violet' as const,
    category: 'meeting' as const,
    actionLabel: 'Open deal (32 000 Kč)',
    attendees: [
      { id: 'mk', name: 'Martin Kraj', initials: 'MK', colorTheme: 'violet' as const },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' as const },
    ],
  },
  {
    id: 'feat-3',
    title: 'Discovery call — Novák Architecture',
    subtitle: 'Architecture portfolio overhaul kickoff',
    company: 'Novák Architecture',
    person: 'Jan Novák',
    time: '11:00 – 12:00',
    colorTheme: 'amber' as const,
    category: 'call' as const,
    actionLabel: 'Open deal (26 000 Kč)',
    attendees: [
      { id: 'jn', name: 'Jan Novák', initials: 'JN', colorTheme: 'amber' as const },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' as const },
    ],
  },
]

export const INITIAL_EVENTS: CalendarEvent[] = [
  // Monday 21
  {
    id: 'ev-1',
    title: 'Weekly pipeline sync',
    subtitle: 'Team alignment & capacity review',
    company: 'Internal',
    person: 'Oliver Seidl',
    dayIndex: 0,
    dateString: '2026-09-21',
    startHour: 9.0,
    durationHours: 1.0,
    startTimeLabel: '09:00',
    endTimeLabel: '10:00',
    category: 'meeting',
    colorTheme: 'blue',
    actionLabel: 'Internal sync',
    overflowAttendeesCount: 4,
    attendees: [
      { id: 'a1', name: 'David Formánek', initials: 'DF', colorTheme: 'blue' },
      { id: 'a2', name: 'Lucie Marešová', initials: 'LM', colorTheme: 'green' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
  {
    id: 'ev-2',
    title: 'Call with Rico — UX Designer',
    subtitle: 'Forma Studio visual direction check',
    company: 'Forma Studio',
    person: 'Rico Oktananda',
    dayIndex: 0,
    dateString: '2026-09-21',
    startHour: 10.25,
    durationHours: 1.25,
    startTimeLabel: '10:15',
    endTimeLabel: '11:30',
    category: 'call',
    colorTheme: 'blue',
    actionLabel: 'Forma Studio',
    attendees: [
      { id: 'rico', name: 'Rico Oktananda', initials: 'RO', colorTheme: 'blue' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },

  // Tuesday 22 (Today)
  {
    id: 'ev-3',
    title: 'Follow up on quote',
    subtitle: 'Chalupa U lesa pricing review',
    company: 'Chalupa U lesa',
    person: 'Petra Frajmanová',
    dayIndex: 1,
    dateString: '2026-09-22',
    startHour: 10.0,
    durationHours: 1.0,
    startTimeLabel: '10:00',
    endTimeLabel: '11:00',
    category: 'follow-up',
    colorTheme: 'blue',
    actionLabel: 'Chalupa U lesa',
    attendees: [
      { id: 'pf', name: 'Petra Frajmanová', initials: 'PF', colorTheme: 'blue' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
  {
    id: 'ev-4',
    title: 'Design review with James Brown',
    subtitle: 'Wireframes walkthrough',
    company: 'Studio Kraj s.r.o.',
    person: 'James Brown',
    dayIndex: 1,
    dateString: '2026-09-22',
    startHour: 11.5,
    durationHours: 1.25,
    startTimeLabel: '11:30',
    endTimeLabel: '12:45',
    category: 'review',
    colorTheme: 'violet',
    actionLabel: 'Studio Kraj',
    attendees: [
      { id: 'jb', name: 'James Brown', initials: 'JB', colorTheme: 'violet' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
  {
    id: 'ev-5',
    title: 'Send revised scope',
    subtitle: 'Budget & delivery timeline agreement',
    company: 'Studio Kraj s.r.o.',
    person: 'Martin Kraj',
    dayIndex: 1,
    dateString: '2026-09-22',
    startHour: 13.0,
    durationHours: 1.0,
    startTimeLabel: '13:00',
    endTimeLabel: '14:00',
    category: 'meeting',
    colorTheme: 'violet',
    actionLabel: 'Studio Kraj',
    attendees: [
      { id: 'mk', name: 'Martin Kraj', initials: 'MK', colorTheme: 'violet' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },

  // Wednesday 23
  {
    id: 'ev-6',
    title: 'Morning project check-in',
    subtitle: 'Daily standup & blockers review',
    company: 'Internal',
    person: 'Oliver Seidl',
    dayIndex: 2,
    dateString: '2026-09-23',
    startHour: 9.0,
    durationHours: 1.0,
    startTimeLabel: '09:00',
    endTimeLabel: '10:00',
    category: 'meeting',
    colorTheme: 'blue',
    actionLabel: 'Internal standup',
    overflowAttendeesCount: 5,
    attendees: [
      { id: 'a1', name: 'David Formánek', initials: 'DF', colorTheme: 'blue' },
      { id: 'a2', name: 'Lucie Marešová', initials: 'LM', colorTheme: 'green' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
  {
    id: 'ev-7',
    title: 'Discovery call — Novák Architecture',
    subtitle: 'Architecture portfolio requirements',
    company: 'Novák Architecture',
    person: 'Jan Novák',
    dayIndex: 2,
    dateString: '2026-09-23',
    startHour: 10.25,
    durationHours: 1.25,
    startTimeLabel: '10:15',
    endTimeLabel: '11:30',
    category: 'call',
    colorTheme: 'amber',
    actionLabel: 'Novák Architecture',
    attendees: [
      { id: 'jn', name: 'Jan Novák', initials: 'JN', colorTheme: 'amber' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
  {
    id: 'ev-8',
    title: 'Developer sync — Chris (Bubble)',
    subtitle: 'CRM integration technical check',
    company: 'Kovář Digital',
    person: 'Anna Kovářová',
    dayIndex: 2,
    dateString: '2026-09-23',
    startHour: 12.0,
    durationHours: 1.25,
    startTimeLabel: '12:00',
    endTimeLabel: '13:15',
    category: 'meeting',
    colorTheme: 'green',
    actionLabel: 'Kovář Digital',
    attendees: [
      { id: 'ce', name: 'Chris Evans', initials: 'CE', colorTheme: 'green' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },

  // Thursday 24
  {
    id: 'ev-9',
    title: 'Talent & partner review',
    subtitle: 'Freelance contractor agreements',
    company: 'Internal',
    person: 'Oliver Seidl',
    dayIndex: 3,
    dateString: '2026-09-24',
    startHour: 10.0,
    durationHours: 1.25,
    startTimeLabel: '10:00',
    endTimeLabel: '11:15',
    category: 'meeting',
    colorTheme: 'blue',
    actionLabel: 'Recruiter sync',
    overflowAttendeesCount: 3,
    attendees: [
      { id: 'a1', name: 'Lucie Marešová', initials: 'LM', colorTheme: 'green' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },

  // Friday 25
  {
    id: 'ev-10',
    title: 'Share case studies — Mareš & Co.',
    subtitle: 'Consulting deliverables & presentation',
    company: 'Mareš & Co.',
    person: 'Lucie Marešová',
    dayIndex: 4,
    dateString: '2026-09-25',
    startHour: 9.5,
    durationHours: 1.0,
    startTimeLabel: '09:30',
    endTimeLabel: '10:30',
    category: 'review',
    colorTheme: 'green',
    actionLabel: 'Mareš & Co.',
    attendees: [
      { id: 'lm', name: 'Lucie Marešová', initials: 'LM', colorTheme: 'green' },
      { id: 'os', name: 'Oliver Seidl', initials: 'OS', colorTheme: 'dark' },
    ],
  },
]
