'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Sparkles,
  DollarSign,
  AlertCircle,
  Plus,
  RefreshCw,
  Star,
  ExternalLink,
  ChevronRight,
  Briefcase,
  Check,
} from 'lucide-react'
import { useShortcutContext, useShortcut } from '@/components/shortcuts/shortcut-provider'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { TaskRow } from '@/components/projects/task-row'
import { DueDatePopover } from '@/components/projects/due-date-popover'
import { TaskQuickAdd } from '@/components/projects/task-quick-add'
import { localToday, formatRelativeDate, diffDays } from '@/lib/projects/dates'
import { formatMinor } from '@/lib/projects/money'
import { getSuggestionToastText } from '@/lib/projects/suggestions'
import { OPERATOR_CONFIG } from '@/lib/config'
import type {
  TodayData,
  TodayItem,
  Task,
  Invoice,
  ProjectCard,
} from '@/lib/projects/types'
import {
  fetchTodayAction,
  toggleTaskAction,
  updateTaskAction,
  updateProjectAction,
  toggleProjectWaitingAction,
  setInvoiceStatusAction,
  createTaskAction,
} from '@/app/actions/projects'
import { toggleFollowUpAction, logActivityAction } from '@/app/actions/crm'

interface FlattenedEntry {
  key: string
  sectionId: string
  sectionTitle: string
  item: TodayItem
}

