'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
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
  ChevronLeft,
  Calendar,
  AlertTriangle,
  Briefcase,
  ArrowRight,
  ArrowLeft,
  Check,
} from 'lucide-react'
import { useShortcutContext, useShortcut } from '@/components/shortcuts/shortcut-provider'
import { TaskRow } from '@/components/projects/task-row'
import { DueDatePopover } from '@/components/projects/due-date-popover'
import { TaskQuickAdd } from '@/components/projects/task-quick-add'
import { localToday, formatRelativeDate, diffDays } from '@/lib/projects/dates'
import { formatMinor } from '@/lib/projects/money'
import { viewHref } from '@/lib/navigation'
import type {
  WeeklyReviewData,
} from '@/lib/projects/review'
import type {
  ProjectCard,
  TodayItem,
  Task,
  Invoice,
} from '@/lib/projects/types'
import {
  fetchWeeklyReviewAction,
  completeWeeklyReviewAction,
  updateProjectAction,
  toggleProjectWaitingAction,
  setInvoiceStatusAction,
  createTaskAction,
  updateTaskAction,
  toggleTaskAction,
  deleteTaskAction,
  fetchProjectAction,
} from '@/app/actions/projects'
import { logActivityAction } from '@/app/actions/crm'

interface WeeklyReviewProps {
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
  onOpenProject?: (id: string) => void
}

type ReviewStep = 1 | 2 | 3 | 4

const STEP_LABELS: Record<ReviewStep, string> = {
  1: 'Loose ends',
  2: 'Projects',
  3: 'Money',
  4: 'Next week',
}

