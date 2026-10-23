'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  FolderKanban,
  AlertCircle,
  RotateCcw,
  RefreshCw,
  Plus,
} from 'lucide-react'
import type { ProjectDetail } from '@/lib/projects/types'
import type { Task, Milestone, Invoice, Project } from '@/lib/projects/types'
import {
  fetchProjectAction,
  createTaskAction,
  updateTaskAction,
  moveTaskAction,
  createMilestoneAction,
  updateMilestoneAction,
  deleteMilestoneAction,
  createInvoiceAction,
  updateInvoiceAction,
  deleteInvoiceAction,
  closeProjectAction,
  reopenProjectAction,
  logFeedbackAction,
} from '@/app/actions/projects'
import { localToday } from '@/lib/projects/dates'
import { ProjectHeader } from '@/components/projects/project-header'
import { TaskList } from '@/components/projects/task-list'
import { MilestonesRail } from '@/components/projects/milestones-rail'
import { TaskDetailPanel } from '@/components/projects/task-detail-panel'
import { DueDatePopover } from '@/components/projects/due-date-popover'
import { InvoiceSheet } from '@/components/projects/invoice-sheet'
import { FeedbackModal } from '@/components/projects/feedback-modal'
import { CloseProjectDialog } from '@/components/projects/close-project-dialog'
import { ProjectSheet } from '@/components/projects/project-sheet'
import { BriefEditor } from '@/components/projects/brief-editor'
import { MilestoneModal } from '@/components/projects/milestone-modal'
import { useProjectMutations } from '@/components/projects/use-project-mutations'
import { ToastHUD } from '@/components/ui/toast-hud'
import {
  useShortcutContext,
  useShortcut,
  useShortcuts,
} from '@/components/shortcuts/shortcut-provider'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

