'use client'

import { useState, useCallback, useRef } from 'react'
import type { ProjectDetail } from '@/lib/projects/types'
import type { Task, Milestone, Invoice, Project } from '@/lib/projects/types'
import type { Suggestion } from '@/lib/projects/suggestions'
import type { ToastHUDItem } from '@/components/ui/toast-hud'
import {
  toggleTaskAction,
  createTaskAction,
  updateTaskAction,
  moveTaskAction,
  deleteTaskAction,
  restoreTaskAction,
  createMilestoneAction,
  updateMilestoneAction,
  setMilestoneStatusAction,
  deleteMilestoneAction,
  createInvoiceAction,
  updateInvoiceAction,
  setInvoiceStatusAction,
  deleteInvoiceAction,
  updateProjectAction,
  moveProjectStageAction,
  toggleProjectWaitingAction,
  closeProjectAction,
  reopenProjectAction,
  archiveProjectAction,
  syncBriefAction,
  logFeedbackAction,
  fetchProjectAction,
} from '@/app/actions/projects'
import {
  suggestionToToast,
  applyOptimisticToggle,
  rollbackToggle,
  SuggestionCallbacks,
} from '@/lib/projects/ui-helpers'
import { localToday } from '@/lib/projects/dates'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'

export interface UseProjectMutationsOptions {
  detail: ProjectDetail | null
  setDetail: React.Dispatch<React.SetStateAction<ProjectDetail | null>>
  onOpenCloseDialog?: () => void
  onOpenInvoiceSheet?: (invoice?: Invoice) => void
  onOpenFeedbackModal?: () => void
  onOpenProjectEdit?: () => void
}