export function WeeklyReview({ showToast, onOpenProject }: WeeklyReviewProps) {
  const router = useRouter()
  useShortcutContext('review')
  const today = useMemo(() => localToday(), [])

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<WeeklyReviewData | null>(null)
  const [step, setStep] = useState<ReviewStep>(1)
  const [projectCardIndex, setProjectCardIndex] = useState(0)

  // Modals / popovers
  const [dueDateTaskId, setDueDateTaskId] = useState<string | null>(null)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [currentProjectDetailTasks, setCurrentProjectDetailTasks] = useState<Task[]>([])

  // Counts for completion activity
  const [reviewedProjectIds, setReviewedProjectIds] = useState<Set<string>>(new Set())
  const [invoicesChasedCount, setInvoicesChasedCount] = useState(0)
  const [tasksScheduledCount, setTasksScheduledCount] = useState(0)

  // Load Review data
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetchWeeklyReviewAction({ today: localToday() })
      if (res.ok) {
        setData(res.data)
      } else {
        const msg = res.error?.message || 'Failed to load weekly review'
        setError(msg)
        showToast?.(msg, 'error')
      }
    } catch (err: any) {
      const msg = err.message || 'Error loading weekly review'
      setError(msg)
      showToast?.(msg, 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Current project in Step 2
  const currentProjectCard = useMemo<ProjectCard | null>(() => {
    if (!data || data.projects.length === 0) return null
    return data.projects[projectCardIndex] ?? null
  }, [data, projectCardIndex])

  // Fetch tasks for the current project in Step 2
  useEffect(() => {
    if (step === 2 && currentProjectCard) {
      fetchProjectAction({ id: currentProjectCard.project.id, today }).then((res) => {
        if (res.ok) {
          setCurrentProjectDetailTasks(res.data.tasks)
          setReviewedProjectIds((prev) => new Set(prev).add(currentProjectCard.project.id))
        }
      })
    }
  }, [step, currentProjectCard, today])

  // Is Step 2 blocked on next step?
  const isProjectStepBlocked = useMemo(() => {
    if (step !== 2 || !currentProjectCard) return false
    return currentProjectCard.needsNextStep
  }, [step, currentProjectCard])

  // Navigation handlers
  const handleNext = useCallback(() => {
    if (step === 1) {
      setStep(2)
      setProjectCardIndex(0)
    } else if (step === 2) {
      if (isProjectStepBlocked) {
        showToast?.('Add a next step (T) or mark waiting (W)', 'warning')
        return
      }
      if (data && projectCardIndex < data.projects.length - 1) {
        setProjectCardIndex((prev) => prev + 1)
      } else {
        setStep(3)
      }
    } else if (step === 3) {
      setStep(4)
    }
  }, [step, isProjectStepBlocked, data, projectCardIndex, showToast])

  const handlePrev = useCallback(() => {
    if (step === 2) {
      if (projectCardIndex > 0) {
        setProjectCardIndex((prev) => prev - 1)
      } else {
        setStep(1)
      }
    } else if (step === 3) {
      setStep(2)
      if (data && data.projects.length > 0) {
        setProjectCardIndex(data.projects.length - 1)
      }
    } else if (step === 4) {
      setStep(3)
    }
  }, [step, projectCardIndex, data])

  // Finish review
  const handleFinish = useCallback(async () => {
    try {
      const projectsCount = data ? Math.max(reviewedProjectIds.size, data.projects.length) : 0
      const res = await completeWeeklyReviewAction({
        projectsReviewed: projectsCount,
        invoicesChased: invoicesChasedCount,
        tasksScheduled: tasksScheduledCount,
      })
      if (res.ok) {
        showToast?.('Review done', 'success')
        router.push(viewHref('today'))
      } else {
        showToast?.(res.error?.message || 'Failed to complete review', 'error')
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error completing review', 'error')
    }
  }, [data, reviewedProjectIds, invoicesChasedCount, tasksScheduledCount, showToast, router])

  // Register review keyboard shortcuts
  useShortcut('review.next', handleNext)
  useShortcut('review.prev', handlePrev)
  useShortcut('review.finish', handleFinish)

  // Step 2 health shortcuts
  useShortcut('review.onTrack', async () => {
    if (step !== 2 || !currentProjectCard) return
    await updateProjectAction({
      id: currentProjectCard.project.id,
      patch: { health: 'on_track' },
    })
    showToast?.(`${currentProjectCard.project.title} marked on track`, 'success')
    loadData()
  })

  useShortcut('review.atRisk', async () => {
    if (step !== 2 || !currentProjectCard) return
    await updateProjectAction({
      id: currentProjectCard.project.id,
      patch: { health: 'at_risk' },
    })
    showToast?.(`${currentProjectCard.project.title} marked at risk`, 'warning')
    loadData()
  })

  useShortcut('review.blocked', async () => {
    if (step !== 2 || !currentProjectCard) return
    await updateProjectAction({
      id: currentProjectCard.project.id,
      patch: { health: 'blocked' },
    })
    showToast?.(`${currentProjectCard.project.title} marked blocked`, 'error')
    loadData()
  })

  // Toggle waiting shortcut (Step 2)
  useShortcut('review.toggleWaiting', async () => {
    if (step !== 2 || !currentProjectCard) return
    const res = await toggleProjectWaitingAction({
      id: currentProjectCard.project.id,
      today,
    })
    if (res.ok) {
      const isNowWaiting = !!res.data.waitingSinceDate
      showToast?.(
        isNowWaiting
          ? `Marked waiting on client`
          : `Cleared waiting on client`,
        'success'
      )
      loadData()
    }
  })

  // Nudge client shortcut
  useShortcut('review.nudge', async () => {
    if (step === 2 && currentProjectCard) {
      try {
        await logActivityAction(
          {
            type: 'Email',
            title: `Nudge client regarding ${currentProjectCard.project.title}`,
            company: currentProjectCard.project.company,
            person: currentProjectCard.project.contactName || '',
            date: today,
            status: 'Completed',
            color: 'blue',
          },
          undefined,
          currentProjectCard.project.dealId || undefined
        )
        setInvoicesChasedCount((prev) => prev + 1)
        showToast?.(`Nudge logged for ${currentProjectCard.project.title}`, 'success')
      } catch (err: any) {
        showToast?.(err.message || 'Failed to log nudge', 'error')
      }
    }
  })

  // Add task shortcut (Step 2)
  useShortcut('list.addTask', () => {
    if (step === 2 && currentProjectCard) {
      setIsQuickAddOpen(true)
    }
  })

  // Empty state renderer
  const renderEmpty = () => (
    <div className="flex flex-col items-center justify-center p-12 text-center text-slate-500 dark:text-slate-400">
      <CheckCircle2 size={32} className="text-emerald-500 mb-2 stroke-1" />
      <p className="text-sm font-medium">Nothing here. ✓</p>
    </div>
  )

  if (isLoading && !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <RefreshCw size={16} className="animate-spin text-blue-500" />
          <span>Loading weekly review...</span>
        </div>
      </div>
    )
  }

  if (error && !data) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[400px]">
        <div className="p-6 max-w-md bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 rounded-xl text-center space-y-3">
          <AlertCircle size={28} className="text-rose-500 mx-auto" />
          <p className="text-sm font-medium text-rose-800 dark:text-rose-200">{error}</p>
          <button
            type="button"
            onClick={loadData}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-rose-600 text-white hover:bg-rose-700 cursor-pointer"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-slate-950/50 overflow-hidden">
      {/* Stepper Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-6">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
            <span>Weekly Review</span>
          </h1>

          {/* Stepper pills */}
          <div className="flex items-center gap-2">
            {([1, 2, 3, 4] as ReviewStep[]).map((s) => {
              const isActive = step === s
              const isPast = step > s
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => {
                    setStep(s)
                    if (s === 2) setProjectCardIndex(0)
                  }}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                    isActive
                      ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300 ring-1 ring-blue-500/40'
                      : isPast
                      ? 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200'
                      : 'text-slate-400 dark:text-slate-500 hover:text-slate-600'
                  }`}
                >
                  <span className="font-mono text-[10px]">{s}</span>
                  <span>{STEP_LABELS[s]}</span>
                  {isPast && <Check size={12} className="text-emerald-500 ml-0.5" />}
                </button>
              )
            })}
          </div>
        </div>

        {/* Stepper controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={step === 1 && projectCardIndex === 0}
            onClick={handlePrev}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 transition-colors text-slate-700 dark:text-slate-300 cursor-pointer"
          >
            <ChevronLeft size={14} />
            <span>Prev</span>
            <kbd className="ml-1 text-[10px] font-mono text-slate-400">[</kbd>
          </button>

          {step < 4 ? (
            <button
              type="button"
              disabled={isProjectStepBlocked}
              onClick={handleNext}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors cursor-pointer"
            >
              <span>Next</span>
              <kbd className="ml-1 text-[10px] font-mono opacity-80">]</kbd>
              <ChevronRight size={14} />
            </button>
          ) : (
            <button
              type="button"
              onClick={handleFinish}
              className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded bg-emerald-600 hover:bg-emerald-500 text-white transition-colors cursor-pointer"
            >
              <Check size={14} />
              <span>Finish Review</span>
              <kbd className="ml-1 text-[10px] font-mono opacity-80">⇧↵</kbd>
            </button>
          )}
        </div>
      </div>

      {/* Main step content */}
      <div className="flex-1 overflow-y-auto p-6 max-w-4xl w-full mx-auto">
        {/* STEP 1: LOOSE ENDS */}
        {step === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                1. Loose ends
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tasks with no due date, no focus date, and no milestone. Give them a date, milestone, or complete them.
              </p>
            </div>

            {data && data.looseEnds.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                {data.looseEnds.map((item) => {
                  if (item.type !== 'task') return null
                  return (
                    <TaskRow
                      key={item.task.id}
                      task={item.task}
                      isSelected={false}
                      subtitle={item.project.title}
                      onSelect={() => {}}
                      onOpenDetails={() => {}}
                      onToggleDone={async () => {
                        await toggleTaskAction({ id: item.task.id, done: true })
                        loadData()
                      }}
                      onOpenDueDate={() => setDueDateTaskId(item.task.id)}
                      onToggleFocus={async () => {
                        await updateTaskAction({
                          id: item.task.id,
                          patch: { focusDate: item.task.focusDate ? null : today },
                        })
                        setTasksScheduledCount((prev) => prev + 1)
                        loadData()
                      }}
                    />
                  )
                })}
              </div>
            ) : (
              renderEmpty()
            )}
          </div>
        )}

        {/* STEP 2: PROJECTS */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  2. Projects
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Review each active project. Ensure every project has a dated task or is waiting on the client.
                </p>
              </div>
              {data && data.projects.length > 0 && (
                <span className="text-xs font-mono text-slate-500">
                  {projectCardIndex + 1} of {data.projects.length}
                </span>
              )}
            </div>

            {currentProjectCard ? (
              <div className="border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm p-5 space-y-5">
                {/* Project Header */}
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                        {currentProjectCard.project.title}
                      </h3>
                      <button
                        type="button"
                        onClick={() => onOpenProject?.(currentProjectCard.project.id)}
                        className="text-slate-400 hover:text-blue-500 transition-colors"
                        title="Open project workspace"
                      >
                        <ExternalLink size={14} />
                      </button>
                    </div>
                    <p className="text-xs text-slate-500">{currentProjectCard.project.company}</p>
                  </div>

                  {/* Health Selector Buttons: 1, 2, 3 */}
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-800/80 p-1 rounded-lg border border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      onClick={async () => {
                        await updateProjectAction({
                          id: currentProjectCard.project.id,
                          patch: { health: 'on_track' },
                        })
                        loadData()
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        currentProjectCard.project.health === 'on_track'
                          ? 'bg-emerald-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      On Track <kbd className="text-[9px] opacity-75">1</kbd>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateProjectAction({
                          id: currentProjectCard.project.id,
                          patch: { health: 'at_risk' },
                        })
                        loadData()
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        currentProjectCard.project.health === 'at_risk'
                          ? 'bg-amber-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      At Risk <kbd className="text-[9px] opacity-75">2</kbd>
                    </button>
                    <button
                      type="button"
                      onClick={async () => {
                        await updateProjectAction({
                          id: currentProjectCard.project.id,
                          patch: { health: 'blocked' },
                        })
                        loadData()
                      }}
                      className={`px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                        currentProjectCard.project.health === 'blocked'
                          ? 'bg-rose-500 text-white'
                          : 'text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                      }`}
                    >
                      Blocked <kbd className="text-[9px] opacity-75">3</kbd>
                    </button>
                  </div>
                </div>

                {/* Key Status Row: Due Date, Waiting Days, Invoiced Money */}
                <div className="grid grid-cols-3 gap-3 text-xs bg-slate-50 dark:bg-slate-800/40 p-3 rounded-lg border border-slate-100 dark:border-slate-800">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Due Date</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentProjectCard.project.dueDate
                        ? formatRelativeDate(currentProjectCard.project.dueDate, today)
                        : 'No due date'}
                    </span>
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Waiting Status</span>
                    {currentProjectCard.project.waitingSinceDate ? (
                      <span className="font-medium text-amber-600 dark:text-amber-400">
                        Waiting ({currentProjectCard.waitingDays}d)
                      </span>
                    ) : (
                      <span className="font-medium text-slate-600 dark:text-slate-400">
                        Active (not waiting)
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-slate-400 block text-[11px]">Outstanding Money</span>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {currentProjectCard.money.currency}{' '}
                      {formatMinor(
                        currentProjectCard.money.outstandingMinor,
                        currentProjectCard.money.currency
                      )}
                    </span>
                  </div>
                </div>

                {/* Next 3 Tasks */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      Next tasks ({currentProjectCard.doneTasks}/{currentProjectCard.openTasks + currentProjectCard.doneTasks} done)
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsQuickAddOpen(true)}
                      className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 font-medium cursor-pointer"
                    >
                      <Plus size={12} />
                      <span>Add next step</span>
                      <kbd className="text-[10px] font-mono">T</kbd>
                    </button>
                  </div>

                  {currentProjectDetailTasks.filter((t) => !t.completedAt).slice(0, 3).length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-lg overflow-hidden bg-slate-50/30 dark:bg-slate-900/40">
                      {currentProjectDetailTasks
                        .filter((t) => !t.completedAt)
                        .slice(0, 3)
                        .map((task) => (
                          <TaskRow
                            key={task.id}
                            task={task}
                            isSelected={false}
                            onSelect={() => {}}
                            onOpenDetails={() => {}}
                            onToggleDone={async () => {
                              await toggleTaskAction({ id: task.id, done: true })
                              const res = await fetchProjectAction({
                                id: currentProjectCard.project.id,
                                today,
                              })
                              if (res.ok) setCurrentProjectDetailTasks(res.data.tasks)
                              loadData()
                            }}
                            onOpenDueDate={() => setDueDateTaskId(task.id)}
                            onToggleFocus={async () => {
                              await updateTaskAction({
                                id: task.id,
                                patch: { focusDate: task.focusDate ? null : today },
                              })
                              loadData()
                            }}
                          />
                        ))}
                    </div>
                  ) : (
                    <div className="p-3 text-center text-xs text-slate-400 border border-dashed border-slate-200 dark:border-slate-800 rounded-lg">
                      No open tasks remaining for this project.
                    </div>
                  )}
                </div>

                {/* Inline Next Step Blocker Notice */}
                {isProjectStepBlocked && (
                  <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 rounded-lg flex items-center justify-between text-xs text-amber-800 dark:text-amber-200 animate-in fade-in">
                    <div className="flex items-center gap-2">
                      <AlertTriangle size={16} className="text-amber-500 shrink-0" />
                      <span>Add a next step (T) or mark waiting (W).</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setIsQuickAddOpen(true)}
                        className="px-2 py-1 bg-white dark:bg-slate-800 border border-amber-300 dark:border-amber-700 rounded font-medium hover:bg-amber-100 dark:hover:bg-amber-900/50"
                      >
                        Add task <kbd className="text-[10px]">T</kbd>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          await toggleProjectWaitingAction({
                            id: currentProjectCard.project.id,
                            today,
                          })
                          loadData()
                        }}
                        className="px-2 py-1 bg-amber-600 text-white rounded font-medium hover:bg-amber-500"
                      >
                        Mark waiting <kbd className="text-[10px]">W</kbd>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              renderEmpty()
            )}
          </div>
        )}

        {/* STEP 3: MONEY */}
        {step === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                3. Money pipeline
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review sent invoices needing follow-up and draft invoices ready to be issued.
              </p>
            </div>

            {data && data.money.length > 0 ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
                {data.money.map((item) => {
                  if (item.type !== 'invoice') return null
                  const inv = item.invoice
                  const isSent = inv.status === 'sent'
                  const isOverdueInvoice =
                    inv.dueDate && inv.dueDate < today && inv.status === 'sent'

                  return (
                    <div
                      key={inv.id}
                      className="px-4 py-3 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <DollarSign
                          size={16}
                          className={
                            isOverdueInvoice
                              ? 'text-rose-500'
                              : isSent
                              ? 'text-amber-500'
                              : 'text-slate-400'
                          }
                        />
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900 dark:text-slate-100">
                              {inv.label || 'Invoice'}
                            </span>
                            {inv.number && (
                              <span className="text-[11px] font-mono text-slate-400">
                                #{inv.number}
                              </span>
                            )}
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-medium uppercase tracking-wider ${
                                isOverdueInvoice
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300'
                                  : isSent
                                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300'
                                  : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                              }`}
                            >
                              {isOverdueInvoice ? 'Overdue' : inv.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {item.project.title} · {item.project.company}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-3">
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {formatMinor(inv.amountMinor, inv.currency)}
                        </span>
                        {isSent && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await setInvoiceStatusAction({
                                  id: inv.id,
                                  status: 'paid',
                                  today,
                                })
                                showToast?.(`Invoice ${inv.label} marked paid`, 'success')
                                loadData()
                              }}
                              className="px-2 py-1 rounded bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-100 text-[11px] font-medium"
                            >
                              Paid <kbd className="text-[9px]">$</kbd>
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await logActivityAction(
                                  {
                                    type: 'Email',
                                    title: `Chased payment for invoice ${inv.label}`,
                                    company: item.project.company,
                                    person: '',
                                    date: today,
                                    status: 'Completed',
                                    color: 'blue',
                                  },
                                  undefined,
                                  undefined
                                )
                                setInvoicesChasedCount((prev) => prev + 1)
                                showToast?.(`Payment chase logged`, 'success')
                              }}
                              className="px-2 py-1 rounded bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 hover:bg-amber-100 text-[11px] font-medium"
                            >
                              Chase <kbd className="text-[9px]">⇧N</kbd>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              renderEmpty()
            )}
          </div>
        )}

        {/* STEP 4: NEXT WEEK */}
        {step === 4 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                4. Next week
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Review scheduled tasks for next Monday through Sunday. Reschedule or plan ahead.
              </p>
            </div>

            {data && data.nextWeek.some((d) => d.items.length > 0) ? (
              <div className="space-y-3">
                {data.nextWeek.map((dayGroup) => (
                  <div
                    key={dayGroup.date}
                    className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
                  >
                    <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                      <span>{formatRelativeDate(dayGroup.date, today)}</span>
                      <span className="font-mono text-[11px] text-slate-400">
                        {dayGroup.items.length} task{dayGroup.items.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {dayGroup.items.length > 0 ? (
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {dayGroup.items.map((it) => {
                          if (it.type !== 'task') return null
                          return (
                            <TaskRow
                              key={it.task.id}
                              task={it.task}
                              isSelected={false}
                              subtitle={it.project.title}
                              onSelect={() => {}}
                              onOpenDetails={() => {}}
                              onToggleDone={async () => {
                                await toggleTaskAction({ id: it.task.id, done: true })
                                loadData()
                              }}
                              onOpenDueDate={() => setDueDateTaskId(it.task.id)}
                              onToggleFocus={async () => {
                                await updateTaskAction({
                                  id: it.task.id,
                                  patch: { focusDate: it.task.focusDate ? null : today },
                                })
                                loadData()
                              }}
                            />
                          )
                        })}
                      </div>
                    ) : (
                      <div className="p-3 text-center text-xs text-slate-400">
                        No tasks scheduled.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              renderEmpty()
            )}
          </div>
        )}
      </div>

      {/* Due Date Popover */}
      {dueDateTaskId && (
        <DueDatePopover
          isOpen={!!dueDateTaskId}
          currentDueDate={null}
          onClose={() => setDueDateTaskId(null)}
          onSaveDueDate={async (newDueDate) => {
            if (!dueDateTaskId) return
            await updateTaskAction({ id: dueDateTaskId, patch: { dueDate: newDueDate } })
            setTasksScheduledCount((prev) => prev + 1)
            setDueDateTaskId(null)
            loadData()
          }}
        />
      )}

      {/* Quick Add Modal */}
      {isQuickAddOpen && currentProjectCard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Add Next Step for {currentProjectCard.project.title}
            </h3>
            <TaskQuickAdd
              projectId={currentProjectCard.project.id}
              milestones={[]}
              isOpen={isQuickAddOpen}
              onClose={() => setIsQuickAddOpen(false)}
              onCreateTask={async (params) => {
                const res = await createTaskAction({
                  projectId: currentProjectCard.project.id,
                  title: params.title,
                  milestoneId: params.milestoneId || undefined,
                  dueDate: params.dueDate || undefined,
                  focusDate: params.focusDate || undefined,
                })
                if (res.ok) {
                  showToast?.('Next step added', 'success')
                  setIsQuickAddOpen(false)
                  const detailRes = await fetchProjectAction({
                    id: currentProjectCard.project.id,
                    today,
                  })
                  if (detailRes.ok) setCurrentProjectDetailTasks(detailRes.data.tasks)
                  loadData()
                } else {
                  showToast?.(res.error.message || 'Failed to create task', 'error')
                }
              }}
            />
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

      {/* Footer shortcut helper */}
      <div className="h-9 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center text-[11px] text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-900/50">
        <span>[ / ] prev/next · 1/2/3 health · W waiting · T add task · ⇧N nudge · $ mark paid · ⇧↵ finish</span>
      </div>
    </div>
  )
}