export default function ProjectWorkspacePage() {
  const params = useParams()
  const router = useRouter()
  const projectId = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)

  const [detail, setDetail] = useState<ProjectDetail | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // Focus & Context state: 'list' or 'rail'
  const [focusedArea, setFocusedArea] = useState<'list' | 'rail'>('list')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  // Responsive active tab for tablet / mobile (Tasks vs Milestones)
  const [activeTab, setActiveTab] = useState<'tasks' | 'rail'>('tasks')

  // Modals and Panels
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false)
  const [isDueDatePopoverOpen, setIsDueDatePopoverOpen] = useState(false)
  const [isInvoiceSheetOpen, setIsInvoiceSheetOpen] = useState(false)
  const [invoiceToEdit, setInvoiceToEdit] = useState<Invoice | null>(null)
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState(false)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)
  const [isProjectEditOpen, setIsProjectEditOpen] = useState(false)
  const [isBriefEditorOpen, setIsBriefEditorOpen] = useState(false)
  const [isMilestoneModalOpen, setIsMilestoneModalOpen] = useState(false)
  const [milestoneToEdit, setMilestoneToEdit] = useState<Milestone | null>(null)

  // Set shortcut context: 'projectRail' when rail is focused, otherwise 'projectList'
  useShortcutContext(focusedArea === 'rail' ? 'projectRail' : 'projectList')

  // Esc when rail is focused returns focus to list
  useEscapeLayer(() => {
    setFocusedArea('list')
  }, focusedArea === 'rail')

  // Shortcut to focus rail: G R
  useShortcut('project.focusRail', () => {
    setFocusedArea('rail')
    setActiveTab('rail')
  })

  // Mutations hook
  const {
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
  } = useProjectMutations({
    detail,
    setDetail,
    onOpenCloseDialog: () => setIsCloseDialogOpen(true),
    onOpenInvoiceSheet: (inv) => {
      setInvoiceToEdit(inv || null)
      setIsInvoiceSheetOpen(true)
    },
    onOpenFeedbackModal: () => setIsFeedbackModalOpen(true),
    onOpenProjectEdit: () => setIsProjectEditOpen(true),
  })

  // Load project data
  const loadProject = useCallback(async () => {
    if (!projectId) return
    setIsLoading(true)
    setNotFound(false)
    setLoadError(false)

    try {
      const res = await fetchProjectAction({ id: projectId, today: localToday() })
      if (res.ok && res.data) {
        setDetail(res.data)
        // Select first open task by default
        const openTasks = res.data.tasks.filter((t) => !t.completedAt)
        if (openTasks.length > 0) {
          setSelectedTaskId(openTasks[0].id)
        } else if (res.data.tasks.length > 0) {
          setSelectedTaskId(res.data.tasks[0].id)
        }
      } else if (!res.ok) {
        if (res.error.code === 'NOT_FOUND') {
          setNotFound(true)
        } else {
          setLoadError(true)
        }
      }
    } catch {
      setLoadError(true)
    } finally {
      setIsLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadProject()
  }, [loadProject])

  const isClosed = useMemo(() => {
    if (!detail) return false
    const currStage = detail.stages.find((s) => s.id === detail.project.stageId)
    return currStage?.category === 'closed'
  }, [detail])

  const selectedTask = useMemo(() => {
    if (!detail || !selectedTaskId) return null
    return detail.tasks.find((t) => t.id === selectedTaskId) || null
  }, [detail, selectedTaskId])

  const handleReadOnlyAttempt = () => {
    addToast('Reopen the project to edit', { type: 'warning' })
  }

  // Task operations
  const handleCreateTask = async (params: {
    title: string
    milestoneId: string | null
    dueDate: string | null
    focusDate: string | null
    afterTaskId: string | null
  }) => {
    if (!detail) return
    const res = await createTaskAction({
      projectId: detail.project.id,
      title: params.title,
      milestoneId: params.milestoneId,
      dueDate: params.dueDate,
      focusDate: params.focusDate,
      afterTaskId: params.afterTaskId,
    })
    if (res.ok && res.data) {
      reloadProject()
      setSelectedTaskId(res.data.id)
      addToast('Task created')
      return true
    } else if (!res.ok) {
      addToast(res.error.message, { type: 'warning' })
      return false
    }
  }

  const handleSaveTaskTitle = async (taskId: string, newTitle: string) => {
    const res = await updateTaskAction({ id: taskId, patch: { title: newTitle } })
    if (res.ok) {
      reloadProject()
    } else {
      addToast(res.error.message, { type: 'warning' })
    }
  }

  const handleMoveTaskOrder = async (task: Task, direction: 'up' | 'down') => {
    if (!detail) return
    const tasks = detail.tasks
    const idx = tasks.findIndex((t) => t.id === task.id)
    if (idx === -1) return

    if (direction === 'up' && idx > 0) {
      const beforeId = idx > 1 ? tasks[idx - 2].id : null
      const afterId = tasks[idx - 1].id
      await moveTaskAction({ id: task.id, beforeId, afterId })
      reloadProject()
    } else if (direction === 'down' && idx < tasks.length - 1) {
      const beforeId = tasks[idx + 1].id
      const afterId = idx < tasks.length - 2 ? tasks[idx + 2].id : null
      await moveTaskAction({ id: task.id, beforeId, afterId })
      reloadProject()
    }
  }

  // Milestone operations
  const handleSaveMilestone = async (params: {
    id?: string
    title: string
    dueDate: string | null
    amountMinor: number | null
  }) => {
    if (!detail) return
    if (params.id) {
      const res = await updateMilestoneAction({
        id: params.id,
        patch: {
          title: params.title,
          dueDate: params.dueDate,
          amountMinor: params.amountMinor,
        },
      })
      if (res.ok) {
        reloadProject()
        addToast('Milestone updated')
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    } else {
      const res = await createMilestoneAction({
        projectId: detail.project.id,
        title: params.title,
        dueDate: params.dueDate,
        amountMinor: params.amountMinor,
        today: localToday(),
      })
      if (res.ok) {
        reloadProject()
        addToast('Milestone created')
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    }
  }

  // Invoice operations
  const handleSaveInvoice = async (params: any) => {
    if (!detail) return
    if (params.id) {
      const res = await updateInvoiceAction({
        id: params.id,
        patch: params,
      })
      if (res.ok) {
        reloadProject()
        addToast('Invoice updated')
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    } else {
      const res = await createInvoiceAction({
        projectId: detail.project.id,
        today: localToday(),
        ...params,
      })
      if (res.ok) {
        reloadProject()
        addToast('Invoice created')
      } else {
        addToast(res.error.message, { type: 'warning' })
      }
    }
  }

  // Feedback logging
  const handleLogFeedback = async (params: any) => {
    if (!detail) return
    const res = await logFeedbackAction({
      projectId: detail.project.id,
      ...params,
    })
    if (res.ok && res.data) {
      reloadProject()
      addToast(`Logged feedback and created ${res.data.tasks.length} tasks`)
      if (res.suggestions && res.suggestions.length > 0) {
        // Suggestion toast handled
        addToast('Feedback logged. Back to Active?', {
          shortcut: 'Y',
          durationMs: 8000,
          action: {
            label: 'Move to Active',
            kind: 'accept',
            onRun: async () => {
              const firstActive = detail.stages.find((s) => s.category === 'active')
              if (firstActive) {
                await moveStage(firstActive.id)
              }
            },
          },
        })
      }
    } else if (!res.ok) {
      addToast(res.error.message, { type: 'warning' })
    }
  }

  // Close project
  const handleCloseProject = async (input: any) => {
    const res = await closeProjectAction(input)
    if (res.ok) {
      reloadProject()
      addToast('Project closed')
    } else {
      addToast(res.error.message, { type: 'warning' })
    }
  }

  // Reopen project
  const handleReopenProject = async () => {
    if (!detail) return
    const res = await reopenProjectAction({ id: detail.project.id })
    if (res.ok) {
      reloadProject()
      addToast('Project reopened')
    } else {
      addToast(res.error.message, { type: 'warning' })
    }
  }

  // 1. Loading State
  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0d0e] p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto animate-pulse">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-28 bg-white dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-800" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8 space-y-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="h-10 bg-white dark:bg-slate-800/40 rounded-lg border border-slate-200 dark:border-slate-800/80"
              />
            ))}
          </div>
          <div className="lg:col-span-4 h-96 bg-white dark:bg-slate-800/40 rounded-xl border border-slate-200 dark:border-slate-800" />
        </div>
      </div>
    )
  }

  // 2. Not Found State
  if (notFound || !detail) {
    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0d0e] flex flex-col items-center justify-center p-4 text-center">
        <div className="p-4 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 mb-3">
          <FolderKanban size={32} />
        </div>
        <h1 className="text-base font-bold text-slate-800 dark:text-slate-200">
          This project doesn&apos;t exist or was deleted.
        </h1>
        <p className="text-xs text-slate-500 mt-1 mb-4">
          The link might be broken or the project was removed.
        </p>
        <Link
          href="/?view=projects"
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-500 transition-colors shadow-sm"
        >
          <span>Go to Projects</span>
          <kbd className="px-1 text-[9px] font-mono bg-blue-700 rounded">G J</kbd>
        </Link>
      </div>
    )
  }

  // 3. Load Error State
  if (loadError) {
    return (
      <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0d0e] flex flex-col items-center justify-center p-4 text-center">
        <AlertCircle size={32} className="text-red-500 mb-2" />
        <h1 className="text-base font-bold text-slate-800 dark:text-slate-200">
          Couldn&apos;t load this project.
        </h1>
        <button
          type="button"
          onClick={loadProject}
          className="mt-3 inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 transition-colors cursor-pointer"
        >
          <RefreshCw size={12} />
          <span>Retry</span>
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#fafaf9] dark:bg-[#0c0d0e] text-slate-900 dark:text-slate-100 flex flex-col">
      {/* Toast HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Project Header */}
        <ProjectHeader
          detail={detail}
          onMoveStage={moveStage}
          onToggleWaiting={toggleWaiting}
          onOpenFeedback={() => setIsFeedbackModalOpen(true)}
          onOpenCloseDialog={() => setIsCloseDialogOpen(true)}
          onOpenEdit={() => setIsProjectEditOpen(true)}
          onReopen={handleReopenProject}
        />

        {/* Tablet Tab Switcher (768 - 1199 px) */}
        <div className="flex lg:hidden items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-xs font-semibold">
          <button
            type="button"
            onClick={() => {
              setActiveTab('tasks')
              setFocusedArea('list')
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'tasks'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Tasks ({detail.tasks.filter((t) => !t.completedAt).length})
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('rail')
              setFocusedArea('rail')
            }}
            className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'rail'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200 dark:border-slate-700'
                : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Milestones &amp; Money
          </button>
        </div>

        {/* Workspace Columns */}
        <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Tasks Column */}
          <div
            className={`lg:col-span-8 p-4 rounded-xl bg-white dark:bg-slate-850/60 border border-slate-200 dark:border-slate-700/80 shadow-sm ${
              activeTab === 'rail' ? 'hidden lg:block' : 'block'
            }`}
            onClick={() => setFocusedArea('list')}
          >
            <TaskList
              tasks={detail.tasks}
              milestones={detail.milestones}
              selectedTaskId={selectedTaskId}
              isReadOnly={isClosed}
              onSelectTaskId={(id) => {
                setSelectedTaskId(id)
                setFocusedArea('list')
              }}
              onToggleDone={toggleTask}
              onSaveTaskTitle={handleSaveTaskTitle}
              onCreateTask={handleCreateTask}
              onOpenDetails={(t) => {
                setSelectedTaskId(t.id)
                setIsDetailPanelOpen(true)
              }}
              onOpenDueDate={(t) => {
                setSelectedTaskId(t.id)
                setIsDueDatePopoverOpen(true)
              }}
              onClearDueDate={(t) => {
                updateTaskAction({ id: t.id, patch: { dueDate: null } }).then((res) => {
                  if (res.ok) reloadProject()
                })
              }}
              onToggleFocus={(t) => {
                const newFocus = t.focusDate ? null : localToday()
                updateTaskAction({ id: t.id, patch: { focusDate: newFocus } }).then((res) => {
                  if (res.ok) reloadProject()
                })
              }}
              onOpenMoveMilestone={(t) => {
                setSelectedTaskId(t.id)
                setIsDetailPanelOpen(true)
              }}
              onMoveUp={(t) => handleMoveTaskOrder(t, 'up')}
              onMoveDown={(t) => handleMoveTaskOrder(t, 'down')}
              onDeleteTask={deleteTask}
              onReadOnlyAttempt={handleReadOnlyAttempt}
            />
          </div>

          {/* Milestones & Money Rail Column */}
          <div
            className={`lg:col-span-4 ${
              activeTab === 'tasks' ? 'hidden lg:block' : 'block'
            }`}
          >
            <MilestonesRail
              project={detail.project}
              milestones={detail.milestones}
              invoices={detail.invoices}
              money={detail.money}
              activities={detail.activities}
              isRailFocused={focusedArea === 'rail'}
              isReadOnly={isClosed}
              onFocusRail={() => setFocusedArea('rail')}
              onOpenInvoiceSheet={(inv) => {
                setInvoiceToEdit(inv || null)
                setIsInvoiceSheetOpen(true)
              }}
              onOpenNewMilestone={() => {
                setMilestoneToEdit(null)
                setIsMilestoneModalOpen(true)
              }}
              onOpenBrief={() => setIsBriefEditorOpen(true)}
              onSetMilestoneStatus={setMilestoneStatus}
              onSetInvoiceStatus={setInvoiceStatus}
              onDeleteMilestone={async (id) => {
                const res = await deleteMilestoneAction({ id })
                if (res.ok) reloadProject()
              }}
              onDeleteInvoice={async (id) => {
                const res = await deleteInvoiceAction({ id })
                if (res.ok) reloadProject()
              }}
              onEditMilestone={(m) => {
                setMilestoneToEdit(m)
                setIsMilestoneModalOpen(true)
              }}
            />
          </div>

          {/* Task Detail Panel (Slides over rail) */}
          <TaskDetailPanel
            task={selectedTask}
            milestones={detail.milestones}
            isOpen={isDetailPanelOpen}
            isReadOnly={isClosed}
            onClose={() => setIsDetailPanelOpen(false)}
            onUpdateTask={(patch) => {
              if (selectedTask) {
                updateTaskAction({ id: selectedTask.id, patch }).then((res) => {
                  if (res.ok) reloadProject()
                })
              }
            }}
            onDeleteTask={(t) => {
              deleteTask(t)
              setIsDetailPanelOpen(false)
            }}
          />
        </div>

        {/* Due Date Popover */}
        <DueDatePopover
          currentDueDate={selectedTask?.dueDate || null}
          isOpen={isDueDatePopoverOpen}
          onClose={() => setIsDueDatePopoverOpen(false)}
          onSaveDueDate={(dueDate) => {
            if (selectedTask) {
              updateTaskAction({ id: selectedTask.id, patch: { dueDate } }).then((res) => {
                if (res.ok) reloadProject()
              })
            }
          }}
        />

        {/* Invoice Sheet */}
        <InvoiceSheet
          project={detail.project}
          milestones={detail.milestones}
          invoiceToEdit={invoiceToEdit}
          isOpen={isInvoiceSheetOpen}
          onClose={() => {
            setIsInvoiceSheetOpen(false)
            setInvoiceToEdit(null)
          }}
          onSave={handleSaveInvoice}
          onDelete={async (id) => {
            const res = await deleteInvoiceAction({ id })
            if (res.ok) reloadProject()
          }}
        />

        {/* Milestone Modal */}
        <MilestoneModal
          milestoneToEdit={milestoneToEdit}
          currency={detail.project.currency}
          isOpen={isMilestoneModalOpen}
          onClose={() => {
            setIsMilestoneModalOpen(false)
            setMilestoneToEdit(null)
          }}
          onSave={handleSaveMilestone}
        />

        {/* Feedback Modal */}
        <FeedbackModal
          project={detail.project}
          milestones={detail.milestones}
          tasks={detail.tasks}
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          onSubmitFeedback={handleLogFeedback}
        />

        {/* Close Project Dialog */}
        <CloseProjectDialog
          project={detail.project}
          invoices={detail.invoices}
          openTasksCount={detail.tasks.filter((t) => !t.completedAt).length}
          isOpen={isCloseDialogOpen}
          onClose={() => setIsCloseDialogOpen(false)}
          onCloseProject={handleCloseProject}
        />

        {/* Project Edit Sheet */}
        <ProjectSheet
          projectToEdit={detail.project}
          isOpen={isProjectEditOpen}
          onClose={() => setIsProjectEditOpen(false)}
          onProjectUpdated={() => reloadProject()}
          onProjectDeleted={() => router.push('/?view=projects')}
        />

        {/* Brief Editor */}
        <BriefEditor
          projectId={detail.project.id}
          projectTitle={detail.project.title}
          company={detail.project.company}
          brief={detail.project.brief || ''}
          isOpen={isBriefEditorOpen}
          isReadOnly={isClosed}
          onClose={() => setIsBriefEditorOpen(false)}
          onBriefUpdated={(brief) => {
            setDetail((prev) =>
              prev ? { ...prev, project: { ...prev.project, brief } } : null
            )
          }}
          onToast={(msg) => addToast(msg)}
        />
      </main>

      {/* Cheatsheet Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 px-4 py-2 text-[11px] text-slate-500 dark:text-slate-400">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 overflow-x-auto">
          <div className="flex items-center gap-3 shrink-0">
            <span><kbd className="font-mono">J/K</kbd> move</span>
            <span>·</span>
            <span><kbd className="font-mono">X</kbd> done</span>
            <span>·</span>
            <span><kbd className="font-mono">E</kbd> rename</span>
            <span>·</span>
            <span><kbd className="font-mono">D</kbd> date</span>
            <span>·</span>
            <span><kbd className="font-mono">M</kbd> milestone</span>
            <span>·</span>
            <span><kbd className="font-mono">⌥↑↓</kbd> reorder</span>
            <span>·</span>
            <span><kbd className="font-mono">⌫</kbd> delete</span>
            <span>·</span>
            <span><kbd className="font-mono">↵</kbd> details</span>
          </div>
          <div className="hidden md:flex items-center gap-3 shrink-0 text-slate-400">
            <span><kbd className="font-mono">G R</kbd> rail</span>
            <span>·</span>
            <span><kbd className="font-mono">?</kbd> shortcuts</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