interface TodayViewProps {
  onOpenDeal?: (dealId: string) => void
  onStartProject?: (dealId?: string) => void
  onNewDeal?: () => void
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function TodayView({
  onOpenDeal,
  onStartProject,
  onNewDeal,
  showToast,
}: TodayViewProps) {
  // Push todayList context so list, today, and global shortcuts are active
  useShortcutContext('todayList')
  const router = useRouter()

  const [data, setData] = useState<TodayData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  // Modals / popovers
  const [dueDateTaskId, setDueDateTaskId] = useState<string | null>(null)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [quickAddProjectId, setQuickAddProjectId] = useState<string | null>(null)

  const today = localToday()

  // Format today header e.g. "Today · Fri 23 Oct"
  const formattedHeaderDate = useMemo(() => {
    try {
      const parts = new Date().toLocaleDateString(OPERATOR_CONFIG.locale || 'en-US', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      })
      return `Today · ${parts}`
    } catch {
      return `Today · ${today}`
    }
  }, [today])

  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchTodayAction({ today: localToday() })
      if (res.ok) {
        setData(res.data)
      } else {
        const msg = res.error?.message || 'Failed to load Today'
        setError(msg)
        showToast?.(msg, 'error')
      }
    } catch (err: any) {
      const msg = err.message || 'Error loading Today'
      setError(msg)
      showToast?.(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Flatten items for list keyboard navigation
  const flattenedEntries = useMemo<FlattenedEntry[]>(() => {
    if (!data) return []
    const result: FlattenedEntry[] = []

    const sectionTitles: Record<string, string> = {
      overdue: 'OVERDUE',
      dueToday: 'DUE TODAY',
      focus: 'FOCUS',
      nextStep: 'NEEDS A NEXT STEP',
      waiting: 'WAITING ON CLIENT',
      money: 'MONEY',
      sales: 'SALES',
    }

    for (const sec of data.sections) {
      if (sec.items.length === 0) continue
      const title = `${sectionTitles[sec.id] || sec.id.toUpperCase()} · ${sec.items.length}`
      for (const item of sec.items) {
        let key = ''
        if (item.type === 'task') key = `task-${item.task.id}`
        else if (item.type === 'project') key = `project-${item.card.project.id}`
        else if (item.type === 'invoice') key = `invoice-${item.invoice.id}`
        else if (item.type === 'followUp') key = `fu-${item.followUp.id}`
        else if (item.type === 'startProject') key = `deal-${item.deal.id}`

        result.push({
          key,
          sectionId: sec.id,
          sectionTitle: title,
          item,
        })
      }
    }
    return result
  }, [data])

  // Keep selected index in bounds
  useEffect(() => {
    if (flattenedEntries.length === 0) {
      setSelectedIndex(0)
    } else if (selectedIndex >= flattenedEntries.length) {
      setSelectedIndex(flattenedEntries.length - 1)
    }
  }, [flattenedEntries.length, selectedIndex])

  const selectedEntry = flattenedEntries[selectedIndex] || null

  // Shortcuts
  useShortcut('list.down', () => {
    setSelectedIndex((prev) => Math.min(prev + 1, flattenedEntries.length - 1))
  })

  useShortcut('list.up', () => {
    setSelectedIndex((prev) => Math.max(prev - 1, 0))
  })

  useShortcut('list.open', () => {
    if (!selectedEntry) return
    const { item } = selectedEntry
    if (item.type === 'task') {
      router.push(`/projects/${item.project.id}`)
    } else if (item.type === 'project') {
      router.push(`/projects/${item.card.project.id}`)
    } else if (item.type === 'invoice') {
      router.push(`/projects/${item.project.id}`)
    } else if (item.type === 'followUp') {
      if (item.followUp.dealId) onOpenDeal?.(item.followUp.dealId)
    } else if (item.type === 'startProject') {
      onOpenDeal?.(item.deal.id)
    }
  })

  useShortcut('list.toggleDone', async () => {
    if (!selectedEntry) return
    const { item } = selectedEntry
    if (item.type === 'task') {
      const isComplete = !item.task.completedAt
      // Optimistic update
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          sections: prev.sections.map((sec) => ({
            ...sec,
            items: sec.items.filter((i) => !(i.type === 'task' && i.task.id === item.task.id)),
          })),
        }
      })
      const res = await toggleTaskAction({
        id: item.task.id,
        done: isComplete,
      })
      if (res.ok && res.suggestions && res.suggestions.length > 0) {
        showToast?.(getSuggestionToastText(res.suggestions[0]), 'info')
      }
      loadData()
    } else if (item.type === 'followUp') {
      setData((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          sections: prev.sections.map((sec) => ({
            ...sec,
            items: sec.items.filter((i) => !(i.type === 'followUp' && i.followUp.id === item.followUp.id)),
          })),
        }
      })
      await toggleFollowUpAction(item.followUp.id)
      loadData()
    }
  })

  useShortcut('list.dueDate', () => {
    if (!selectedEntry || selectedEntry.item.type !== 'task') return
    setDueDateTaskId(selectedEntry.item.task.id)
  })

  useShortcut('list.toggleFocus', async () => {
    if (!selectedEntry || selectedEntry.item.type !== 'task') return
    const t = selectedEntry.item.task
    const newFocusDate = t.focusDate ? null : today
    await updateTaskAction({ id: t.id, patch: { focusDate: newFocusDate } })
    loadData()
  })

  useShortcut('list.quickAdd', () => {
    if (selectedEntry && selectedEntry.item.type === 'project') {
      setQuickAddProjectId(selectedEntry.item.card.project.id)
    } else {
      setQuickAddProjectId(null)
    }
    setIsQuickAddOpen(true)
  })

  useShortcut('today.nudge', async () => {
    if (!selectedEntry || selectedEntry.item.type !== 'project') return
    const card = selectedEntry.item.card
    try {
      await logActivityAction(
        {
          type: 'Email',
          title: `Nudge client regarding ${card.project.title}`,
          company: card.project.company,
          person: card.project.contactName || '',
          date: today,
          status: 'Completed',
          color: 'blue',
        },
        undefined,
        card.project.dealId || undefined
      )
      showToast?.(`Nudge logged for ${card.project.title}`, 'success')
      loadData()
    } catch (err: any) {
      showToast?.(err.message || 'Failed to log nudge', 'error')
    }
  })

  useShortcut('today.clearWaiting', async () => {
    if (!selectedEntry || selectedEntry.item.type !== 'project') return
    const card = selectedEntry.item.card
    try {
      await toggleProjectWaitingAction({
        id: card.project.id,
        today,
      })
      showToast?.(`Cleared waiting status for ${card.project.title}`, 'success')
      loadData()
    } catch (err: any) {
      showToast?.(err.message || 'Failed to clear waiting status', 'error')
    }
  })

  useShortcut('today.markPaid', async () => {
    if (!selectedEntry || selectedEntry.item.type !== 'invoice') return
    const inv = selectedEntry.item.invoice
    try {
      const res = await setInvoiceStatusAction({
        id: inv.id,
        status: 'paid',
        today,
      })
      showToast?.(`Invoice ${inv.label} marked paid`, 'success')
      if (res.ok && res.suggestions && res.suggestions.length > 0) {
        showToast?.(getSuggestionToastText(res.suggestions[0]), 'info')
      }
      loadData()
    } catch (err: any) {
      showToast?.(err.message || 'Failed to mark paid', 'error')
    }
  })

  useShortcut('today.markSent', async () => {
    if (!selectedEntry || selectedEntry.item.type !== 'invoice') return
    const inv = selectedEntry.item.invoice
    try {
      await setInvoiceStatusAction({
        id: inv.id,
        status: 'sent',
        today,
      })
      showToast?.(`Invoice ${inv.label} marked sent`, 'success')
      loadData()
    } catch (err: any) {
      showToast?.(err.message || 'Failed to mark sent', 'error')
    }
  })

  // Selected task for due date modal
  const selectedTaskForDueDate = useMemo(() => {
    if (!dueDateTaskId || !data) return null
    for (const sec of data.sections) {
      for (const item of sec.items) {
        if (item.type === 'task' && item.task.id === dueDateTaskId) {
          return item.task
        }
      }
    }
    return null
  }, [dueDateTaskId, data])

  // Render Loading Skeleton
  if (isLoading && !data) {
    return (
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-slate-900">
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">
          <div className="h-5 w-44 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
          <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
        </div>
        <div className="flex-1 p-6 space-y-8 overflow-y-auto">
          {[1, 2, 3].map((s) => (
            <div key={s} className="space-y-3">
              <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
              <div className="space-y-2">
                {[1, 2, 3].map((r) => (
                  <div key={r} className="h-10 bg-slate-100 dark:bg-slate-800/60 rounded-lg animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Render Error
  if (error && !data) {
    return (
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-slate-900">
        <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">{formattedHeaderDate}</h1>
        </div>
        <div className="flex-1 flex items-center justify-center p-6">
          <div className="max-w-md w-full p-6 text-center bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 rounded-xl space-y-4">
            <AlertCircle size={32} className="mx-auto text-red-600 dark:text-red-400" />
            <div>
              <h2 className="text-sm font-semibold text-red-900 dark:text-red-200">Couldn't load Today</h2>
              <p className="text-xs text-red-700 dark:text-red-400 mt-1">{error}</p>
            </div>
            <button
              type="button"
              onClick={loadData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <RefreshCw size={13} />
              <span>Retry</span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Check if completely empty or all clear
  const totalItems = flattenedEntries.length

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-slate-900">
      {/* Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 bg-white/80 dark:bg-slate-900/80 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {formattedHeaderDate}
          </h1>
          {data && data.badgeCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
              {data.badgeCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setQuickAddProjectId(null)
              setIsQuickAddOpen(true)
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 shadow-sm transition-colors"
          >
            <Plus size={14} />
            <span>Task</span>
            <kbd className="ml-1 px-1 py-0.2 bg-blue-700 rounded text-[10px] font-mono">T</kbd>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-8">
        {totalItems === 0 ? (
          <div className="h-96 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shadow-inner">
              <Check size={24} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-200">
                All clear for today.
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                No overdue tasks, no urgent invoices, and everything is on track.
              </p>
            </div>
            <div className="flex items-center gap-2 pt-2">
              {onStartProject && (
                <button
                  type="button"
                  onClick={() => onStartProject()}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Start project <kbd className="ml-1 text-[10px] font-mono">P</kbd>
                </button>
              )}
              {onNewDeal && (
                <button
                  type="button"
                  onClick={onNewDeal}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                >
                  New deal <kbd className="ml-1 text-[10px] font-mono">N</kbd>
                </button>
              )}
            </div>
          </div>
        ) : (
          data?.sections.map((section) => {
            if (section.items.length === 0) return null

            const sectionTitles: Record<string, string> = {
              overdue: 'OVERDUE',
              dueToday: 'DUE TODAY',
              focus: 'FOCUS',
              nextStep: 'NEEDS A NEXT STEP',
              waiting: 'WAITING ON CLIENT',
              money: 'MONEY',
              sales: 'SALES',
            }

            return (
              <div key={section.id} className="space-y-2">
                <div className="flex items-center justify-between text-[11px] font-bold tracking-wider text-slate-400 dark:text-slate-500 uppercase px-1">
                  <span>
                    {sectionTitles[section.id] || section.id} · {section.items.length}
                  </span>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800/60 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900/50 shadow-sm">
                  {section.items.map((item) => {
                    let entryKey = ''
                    if (item.type === 'task') entryKey = `task-${item.task.id}`
                    else if (item.type === 'project') entryKey = `project-${item.card.project.id}`
                    else if (item.type === 'invoice') entryKey = `invoice-${item.invoice.id}`
                    else if (item.type === 'followUp') entryKey = `fu-${item.followUp.id}`
                    else if (item.type === 'startProject') entryKey = `deal-${item.deal.id}`

                    const flatIndex = flattenedEntries.findIndex((e) => e.key === entryKey)
                    const isSelected = flatIndex === selectedIndex

                    // TASK ITEM
                    if (item.type === 'task') {
                      const subtitle = [item.project.title, item.milestoneTitle]
                        .filter(Boolean)
                        .join(' · ')
                      return (
                        <TaskRow
                          key={item.task.id}
                          task={item.task}
                          isSelected={isSelected}
                          subtitle={subtitle}
                          focusBadgeText={
                            item.fromDate
                              ? `★ from ${formatRelativeDate(item.fromDate, today)}`
                              : item.task.focusDate
                              ? '★'
                              : undefined
                          }
                          onSelect={() => setSelectedIndex(flatIndex)}
                          onToggleDone={async () => {
                            const isComp = !item.task.completedAt
                            await toggleTaskAction({
                              id: item.task.id,
                              done: isComp,
                            })
                            loadData()
                          }}
                          onOpenDetails={() => router.push(`/projects/${item.project.id}`)}
                          onOpenDueDate={() => setDueDateTaskId(item.task.id)}
                          onToggleFocus={async () => {
                            const nfd = item.task.focusDate ? null : today
                            await updateTaskAction({ id: item.task.id, patch: { focusDate: nfd } })
                            loadData()
                          }}
                        />
                      )
                    }

                    // PROJECT ITEM (Next Step or Waiting)
                    if (item.type === 'project') {
                      const card = item.card
                      const isWaiting = !!card.project.waitingSinceDate
                      const waitingDays = card.project.waitingSinceDate
                        ? diffDays(card.project.waitingSinceDate, today)
                        : null

                      return (
                        <div
                          key={card.project.id}
                          onClick={() => {
                            setSelectedIndex(flatIndex)
                            router.push(`/projects/${card.project.id}`)
                          }}
                          className={`group flex items-center justify-between px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            {isWaiting ? (
                              <Clock size={14} className="text-amber-500 shrink-0" />
                            ) : (
                              <div className="w-3.5 h-3.5 rounded-sm border-2 border-slate-400 dark:border-slate-500 rotate-45 shrink-0" />
                            )}
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {card.project.title}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">·</span>
                              <span className="text-slate-500 dark:text-slate-400 truncate">
                                {card.stage.name}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">·</span>
                              <span
                                className={`text-[11px] truncate ${
                                  isWaiting
                                    ? 'text-amber-600 dark:text-amber-400'
                                    : 'text-slate-500 dark:text-slate-400'
                                }`}
                              >
                                {isWaiting
                                  ? `${waitingDays} day${waitingDays === 1 ? '' : 's'}`
                                  : 'no dated task'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {isWaiting ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    try {
                                      await logActivityAction(
                                        {
                                          type: 'Email',
                                          title: `Nudge client regarding ${card.project.title}`,
                                          company: card.project.company,
                                          person: card.project.contactName || '',
                                          date: today,
                                          status: 'Completed',
                                          color: 'blue',
                                        },
                                        undefined,
                                        card.project.dealId || undefined
                                      )
                                      showToast?.(`Nudged client for ${card.project.title}`, 'success')
                                    } catch (err: any) {
                                      showToast?.(err.message, 'error')
                                    }
                                  }}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 hover:bg-amber-100 transition-colors"
                                >
                                  Nudge <kbd className="ml-0.5 text-[9px] font-mono">⇧N</kbd>
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation()
                                    await toggleProjectWaitingAction({
                                      id: card.project.id,
                                      today,
                                    })
                                    showToast?.(`Cleared waiting for ${card.project.title}`, 'success')
                                    loadData()
                                  }}
                                  className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 transition-colors"
                                >
                                  Done <kbd className="ml-0.5 text-[9px] font-mono">W</kbd>
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  router.push(`/projects/${card.project.id}`)
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 transition-colors"
                              >
                                Add task <kbd className="ml-0.5 text-[9px] font-mono">T</kbd>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // INVOICE ITEM
                    if (item.type === 'invoice') {
                      const inv = item.invoice
                      const formattedAmount = formatMinor(inv.amountMinor, inv.currency, {
                        currency: inv.currency,
                        currencySymbol: inv.currency === 'EUR' ? '€' : '$',
                        locale: OPERATOR_CONFIG.locale || 'en-US',
                      })
                      const overdueDays = item.overdueDays

                      return (
                        <div
                          key={inv.id}
                          onClick={() => {
                            setSelectedIndex(flatIndex)
                            router.push(`/projects/${item.project.id}`)
                          }}
                          className={`group flex items-center justify-between px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <span className="font-mono text-xs font-semibold text-slate-500 shrink-0">
                              {inv.currency === 'EUR' ? '€' : '$'}
                            </span>
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                                {item.project.title}
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">·</span>
                              <span className="text-slate-600 dark:text-slate-400 truncate">
                                {inv.label}
                              </span>
                              {inv.hours && (
                                <span className="text-slate-400 text-[11px]">
                                  {inv.hours}h
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-3 shrink-0 ml-3">
                            <span className="font-mono font-medium text-slate-900 dark:text-slate-100">
                              {formattedAmount}
                            </span>

                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-full ${
                                overdueDays !== null && overdueDays > 0
                                  ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 font-semibold'
                                  : inv.status === 'sent'
                                  ? 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
                                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                              }`}
                            >
                              {overdueDays !== null && overdueDays > 0
                                ? `sent · ${overdueDays}d overdue`
                                : inv.status}
                            </span>

                            {inv.status === 'draft' ? (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  await setInvoiceStatusAction({
                                    id: inv.id,
                                    status: 'sent',
                                    today,
                                  })
                                  showToast?.(`Marked ${inv.label} as sent`, 'success')
                                  loadData()
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60 hover:bg-blue-100 transition-colors"
                              >
                                Sent <kbd className="ml-0.5 text-[9px] font-mono">S</kbd>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const res = await setInvoiceStatusAction({
                                    id: inv.id,
                                    status: 'paid',
                                    today,
                                  })
                                  showToast?.(`Marked ${inv.label} as paid`, 'success')
                                  if (res.ok && res.suggestions && res.suggestions.length > 0) {
                                    showToast?.(getSuggestionToastText(res.suggestions[0]), 'info')
                                  }
                                  loadData()
                                }}
                                className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
                              >
                                Paid <kbd className="ml-0.5 text-[9px] font-mono">$</kbd>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    }

                    // SALES ITEM (Follow-up or Won Deal)
                    if (item.type === 'followUp') {
                      const fu = item.followUp
                      return (
                        <div
                          key={fu.id}
                          onClick={() => {
                            setSelectedIndex(flatIndex)
                            if (fu.dealId) onOpenDeal?.(fu.dealId)
                          }}
                          className={`group flex items-center justify-between px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation()
                                await toggleFollowUpAction(fu.id)
                                loadData()
                              }}
                              className="w-4 h-4 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center hover:border-blue-500 shrink-0"
                            >
                              {fu.completed && <Check size={10} className="text-blue-500" />}
                            </button>
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              {fu.task}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="text-slate-500 dark:text-slate-400 truncate">
                              follow-up
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            {fu.time && (
                              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                                {fu.time}
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    }

                    if (item.type === 'startProject') {
                      const d = item.deal
                      return (
                        <div
                          key={d.id}
                          onClick={() => {
                            setSelectedIndex(flatIndex)
                            onStartProject ? onStartProject(d.id) : onOpenDeal?.(d.id)
                          }}
                          className={`group flex items-center justify-between px-3 py-2.5 text-xs transition-colors cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-500/50'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 flex-1">
                            <Sparkles size={14} className="text-emerald-500 shrink-0" />
                            <span className="font-medium text-slate-800 dark:text-slate-200 truncate">
                              Start project: {d.title}
                            </span>
                            <span className="text-slate-400 dark:text-slate-500">·</span>
                            <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                              deal won · {formatMinor(d.rawAmount, 'EUR')}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                if (onStartProject) onStartProject(d.id)
                              }}
                              className="px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 hover:bg-emerald-100 transition-colors"
                            >
                              Start <kbd className="ml-0.5 text-[9px] font-mono">P</kbd>
                            </button>
                          </div>
                        </div>
                      )
                    }

                    return null
                  })}
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Footer Shortcut Legend */}
      <div className="h-9 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center text-[11px] text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-900/50">
        <span>J/K move · X done · D date · F pin · ↵ open · ? all shortcuts</span>
      </div>

      {/* Due Date Popover */}
      {selectedTaskForDueDate && (
        <DueDatePopover
          isOpen={!!dueDateTaskId}
          currentDueDate={selectedTaskForDueDate.dueDate}
          onClose={() => setDueDateTaskId(null)}
          onSaveDueDate={async (newDueDate) => {
            if (!dueDateTaskId) return
            await updateTaskAction({ id: dueDateTaskId, patch: { dueDate: newDueDate } })
            setDueDateTaskId(null)
            loadData()
          }}
        />
      )}

      {/* Quick Add Modal */}
      {isQuickAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Task to Today
            </h3>
            {(() => {
              let projId = quickAddProjectId
              if (!projId && data) {
                for (const s of data.sections) {
                  for (const it of s.items) {
                    if (it.type === 'task') {
                      projId = it.project.id
                      break
                    }
                    if (it.type === 'project') {
                      projId = it.card.project.id
                      break
                    }
                  }
                  if (projId) break
                }
              }

              if (!projId) {
                return (
                  <div className="text-xs text-slate-500 py-3 text-center">
                    No active project found. Start a project first to add tasks.
                  </div>
                )
              }

              return (
                <TaskQuickAdd
                  projectId={projId}
                  milestones={[]}
                  isOpen={isQuickAddOpen}
                  onClose={() => setIsQuickAddOpen(false)}
                  onCreateTask={async (params) => {
                    const res = await createTaskAction({
                      projectId: projId!,
                      title: params.title,
                      milestoneId: params.milestoneId || undefined,
                      dueDate: params.dueDate || undefined,
                      focusDate: params.focusDate || undefined,
                    })
                    if (res.ok) {
                      showToast?.('Task added', 'success')
                      setIsQuickAddOpen(false)
                      loadData()
                    } else {
                      showToast?.(res.error.message || 'Failed to create task', 'error')
                    }
                  }}
                />
              )
            })()}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setIsQuickAddOpen(false)}
                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
