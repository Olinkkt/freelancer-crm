'use client'

import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import {
  Search,
  CirclePlus,
  Clock,
  Building2,
  Users,
  Check,
  FileText,
} from 'lucide-react'
import { CalendarEvent, DayColumn, FeaturedEvent } from './types'
import { INITIAL_DAYS, INITIAL_EVENTS, TOP_FEATURED_EVENTS } from './mock-data'
import { EventModal } from './event-modal'
import { Deal, FollowUpItem } from '@/lib/crm-types'

interface CalendarViewProps {
  deals?: Deal[]
  followUps?: FollowUpItem[]
  onOpenDeal?: (deal: Deal) => void
}

const HOUR_HEIGHT = 88 // height per hour row in pixels (compact & sleek)
const START_HOUR = 9 // 09:00
const END_HOUR = 15 // 15:00 (shows 09:00, 10:00, 11:00, 12:00, 13:00, 14:00, 15:00)
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i)

export function formatHourMinute(hour: number): string {
  const totalMinutes = Math.round(hour * 60)
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatDuration(hours: number): string {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}

export function getDateString(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

interface DragState {
  event: CalendarEvent
  grabOffsetX: number
  grabOffsetY: number
  cardWidth: number
  cardHeight: number
  pointerX: number
  pointerY: number
  targetDayIndex: number
  snappedStartHour: number
  isBlocked: boolean
}

interface ResizeState {
  event: CalendarEvent
  initialPointerY: number
  initialDuration: number
  currentDuration: number
  isBlocked: boolean
}

// Unified clean CRM palette for all events (no different colors)
const UNIFIED_THEME = {
  bg: '#f8faff',
  border: '#dbe6fe',
  accent: '#266df0',
  pillBg: '#e9f0ff',
  pillText: '#266df0',
  avatarBg: '#e9f0ff',
  avatarText: '#266df0',
}

const THEME_STYLES: Record<string, typeof UNIFIED_THEME> = {
  blue: UNIFIED_THEME,
  violet: UNIFIED_THEME,
  amber: UNIFIED_THEME,
  green: UNIFIED_THEME,
  dark: UNIFIED_THEME,
}

export function CalendarView({ deals = [], followUps = [], onOpenDeal }: CalendarViewProps) {
  // Dynamically map deal milestones (Section 3.4) into calendar events
  const dealMilestoneEvents = useMemo<CalendarEvent[]>(() => {
    return deals
      .filter((d) => d.nextDueDate && d.nextDueDate !== 'Done')
      .map((d) => {
        let dayIdx = 1 // default Tuesday (Today)
        let startH = 10.0
        const due = d.nextDueDate?.toLowerCase() || ''
        if (due.includes('today')) {
          dayIdx = 1
          if (due.includes('14:30')) startH = 14.5
          else if (due.includes('10:00')) startH = 10.0
          else startH = 11.5
        } else if (due.includes('tomorrow')) {
          dayIdx = 2
          startH = 9.0
        } else if (due.includes('thu') || due.includes('sep 24')) {
          dayIdx = 3
          startH = 11.0
        } else if (due.includes('fri') || due.includes('sep 25')) {
          dayIdx = 4
          startH = 10.0
        }

        const dateStr = ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25'][dayIdx] || '2026-09-22'

        return {
          id: `deal-ms-${d.id}`,
          title: `Milestone: ${d.next}`,
          subtitle: `${d.company} • ${d.title}`,
          company: d.company,
          person: d.contactName || d.company,
          dayIndex: dayIdx,
          dateString: dateStr,
          startHour: startH,
          durationHours: 1.0,
          startTimeLabel: formatHourMinute(startH),
          endTimeLabel: formatHourMinute(startH + 1.0),
          category: 'milestone',
          colorTheme: d.color || 'blue',
          actionLabel: `Open deal (${d.value})`,
          dealId: d.id,
          amountLabel: d.value,
          attendees: [
            {
              id: `att-${d.id}`,
              name: d.contactName || d.company,
              initials: (d.contactName || d.company)
                .split(' ')
                .map((n) => n[0])
                .join('')
                .slice(0, 2)
                .toUpperCase(),
              colorTheme: d.color,
            },
            {
              id: 'os',
              name: 'Oliver Seidl',
              initials: 'OS',
              colorTheme: 'dark',
            },
          ],
        }
      })
  }, [deals])

  // Merge base events with deal milestone events
  const allCombinedEvents = useMemo(() => {
    // Avoid duplicates by id
    const existingIds = new Set(INITIAL_EVENTS.map((e) => e.id))
    const uniqueMilestones = dealMilestoneEvents.filter((e) => !existingIds.has(e.id))
    return [...INITIAL_EVENTS, ...uniqueMilestones]
  }, [dealMilestoneEvents])

  const [events, setEvents] = useState<CalendarEvent[]>(allCombinedEvents)

  useEffect(() => {
    setEvents(allCombinedEvents)
  }, [allCombinedEvents])
  const [days, setDays] = useState<DayColumn[]>(INITIAL_DAYS)
  const [searchQuery, setSearchQuery] = useState('')
  const [toastMessage, setToastMessage] = useState<string | null>(null)

  // Drag and Resize states
  const [dragState, setDragState] = useState<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [resizeState, setResizeState] = useState<ResizeState | null>(null)
  const [isResizing, setIsResizing] = useState(false)

  const dayColumnRefs = useRef<(HTMLDivElement | null)[]>([])
  const justFinishedDragRef = useRef(false)
  const dragStateRef = useRef<DragState | null>(null)
  const resizeStateRef = useRef<ResizeState | null>(null)

  useEffect(() => {
    dragStateRef.current = dragState
  }, [dragState])

  useEffect(() => {
    resizeStateRef.current = resizeState
  }, [resizeState])

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null)
  const [modalDefaultDay, setModalDefaultDay] = useState<number>(1)
  const [modalDefaultHour, setModalDefaultHour] = useState<number>(10)

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Filtered events
  const filteredEvents = useMemo(() => {
    return events.filter((ev) => {
      const matchesSearch =
        ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (ev.subtitle && ev.subtitle.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.company && ev.company.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (ev.person && ev.person.toLowerCase().includes(searchQuery.toLowerCase())) ||
        ev.attendees.some((a) => a.name.toLowerCase().includes(searchQuery.toLowerCase()))

      return matchesSearch
    })
  }, [events, searchQuery])

  // Calculate target day column and snapped startHour (:00, :15, :30, :45)
  const calculateDropTarget = useCallback(
    (clientX: number, clientY: number, grabOffsetY: number, eventDuration: number, originalDayIndex: number) => {
      let targetDayIndex = originalDayIndex
      let foundColumn = false

      for (let i = 0; i < days.length; i++) {
        const colEl = dayColumnRefs.current[i]
        if (!colEl) continue
        const rect = colEl.getBoundingClientRect()
        if (clientX >= rect.left && clientX < rect.right) {
          targetDayIndex = i
          foundColumn = true
          break
        }
      }

      if (!foundColumn) {
        const firstCol = dayColumnRefs.current[0]?.getBoundingClientRect()
        const lastCol = dayColumnRefs.current[days.length - 1]?.getBoundingClientRect()
        if (firstCol && clientX < firstCol.left) {
          targetDayIndex = 0
        } else if (lastCol && clientX >= lastCol.right) {
          targetDayIndex = days.length - 1
        }
      }

      const targetCol = dayColumnRefs.current[targetDayIndex]
      let snappedStartHour = START_HOUR
      let isBlocked = false

      if (targetCol) {
        const colRect = targetCol.getBoundingClientRect()
        const cardTopInCol = clientY - grabOffsetY - colRect.top
        const rawHour = START_HOUR + cardTopInCol / HOUR_HEIGHT

        // Snap onto :00, :15, :30, :45 (multiples of 0.25)
        const rawSnapped = Math.round(rawHour * 4) / 4
        const minHour = START_HOUR
        const maxHour = END_HOUR + 1 - eventDuration

        snappedStartHour = Math.max(minHour, Math.min(maxHour, rawSnapped))

        const targetDay = days[targetDayIndex]
        if (targetDay?.isBlockedAfterHour !== undefined) {
          if (snappedStartHour + eventDuration > targetDay.isBlockedAfterHour) {
            isBlocked = true
          }
        }
      }

      return { targetDayIndex, snappedStartHour, isBlocked }
    },
    [days]
  )

  // Start free dragging with snapping
  const handleCardPointerDown = (e: React.PointerEvent<HTMLDivElement>, event: CalendarEvent) => {
    if (e.button !== 0) return

    const cardEl = e.currentTarget
    const cardRect = cardEl.getBoundingClientRect()
    const startX = e.clientX
    const startY = e.clientY
    const grabOffsetX = startX - cardRect.left
    const grabOffsetY = startY - cardRect.top
    const cardWidth = cardRect.width
    const cardHeight = cardRect.height

    let moved = false

    const handlePointerMove = (moveEv: PointerEvent) => {
      if (!moved) {
        const dist = Math.hypot(moveEv.clientX - startX, moveEv.clientY - startY)
        if (dist > 4) {
          moved = true
          setIsDragging(true)
          document.body.style.cursor = 'grabbing'
          document.body.style.userSelect = 'none'
        }
      }

      if (moved) {
        const target = calculateDropTarget(
          moveEv.clientX,
          moveEv.clientY,
          grabOffsetY,
          event.durationHours,
          event.dayIndex
        )

        const nextState: DragState = {
          event,
          grabOffsetX,
          grabOffsetY,
          cardWidth,
          cardHeight,
          pointerX: moveEv.clientX,
          pointerY: moveEv.clientY,
          targetDayIndex: target.targetDayIndex,
          snappedStartHour: target.snappedStartHour,
          isBlocked: target.isBlocked,
        }

        dragStateRef.current = nextState
        setDragState(nextState)
      }
    }

    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('keydown', handleKeyDown)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (moved) {
        justFinishedDragRef.current = true
        setTimeout(() => {
          justFinishedDragRef.current = false
        }, 150)

        const finalState = dragStateRef.current
        if (finalState) {
          if (finalState.isBlocked) {
            const targetDay = days[finalState.targetDayIndex]
            showToast(`Cannot move to blocked hours on ${targetDay.dayName}`)
          } else {
            const targetDay = days[finalState.targetDayIndex]
            const newStartHour = finalState.snappedStartHour
            const newStartTimeLabel = formatHourMinute(newStartHour)
            const newEndTimeLabel = formatHourMinute(newStartHour + event.durationHours)
            const newDateString = getDateString(targetDay.fullDate)

            if (
              finalState.targetDayIndex !== event.dayIndex ||
              newStartHour !== event.startHour
            ) {
              setEvents((prev) =>
                prev.map((ev) =>
                  ev.id === event.id
                    ? {
                        ...ev,
                        dayIndex: finalState.targetDayIndex,
                        dateString: newDateString,
                        startHour: newStartHour,
                        startTimeLabel: newStartTimeLabel,
                        endTimeLabel: newEndTimeLabel,
                      }
                    : ev
                )
              )
              showToast(`Moved to ${targetDay.dayName}, ${newStartTimeLabel} – ${newEndTimeLabel}`)
            }
          }
        }

        setDragState(null)
        setIsDragging(false)
        dragStateRef.current = null
      }
    }

    const handleKeyDown = (keyEv: KeyboardEvent) => {
      if (keyEv.key === 'Escape') {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
        window.removeEventListener('keydown', handleKeyDown)
        document.body.style.cursor = ''
        document.body.style.userSelect = ''

        if (moved) {
          justFinishedDragRef.current = true
          setTimeout(() => {
            justFinishedDragRef.current = false
          }, 150)
        }

        setDragState(null)
        setIsDragging(false)
        dragStateRef.current = null
        showToast('Move cancelled')
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('keydown', handleKeyDown)
  }

  // Start duration resize in :15 increments
  const handleResizeStart = (e: React.PointerEvent, event: CalendarEvent) => {
    e.stopPropagation()
    if (e.button !== 0) return

    const startY = e.clientY
    const initialDuration = event.durationHours
    let moved = false

    const handleResizeMove = (moveEv: PointerEvent) => {
      const deltaY = moveEv.clientY - startY
      if (!moved && Math.abs(deltaY) > 3) {
        moved = true
        setIsResizing(true)
        document.body.style.cursor = 'ns-resize'
        document.body.style.userSelect = 'none'
      }

      if (moved) {
        const deltaHours = deltaY / HOUR_HEIGHT
        const rawDuration = initialDuration + deltaHours
        let snappedDuration = Math.round(rawDuration * 4) / 4

        // Minimum 30 mins
        snappedDuration = Math.max(0.5, snappedDuration)

        // Maximum within visible grid
        const maxDuration = END_HOUR + 1 - event.startHour
        snappedDuration = Math.min(maxDuration, snappedDuration)

        // Check blocked hours
        const eventDay = days[event.dayIndex]
        let isBlocked = false
        if (
          eventDay?.isBlockedAfterHour !== undefined &&
          event.startHour + snappedDuration > eventDay.isBlockedAfterHour
        ) {
          isBlocked = true
        }

        const nextResize: ResizeState = {
          event,
          initialPointerY: startY,
          initialDuration,
          currentDuration: snappedDuration,
          isBlocked,
        }

        resizeStateRef.current = nextResize
        setResizeState(nextResize)
      }
    }

    const handleResizeUp = () => {
      window.removeEventListener('pointermove', handleResizeMove)
      window.removeEventListener('pointerup', handleResizeUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''

      if (moved) {
        justFinishedDragRef.current = true
        setTimeout(() => {
          justFinishedDragRef.current = false
        }, 150)

        const finalResize = resizeStateRef.current
        if (finalResize) {
          if (finalResize.isBlocked) {
            showToast('Cannot extend duration into blocked hours')
          } else if (finalResize.currentDuration !== initialDuration) {
            const newDuration = finalResize.currentDuration
            const newEndTime = formatHourMinute(event.startHour + newDuration)

            setEvents((prev) =>
              prev.map((ev) =>
                ev.id === event.id
                  ? {
                      ...ev,
                      durationHours: newDuration,
                      endTimeLabel: newEndTime,
                    }
                  : ev
              )
            )
            showToast(`Duration updated to ${formatDuration(newDuration)} (${event.startTimeLabel} – ${newEndTime})`)
          }
        }

        setResizeState(null)
        setIsResizing(false)
        resizeStateRef.current = null
      }
    }

    window.addEventListener('pointermove', handleResizeMove)
    window.addEventListener('pointerup', handleResizeUp)
  }

  // Open modal on empty slot click
  const handleSlotClick = (dayIdx: number, hour: number) => {
    if (justFinishedDragRef.current) return
    setSelectedEvent(null)
    setModalDefaultDay(dayIdx)
    setModalDefaultHour(hour)
    setIsModalOpen(true)
  }

  // Open modal on existing event click (or open deal drawer if milestone)
  const handleEventClick = (e: React.MouseEvent, event: CalendarEvent) => {
    e.stopPropagation()
    if (justFinishedDragRef.current) return
    if (event.dealId && onOpenDeal) {
      const matched = deals.find((d) => d.id === event.dealId)
      if (matched) {
        onOpenDeal(matched)
        return
      }
    }
    setSelectedEvent(event)
    setIsModalOpen(true)
  }

  // Active top featured cards derived from real deals
  const activeFeaturedEvents: FeaturedEvent[] = useMemo(() => {
    if (deals.length > 0) {
      return deals.slice(0, 3).map((d) => ({
        id: `feat-${d.id}`,
        title: d.next,
        subtitle: `${d.title} • ${d.stage}`,
        company: d.company,
        person: d.contactName || d.company,
        time: d.nextDueDate || 'Scheduled',
        colorTheme: d.color || ('blue' as const),
        category: 'milestone' as const,
        actionLabel: `Open deal (${d.value})`,
        dealId: d.id,
        attendees: [
          {
            id: `att-${d.id}`,
            name: d.contactName || d.company,
            initials: (d.contactName || d.company)
              .split(' ')
              .map((n) => n[0])
              .join('')
              .slice(0, 2)
              .toUpperCase(),
            colorTheme: d.color,
          },
          {
            id: 'os',
            name: 'Oliver Seidl',
            initials: 'OS',
            colorTheme: 'dark' as const,
          },
        ],
      }))
    }
    return TOP_FEATURED_EVENTS
  }, [deals])

  // Save event
  const handleSaveEvent = (savedEvent: Partial<CalendarEvent>) => {
    if (selectedEvent) {
      setEvents((prev) =>
        prev.map((ev) => (ev.id === selectedEvent.id ? ({ ...ev, ...savedEvent } as CalendarEvent) : ev))
      )
      showToast('Event updated successfully')
    } else {
      setEvents((prev) => [...prev, savedEvent as CalendarEvent])
      showToast('Event added to schedule')
    }
  }

  // Delete event
  const handleDeleteEvent = (eventId: string) => {
    setEvents((prev) => prev.filter((ev) => ev.id !== eventId))
    showToast('Event removed from schedule')
  }

  // Format hour for time column
  const formatTimeLabel = (hour: number) => {
    return `${String(hour).padStart(2, '0')}:00`
  }

  // Dynamic count for today (Tuesday 22 in CRM data)
  const todayEventsCount = events.filter((e) => e.dayIndex === 1).length

  return (
    <div className="w-full">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-[#232529] text-white px-3.5 py-2.5 rounded-[12px] shadow-[0_12px_30px_rgba(0,0,0,0.18)] text-[12px] font-medium animate-in slide-in-from-bottom-2 fade-in duration-150 border border-[#343840]">
          <Check size={14} className="text-[#266df0]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* 1. TOP PAGE HEADING */}
      <section className="page-heading">
        <div>
          <p className="eyebrow">Workspace schedule</p>
          <h1>Tuesday, September 22, 2026</h1>
          <p className="subcopy">
            You have {todayEventsCount} meetings & milestones on your schedule today.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="primary-button"
            onClick={() => {
              setSelectedEvent(null)
              setModalDefaultDay(1)
              setIsModalOpen(true)
            }}
          >
            <CirclePlus size={17} /> Add event
          </button>
        </div>
      </section>

      {/* 2. TOP FEATURED CARDS CAROUSEL (3 cards layout) */}
      {activeFeaturedEvents.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 mb-6">
          {activeFeaturedEvents.map((item) => {
            const theme = THEME_STYLES[item.colorTheme] || THEME_STYLES.blue

            return (
              <div
                key={item.id}
                className="panel flex flex-col justify-between transition-all hover:shadow-md cursor-pointer group"
                style={{
                  padding: '18px 20px',
                }}
                onClick={() => {
                  if (item.dealId && onOpenDeal) {
                    const d = deals.find((x) => x.id === item.dealId)
                    if (d) {
                      onOpenDeal(d)
                      return
                    }
                  }
                  showToast(`Opening ${item.company} schedule`)
                }}
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="stage-pill"
                      style={{
                        background: theme.pillBg,
                        color: theme.pillText,
                        fontWeight: 600,
                        padding: '3px 8px',
                        fontSize: '10px',
                      }}
                    >
                      {item.company}
                    </span>
                    <span className="text-[11px] font-medium text-[#6f7988] flex items-center gap-1">
                      <Clock size={12} className="text-[#9fa1a7]" /> {item.time}
                    </span>
                  </div>

                  <h3 className="text-[13px] font-bold text-[#1c1d1f] tracking-tight group-hover:text-[#266df0] transition-colors leading-snug">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-[#6f7988] mt-1 line-clamp-1">
                    {item.subtitle}
                  </p>
                </div>

                <div className="mt-3.5 pt-3 border-t border-[#f0f1f3] flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-[#266df0] transition-colors">
                    {item.actionLabel}
                  </span>

                  <div className="flex -space-x-1.5">
                    {item.attendees.map((attendee) => {
                      const aTheme = (attendee.colorTheme && THEME_STYLES[attendee.colorTheme]) || THEME_STYLES.dark
                      return (
                        <span
                          key={attendee.id}
                          title={attendee.name}
                          className="w-6 h-6 rounded-[6px] text-[9px] font-bold flex items-center justify-center ring-2 ring-white"
                          style={{
                            backgroundColor: aTheme.avatarBg,
                            color: aTheme.avatarText,
                          }}
                        >
                          {attendee.initials}
                        </span>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* WEEKLY SCHEDULE GRID (Panel styled with integrated search toolbar) */}
      <div className="panel p-0 overflow-hidden" style={{ padding: 0 }}>
        {/* Integrated Calendar Search Toolbar */}
        <div className="flex items-center justify-end px-4 py-2.5 border-b border-[#edf0f3] bg-white">
          <label className="search-field">
            <Search size={14} />
            <input
              placeholder="Search schedule..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="text-xs text-gray-400 hover:text-gray-600 ml-1"
              >
                ×
              </button>
            )}
          </label>
        </div>

        {/* Days Header Row */}
        <div className="grid grid-cols-[68px_repeat(5,minmax(0,1fr))] bg-[#fafbfc] border-b border-[#edf0f3]">
          {/* Clean corner cell without arrows */}
          <div className="border-r border-[#edf0f3] py-3 bg-[#fafbfc]" />

          {/* Day Columns Headers */}
          {days.map((day) => {
            const isToday = day.isToday

            return (
              <div
                key={day.dayName}
                className={`py-3 px-3 border-r border-[#edf0f3] last:border-r-0 text-center transition-colors ${
                  isToday ? 'bg-[#f1f5ff]' : ''
                }`}
              >
                <div
                  className={`text-[10px] font-bold uppercase tracking-wider ${
                    isToday ? 'text-[#266df0]' : 'text-[#8f99a8]'
                  }`}
                >
                  <strong
                    className={`block text-[17px] font-bold tracking-tight mb-0.5 ${
                      isToday ? 'text-[#266df0]' : 'text-[#505967]'
                    }`}
                  >
                    {day.dayNumber}
                  </strong>
                  <span>{day.dayName}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Time Grid Columns */}
        <div className="relative grid grid-cols-[68px_repeat(5,minmax(0,1fr))] min-w-[720px] overflow-x-auto bg-white">
          {/* Time Labels Column */}
          <div className="border-r border-[#edf0f3] bg-[#fafbfc]/50 select-none">
            {HOURS.map((hour) => (
              <div
                key={hour}
                style={{ height: `${HOUR_HEIGHT}px` }}
                className="text-[10px] font-semibold text-[#9fa1a7] flex items-start justify-end pr-2.5 pt-2 border-b border-[#edf0f3] last:border-b-0"
              >
                {formatTimeLabel(hour)}
              </div>
            ))}
          </div>

          {/* 5 Day Columns */}
          {days.map((day, dayIndex) => {
            const dayEvents = filteredEvents.filter((ev) => ev.dayIndex === dayIndex)

            return (
              <div
                key={day.dayName}
                ref={(el) => {
                  dayColumnRefs.current[dayIndex] = el
                }}
                className={`relative border-r border-[#edf0f3] last:border-r-0 ${
                  day.isToday ? 'bg-[#fcfdff]' : 'bg-white'
                } ${
                  dragState && isDragging && dragState.targetDayIndex === dayIndex
                    ? 'bg-[#f8faff]/80'
                    : ''
                }`}
              >
                {/* Hourly Row Slots with 15-minute guide lines */}
                {HOURS.map((hour) => {
                  const isBlocked =
                    day.isBlockedAfterHour !== undefined && hour >= day.isBlockedAfterHour

                  return (
                    <div
                      key={hour}
                      style={{ height: `${HOUR_HEIGHT}px` }}
                      onClick={() => !isBlocked && handleSlotClick(dayIndex, hour)}
                      className={`border-b border-[#edf0f3] last:border-b-0 transition-colors relative group/slot ${
                        isBlocked ? 'calendar-hatched' : 'cursor-pointer hover:bg-[#f8faff]/60'
                      }`}
                    >
                      {/* Subtle 15-minute snap division guidelines (:15, :30, :45) - only shown when dragging */}
                      {!isBlocked && isDragging && (
                        <div className="absolute inset-0 pointer-events-none grid grid-rows-4 animate-fade-in">
                          <div className="border-b border-[#edf0f3]/60 border-dotted" />
                          <div className="border-b border-[#edf0f3] border-dashed" />
                          <div className="border-b border-[#edf0f3]/60 border-dotted" />
                          <div />
                        </div>
                      )}

                    </div>
                  )
                })}

                {/* Snapped Landing Target Ghost Indicator */}
                {dragState && isDragging && dragState.targetDayIndex === dayIndex && (
                  <div
                    style={{
                      top: `${(dragState.snappedStartHour - START_HOUR) * HOUR_HEIGHT + 4}px`,
                      height: `${dragState.event.durationHours * HOUR_HEIGHT - 8}px`,
                      borderColor: dragState.isBlocked
                        ? '#ef4444'
                        : (THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).accent,
                      backgroundColor: dragState.isBlocked
                        ? 'rgba(254, 226, 226, 0.5)'
                        : `${(THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).accent}14`,
                    }}
                    className={`absolute left-1.5 right-1.5 rounded-[8px] border-2 border-dashed pointer-events-none z-20 flex flex-col justify-between p-2.5 transition-all duration-75 shadow-xs ${
                      dragState.isBlocked ? 'border-red-500 calendar-hatched' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded shadow-xs flex items-center gap-1"
                        style={{
                          backgroundColor: dragState.isBlocked
                            ? '#ef4444'
                            : (THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).accent,
                          color: '#ffffff',
                        }}
                      >
                        <Clock size={10} />
                        {dragState.isBlocked
                          ? 'Blocked slot'
                          : `${formatHourMinute(dragState.snappedStartHour)} – ${formatHourMinute(
                              dragState.snappedStartHour + dragState.event.durationHours
                            )}`}
                      </span>
                      <span className="text-[10px] font-bold tracking-wider text-[#6f7988]">
                        :{formatHourMinute(dragState.snappedStartHour).split(':')[1]} snap
                      </span>
                    </div>
                    <div className="text-[11px] font-semibold text-[#1c1d1f] truncate">
                      {dragState.event.title}
                    </div>
                  </div>
                )}

                {/* Event Cards */}
                {dayEvents.map((event) => {
                  const isBeingDragged = isDragging && dragState?.event.id === event.id
                  const isBeingResized = isResizing && resizeState?.event.id === event.id

                  const durationHours = isBeingResized ? resizeState.currentDuration : event.durationHours
                  const topOffset = (event.startHour - START_HOUR) * HOUR_HEIGHT
                  const height = durationHours * HOUR_HEIGHT
                  const theme = THEME_STYLES[event.colorTheme] || THEME_STYLES.blue
                  const isResizeBlocked = isBeingResized && resizeState.isBlocked

                  return (
                    <div
                      key={event.id}
                      onPointerDown={(e) => handleCardPointerDown(e, event)}
                      onClick={(e) => handleEventClick(e, event)}
                      style={{
                        top: `${topOffset + 4}px`,
                        height: `${height - 8}px`,
                        backgroundColor: isResizeBlocked ? '#fef2f2' : theme.bg,
                        borderColor: isResizeBlocked
                          ? '#f87171'
                          : isBeingResized
                          ? theme.accent
                          : theme.border,
                        opacity: isBeingDragged ? 0.3 : 1,
                        touchAction: 'none',
                      }}
                      className={`absolute left-1.5 right-1.5 rounded-[8px] p-2.5 border shadow-2xs hover:shadow-md transition-[box-shadow,border-color] flex flex-col justify-start gap-1 z-10 overflow-hidden select-none group cursor-grab active:cursor-grabbing ${
                        isBeingDragged ? 'border-dashed !cursor-grabbing' : ''
                      } ${isBeingResized ? 'ring-2 ring-[#266df0]/30 shadow-md' : ''}`}
                    >
                      {/* Top: Time */}
                      <div className="flex items-center justify-between text-[10px] text-[#6f7988] font-medium mb-0.5">
                        <span className="flex items-center gap-1 font-semibold">
                          <Clock size={10} className="text-[#9fa1a7]" />
                          {event.startTimeLabel} –{' '}
                          {isBeingResized
                            ? formatHourMinute(event.startHour + durationHours)
                            : event.endTimeLabel}
                        </span>
                      </div>

                      {/* Title & subtitle */}
                      <div>
                        <h4 className="text-[12px] font-bold text-[#1c1d1f] group-hover:text-[#266df0] transition-colors line-clamp-2 leading-tight">
                          {event.title}
                        </h4>

                        {event.subtitle && (
                          <p className="text-[10px] text-[#8f99a8] mt-0.5 line-clamp-1 leading-snug">
                            {event.subtitle}
                          </p>
                        )}

                        {event.category === 'milestone' && (
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="px-1.5 py-0.2 rounded-[4px] bg-[#e9f0ff] text-[#266df0] text-[9px] font-mono font-bold uppercase tracking-wider flex items-center gap-1">
                              <span>⬡</span>
                              <span>Milestone</span>
                            </span>
                            {event.amountLabel && (
                              <span className="px-1.5 py-0.2 rounded-[4px] bg-[#f0f2f5] text-[#232529] text-[9px] font-mono font-bold">
                                {event.amountLabel}
                              </span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Bottom resize handle - hidden when not dragging/hovering */}
                      <div
                        onPointerDown={(e) => handleResizeStart(e, event)}
                        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-20"
                        title="Drag to resize duration (:15 snap)"
                      >
                        <div className="w-6 h-0.5 rounded-full bg-black/20 hover:bg-[#266df0] transition-colors" />
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* Floating Card Moving Freely with cursor */}
      {dragState && isDragging && (
        <div
          style={{
            position: 'fixed',
            left: `${dragState.pointerX - dragState.grabOffsetX}px`,
            top: `${dragState.pointerY - dragState.grabOffsetY}px`,
            width: `${dragState.cardWidth}px`,
            height: `${dragState.cardHeight}px`,
            backgroundColor: (THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).bg,
            borderColor: dragState.isBlocked
              ? '#ef4444'
              : (THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).accent,
            zIndex: 9999,
            pointerEvents: 'none',
            transform: 'scale(1.03) rotate(1.2deg)',
            transformOrigin: 'top left',
            boxShadow: '0 20px 35px -5px rgba(0, 0, 0, 0.22), 0 10px 15px -5px rgba(0, 0, 0, 0.12)',
          }}
          className="rounded-[8px] p-2.5 border-2 flex flex-col justify-start gap-1 overflow-hidden opacity-95 transition-transform"
        >
          {/* Floating Header with Live Snapped Time & Day badge */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span
                className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-xs"
                style={{
                  backgroundColor: dragState.isBlocked
                    ? '#ef4444'
                    : (THEME_STYLES[dragState.event.colorTheme] || THEME_STYLES.blue).accent,
                  color: '#ffffff',
                }}
              >
                <Clock size={10} />
                {dragState.isBlocked
                  ? `Blocked on ${days[dragState.targetDayIndex]?.dayName}`
                  : `${days[dragState.targetDayIndex]?.dayName} ${formatHourMinute(
                      dragState.snappedStartHour
                    )} – ${formatHourMinute(
                      dragState.snappedStartHour + dragState.event.durationHours
                    )}`}
              </span>
            </div>

            <h4 className="text-[12px] font-bold text-[#1c1d1f] line-clamp-2 leading-tight">
              {dragState.event.title}
            </h4>

            {dragState.event.subtitle && (
              <p className="text-[10px] text-[#8f99a8] mt-1 line-clamp-2 leading-snug">
                {dragState.event.subtitle}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 5. MODAL FOR VIEWING & ADDING EVENTS */}
      <EventModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        selectedEvent={selectedEvent}
        defaultDayIndex={modalDefaultDay}
        defaultStartHour={modalDefaultHour}
        onSaveEvent={handleSaveEvent}
        onDeleteEvent={handleDeleteEvent}
      />
    </div>
  )
}