export function useProjectMutations({
  detail,
  setDetail,
  onOpenCloseDialog,
  onOpenInvoiceSheet,
  onOpenFeedbackModal,
  onOpenProjectEdit,
}: UseProjectMutationsOptions) {
  const [toasts, setToasts] = useState<ToastHUDItem[]>([])
  const toastCounterRef = useRef(0)

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const addToast = useCallback(
    (
      message: string,
      options?: {
        shortcut?: string
        type?: 'success' | 'warning'
        action?: { label: string; onRun: () => void; kind: 'accept' | 'undo' }
        durationMs?: number
      }
    ) => {
      toastCounterRef.current += 1
      const id = `toast-${Date.now()}-${toastCounterRef.current}`
      const newToast: ToastHUDItem = {
        id,
        message,
        shortcut: options?.shortcut,
        type: options?.type || 'success',
        action: options?.action,
        durationMs: options?.durationMs ?? 2500,
      }
      setToasts((prev) => [...prev.slice(-3), newToast])
      return id
    },
    []
  )

  const onAcceptToast = useCallback(() => {
    const matching = [...toasts].reverse().find((t) => t.action?.kind === 'accept')
    if (matching?.action) {
      matching.action.onRun()
      dismissToast(matching.id)
    }
  }, [toasts, dismissToast])

  const onUndoToast = useCallback(() => {
    const matching = [...toasts].reverse().find((t) => t.action?.kind === 'undo')
    if (matching?.action) {
      matching.action.onRun()
      dismissToast(matching.id)
    }
  }, [toasts, dismissToast])

  useShortcut('toast.accept', onAcceptToast)
  useShortcut('toast.undo', onUndoToast)

  const reloadProject = useCallback(async () => {
    if (!detail) return
    const res = await fetchProjectAction({ id: detail.project.id, today: localToday() })
    if (res.ok && res.data) {
      setDetail(res.data)
    }
  }, [detail, setDetail])

  const handleSuggestion = useCallback(
    (suggestion?: Suggestion) => {
      if (!suggestion || !detail) return

      const callbacks: SuggestionCallbacks = {
        onKickOff: async (projId) => {
          const firstActive = detail.stages.find((s) => s.category === 'active')
          if (firstActive) {
            const res = await moveProjectStageAction({
              id: projId,
              stageId: firstActive.id,
              today: localToday(),
            })
            if (res.ok) {
              reloadProject()
              addToast('Project kicked off!')
            } else {
              addToast(res.error.message, { type: 'warning' })
            }
          }
        },
        onMoveToReview: async (projId) => {
          const firstReview = detail.stages.find((s) => s.category === 'review')
          if (firstReview) {
            const res = await moveProjectStageAction({
              id: projId,
              stageId: firstReview.id,
              today: localToday(),
            })
            if (res.ok) {
              reloadProject()
              addToast('Moved to In Review')
            } else {
              addToast(res.error.message, { type: 'warning' })
            }
          }
        },
        onBackToActive: async (projId) => {
          const firstActive = detail.stages.find((s) => s.category === 'active')
          if (firstActive) {
            const res = await moveProjectStageAction({
              id: projId,
              stageId: firstActive.id,
              today: localToday(),
            })
            if (res.ok) {
              reloadProject()
              addToast('Moved back to Active')
            } else {
              addToast(res.error.message, { type: 'warning' })
            }
          }
        },
        onCreateInvoice: async (projId, milestoneId, amountMinor) => {
          const milestone = detail.milestones.find((m) => m.id === milestoneId)
          const res = await createInvoiceAction({
            projectId: projId,
            milestoneId,
            label: milestone?.title || 'Milestone invoice',
            amountMinor,
            status: 'draft',
            today: localToday(),
          })
          if (res.ok) {
            reloadProject()
            addToast('Draft invoice created')
          } else {
            addToast(res.error.message, { type: 'warning' })
          }
        },
        onBillHours: (_projId, milestoneId) => {
          const m = detail.milestones.find((ms) => ms.id === milestoneId)
          onOpenInvoiceSheet?.(m ? ({ milestoneId: m.id } as Invoice) : undefined)
        },
        onMarkDelivered: async (projId) => {
          const firstDelivered = detail.stages.find((s) => s.category === 'delivered')
          if (firstDelivered) {
            const res = await moveProjectStageAction({
              id: projId,
              stageId: firstDelivered.id,
              today: localToday(),
            })
            if (res.ok) {
              reloadProject()
              addToast('Project marked Delivered')
            } else {
              addToast(res.error.message, { type: 'warning' })
            }
          }
        },
        onCloseProject: () => {
          onOpenCloseDialog?.()
        },
      }

      const toastResult = suggestionToToast(suggestion, callbacks)
      addToast(toastResult.message, {
        shortcut: toastResult.shortcut,
        durationMs: toastResult.durationMs,
        action: toastResult.action,
      })
    },
    [detail, reloadProject, addToast, onOpenCloseDialog, onOpenInvoiceSheet]
  )

  // Toggle task completed with optimistic rollback
  const toggleTask = useCallback(
    async (task: Task) => {
      if (!detail) return
      const isDone = !task.completedAt

      // Optimistic update
      const { updatedTasks, previousTask } = applyOptimisticToggle(detail.tasks, task.id, isDone)
      setDetail((prev) => (prev ? { ...prev, tasks: updatedTasks } : null))

      const res = await toggleTaskAction({ id: task.id, done: isDone })
      if (!res.ok) {
        // Rollback
        if (previousTask) {
          setDetail((prev) =>
            prev ? { ...prev, tasks: rollbackToggle(prev.tasks, previousTask) } : null
          )
        }
        addToast(res.error.message, { type: 'warning' })
      } else {
        addToast(isDone ? 'Task completed' : 'Task reopened', {
          shortcut: 'Z',
          durationMs: 8000,
          action: {
            label: 'Undo',
            kind: 'undo',
            onRun: async () => {
              await toggleTask(res.data)
            },
          },
        })
      }
    },
    [detail, setDetail, addToast]
  )

  // Delete task with undo
  const deleteTask = useCallback(
    async (task: Task) => {
      if (!detail) return
      const prevTasks = detail.tasks
      setDetail((prev) =>
        prev ? { ...prev, tasks: prev.tasks.filter((t) => t.id !== task.id) } : null
      )

      const res = await deleteTaskAction({ id: task.id })
      if (!res.ok) {
        setDetail((prev) => (prev ? { ...prev, tasks: prevTasks } : null))
        addToast(res.error.message, { type: 'warning' })
      } else {
        addToast('Task deleted', {
          shortcut: 'Z',
          durationMs: 8000,
          action: {
            label: 'Undo',
            kind: 'undo',
            onRun: async () => {
              const restoreRes = await restoreTaskAction({ task })
              if (restoreRes.ok) {
                reloadProject()
              } else {
                addToast(restoreRes.error.message, { type: 'warning' })
              }
            },
          },
        })
      }
    },
    [detail, setDetail, addToast, reloadProject]
  )

  // Set milestone status
  const setMilestoneStatus = useCallback(
    async (id: string, status: 'open' | 'delivered' | 'approved') => {
      const res = await setMilestoneStatusAction({ id, status })
      if (res.ok) {
        reloadProject()
        if (res.suggestions && res.suggestions.length > 0) {
          handleSuggestion(res.suggestions[0])
        }
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    },
    [reloadProject, handleSuggestion, addToast]
  )

  // Set invoice status
  const setInvoiceStatus = useCallback(
    async (id: string, status: 'draft' | 'sent' | 'paid' | 'void') => {
      const currentInvoice = detail?.invoices.find((i) => i.id === id)
      const res = await setInvoiceStatusAction({
        id,
        status,
        today: localToday(),
      })
      if (res.ok) {
        reloadProject()
        if (res.suggestions && res.suggestions.length > 0) {
          handleSuggestion(res.suggestions[0])
        }
        if (currentInvoice) {
          const revertStatus =
            status === 'paid' ? 'sent' : status === 'sent' || status === 'void' ? 'draft' : null
          if (revertStatus) {
            addToast(`Invoice marked ${status}`, {
              shortcut: 'Z',
              durationMs: 8000,
              action: {
                label: 'Undo',
                kind: 'undo',
                onRun: async () => {
                  await setInvoiceStatus(id, revertStatus)
                },
              },
            })
          }
        }
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    },
    [detail, reloadProject, handleSuggestion, addToast]
  )

  // Stage change
  const moveStage = useCallback(
    async (stageId: string) => {
      if (!detail) return
      const res = await moveProjectStageAction({
        id: detail.project.id,
        stageId,
        today: localToday(),
      })
      if (res.ok) {
        reloadProject()
        addToast('Stage updated')
      } else {
        if (res.error.code === 'USE_CLOSE_PROJECT') {
          onOpenCloseDialog?.()
        } else if (res.error.code === 'USE_REOPEN_PROJECT') {
          const reopenRes = await reopenProjectAction({ id: detail.project.id })
          if (reopenRes.ok) {
            reloadProject()
            addToast('Project reopened')
          } else {
            addToast(reopenRes.error.message, { type: 'warning' })
          }
        } else {
          addToast(res.error.message, { type: 'warning' })
        }
      }
    },
    [detail, reloadProject, addToast, onOpenCloseDialog]
  )

  // Toggle waiting on client
  const toggleWaiting = useCallback(async () => {
    if (!detail) return
    const res = await toggleProjectWaitingAction({
      id: detail.project.id,
      today: localToday(),
    })
    if (res.ok) {
      reloadProject()
      addToast(
        res.data.waitingSinceDate
          ? 'Marked as waiting on client'
          : 'Cleared waiting status'
      )
    } else {
      addToast(res.error.message, { type: 'warning' })
    }
  }, [detail, reloadProject, addToast])

  // Archive project
  const archiveProject = useCallback(
    async (archived: boolean) => {
      if (!detail) return
      const res = await archiveProjectAction({
        id: detail.project.id,
        archived,
      })
      if (res.ok) {
        reloadProject()
        if (archived) {
          addToast('Project archived', {
            shortcut: 'Z',
            durationMs: 8000,
            action: {
              label: 'Undo',
              kind: 'undo',
              onRun: async () => {
                await archiveProject(false)
              },
            },
          })
        } else {
          addToast('Project unarchived')
        }
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    },
    [detail, reloadProject, addToast]
  )

  return {
    toasts,
    dismissToast,
    addToast,
    reloadProject,
    toggleTask,
    deleteTask,
    setMilestoneStatus,
    setInvoiceStatus,
    moveStage,
    toggleWaiting,
    archiveProject,
    handleSuggestion,
  }
}
