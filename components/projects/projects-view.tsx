'use client'

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Kanban,
  List as ListIcon,
  Search,
  Plus,
  Archive,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  ChevronRight,
  Calendar,
  X,
} from 'lucide-react'
import { useShortcutContext, useShortcut } from '@/components/shortcuts/shortcut-provider'
import { useBoardKeyboard, BoardColumn } from '@/components/shared/use-board-keyboard'
import { ProjectCardView } from '@/components/projects/project-board-card'
import { CloseProjectDialog } from '@/components/projects/close-project-dialog'
import { localToday, formatRelativeDate } from '@/lib/projects/dates'
import { formatMinor } from '@/lib/projects/money'
import { OPERATOR_CONFIG } from '@/lib/config'
import type {
  ProjectStage,
  ProjectCard,
  ProjectDetail,
} from '@/lib/projects/types'
import {
  fetchProjectConfigAction,
  fetchProjectsAction,
  fetchProjectAction,
  moveProjectStageAction,
  closeProjectAction,
  reopenProjectAction,
} from '@/app/actions/projects'

interface ProjectsViewProps {
  onStartProject?: () => void
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function ProjectsView({ onStartProject, showToast }: ProjectsViewProps) {
  // Push board context
  useShortcutContext('board')
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialLayout = searchParams.get('layout') === 'list' ? 'list' : 'board'
  const initialArchived = searchParams.get('archived') === '1'

  const [layout, setLayout] = useState<'board' | 'list'>(initialLayout)
  const [showArchived, setShowArchived] = useState(initialArchived)
  const [filterQuery, setFilterQuery] = useState('')
  const [filterBilling, setFilterBilling] = useState<string>('all')

  const [stages, setStages] = useState<ProjectStage[]>([])
  const [projects, setProjects] = useState<ProjectCard[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)

  // Close project dialog state
  const [closingProjectDetail, setClosingProjectDetail] = useState<ProjectDetail | null>(null)
  const [isCloseDialogOpen, setIsCloseDialogOpen] = useState(false)

  const filterInputRef = useRef<HTMLInputElement>(null)
  const today = localToday()

  // Load stages & projects
  const loadData = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [configRes, projectsRes] = await Promise.all([
        fetchProjectConfigAction(),
        fetchProjectsAction({ includeArchived: showArchived, today: localToday() }),
      ])

      if (configRes.ok) {
        // Sort stages by category order and position
        const catOrder: Record<string, number> = {
          planned: 1,
          active: 2,
          review: 3,
          delivered: 4,
          closed: 5,
        }
        const sortedStages = [...configRes.data.stages].sort((a, b) => {
          const cDiff = (catOrder[a.category] || 99) - (catOrder[b.category] || 99)
          if (cDiff !== 0) return cDiff
          return a.position - b.position
        })
        setStages(sortedStages)
        if (!selectedColumnId && sortedStages.length > 0) {
          setSelectedColumnId(sortedStages[0].id)
        }
      }

      if (projectsRes.ok) {
        setProjects(projectsRes.data)
      } else {
        setError(projectsRes.error.message)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load projects')
    } finally {
      setIsLoading(false)
    }
  }, [showArchived, selectedColumnId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Filter projects
  const filteredProjects = useMemo(() => {
    return projects.filter((card) => {
      if (filterBilling !== 'all' && card.project.billingType !== filterBilling) {
        return false
      }
      if (filterQuery.trim()) {
        const q = filterQuery.toLowerCase().trim()
        const titleMatch = card.project.title.toLowerCase().includes(q)
        const clientMatch = card.project.company.toLowerCase().includes(q)
        const contactMatch = card.project.contactName ? card.project.contactName.toLowerCase().includes(q) : false
        if (!titleMatch && !clientMatch && !contactMatch) return false
      }
      return true
    })
  }, [projects, filterQuery, filterBilling])

  // Group into columns
  const columns = useMemo<BoardColumn<ProjectCard>[]>(() => {
    return stages.map((stage) => {
      const stageProjects = filteredProjects.filter((p) => p.project.stageId === stage.id)
      return {
        id: stage.id,
        name: stage.name,
        items: stageProjects,
      }
    })
  }, [stages, filteredProjects])

  // Stage transition helper
  const handleMoveStage = useCallback(
    async (card: ProjectCard, targetStage: ProjectStage) => {
      if (card.project.stageId === targetStage.id) return

      // If target is closed, open close dialog
      if (targetStage.category === 'closed') {
        const detailRes = await fetchProjectAction({ id: card.project.id, today })
        if (detailRes.ok) {
          setClosingProjectDetail(detailRes.data)
          setIsCloseDialogOpen(true)
        }
        return
      }

      // If current is closed, call reopen
      if (card.stage.category === 'closed') {
        const res = await reopenProjectAction({
          id: card.project.id,
        })
        if (res.ok) {
          showToast?.(`Reopened ${card.project.title}`, 'success')
          loadData()
        } else {
          showToast?.(res.error.message || 'Failed to reopen project', 'error')
        }
        return
      }

      // Otherwise normal move
      const res = await moveProjectStageAction({
        id: card.project.id,
        stageId: targetStage.id,
        today,
      })

      if (res.ok) {
        showToast?.(`Moved to ${targetStage.name}`, 'success')
        loadData()
      } else {
        const code = res.error.code
        if (code === 'USE_CLOSE_PROJECT') {
          const detailRes = await fetchProjectAction({ id: card.project.id, today })
          if (detailRes.ok) {
            setClosingProjectDetail(detailRes.data)
            setIsCloseDialogOpen(true)
          }
        } else {
          showToast?.(res.error.message || 'Failed to move stage', 'warning')
        }
      }
    },
    [today, showToast, loadData]
  )

  // Prev / Next stage handler for keyboard
  const handleMovePrevStage = useCallback(
    (card: ProjectCard) => {
      const currIdx = stages.findIndex((s) => s.id === card.project.stageId)
      if (currIdx > 0) {
        handleMoveStage(card, stages[currIdx - 1])
      }
    },
    [stages, handleMoveStage]
  )

  const handleMoveNextStage = useCallback(
    (card: ProjectCard) => {
      const currIdx = stages.findIndex((s) => s.id === card.project.stageId)
      if (currIdx !== -1 && currIdx < stages.length - 1) {
        handleMoveStage(card, stages[currIdx + 1])
      }
    },
    [stages, handleMoveStage]
  )

  // Use board keyboard hook
  useBoardKeyboard<ProjectCard>({
    columns,
    selectedColumnId,
    selectedItemId: selectedProjectId,
    getItemId: (p) => p.project.id,
    onSelectColumn: (colId) => {
      setSelectedColumnId(colId)
      const col = columns.find((c) => c.id === colId)
      if (col && col.items.length > 0) {
        setSelectedProjectId(col.items[0].project.id)
      } else {
        setSelectedProjectId(null)
      }
    },
    onSelectItem: (itemId) => setSelectedProjectId(itemId),
    onOpenItem: (p) => router.push(`/projects/${p.project.id}`),
    onMovePrevStage: handleMovePrevStage,
    onMoveNextStage: handleMoveNextStage,
    onFocusFilter: () => filterInputRef.current?.focus(),
    enabled: layout === 'board',
  })

  // Shortcuts: toggle layout (V) & toggle archive (Shift+E)
  useShortcut('board.toggleLayout', () => {
    setLayout((prev) => (prev === 'board' ? 'list' : 'board'))
  })

  useShortcut('board.archive', () => {
    setShowArchived((prev) => !prev)
  })

  // List layout sorting: by due date (nulls last)
  const sortedListProjects = useMemo(() => {
    return [...filteredProjects].sort((a, b) => {
      const aDue = a.project.dueDate || '9999-99-99'
      const bDue = b.project.dueDate || '9999-99-99'
      return aDue.localeCompare(bDue)
    })
  }, [filteredProjects])

  // Drag and drop state
  const [draggingCard, setDraggingCard] = useState<ProjectCard | null>(null)
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null)

  return (
    <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden bg-white dark:bg-slate-900">
      {/* Top Header */}
      <div className="h-14 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-6 shrink-0 bg-white dark:bg-slate-900 z-10">
        <div className="flex items-center gap-4">
          <h1 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Projects
          </h1>

          {/* Board / List toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={() => setLayout('board')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layout === 'board'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <Kanban size={13} />
              <span>Board</span>
            </button>
            <button
              type="button"
              onClick={() => setLayout('list')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                layout === 'list'
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <ListIcon size={13} />
              <span>List</span>
              <kbd className="ml-1 text-[9px] font-mono text-slate-400">V</kbd>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="relative">
            <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input
              ref={filterInputRef}
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter /: client, billing..."
              className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500 w-48 transition-all"
            />
          </div>

          {/* Show archived checkbox */}
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <span>Show archived</span>
            <kbd className="text-[10px] font-mono text-slate-400">⇧E</kbd>
          </label>
        </div>

        <div className="flex items-center gap-2">
          {onStartProject && (
            <button
              type="button"
              onClick={onStartProject}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
            >
              <Plus size={14} />
              <span>Project</span>
              <kbd className="ml-1 px-1 py-0.2 bg-blue-700 rounded text-[10px] font-mono">P</kbd>
            </button>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6 bg-slate-50/50 dark:bg-slate-900/50">
        {isLoading && projects.length === 0 ? (
          <div className="flex gap-4 h-full">
            {[1, 2, 3, 4, 5].map((c) => (
              <div
                key={c}
                className="w-72 shrink-0 bg-slate-100/70 dark:bg-slate-800/40 rounded-xl p-3 space-y-3 animate-pulse"
              >
                <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                <div className="h-28 bg-slate-200/60 dark:bg-slate-700/60 rounded-lg" />
                <div className="h-28 bg-slate-200/60 dark:bg-slate-700/60 rounded-lg" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-3">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">
              No projects yet. Start one from a won deal or press P.
            </p>
            {onStartProject && (
              <button
                type="button"
                onClick={onStartProject}
                className="px-3.5 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                Start project (P)
              </button>
            )}
          </div>
        ) : layout === 'board' ? (
          /* Kanban Board View */
          <div className="flex gap-4 h-full pb-2">
            {columns.map((col) => {
              const isColSelected = col.id === selectedColumnId
              const isOver = dragOverStageId === col.id
              const isClosed = stages.find((s) => s.id === col.id)?.category === 'closed'

              // For closed column, show only 5 most recent
              const displayItems = isClosed ? col.items.slice(0, 5) : col.items
              const hiddenCount = isClosed ? Math.max(0, col.items.length - 5) : 0

              return (
                <div
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault()
                    setDragOverStageId(col.id)
                  }}
                  onDragLeave={() => setDragOverStageId(null)}
                  onDrop={(e) => {
                    e.preventDefault()
                    setDragOverStageId(null)
                    if (draggingCard) {
                      const targetStage = stages.find((s) => s.id === col.id)
                      if (targetStage) {
                        handleMoveStage(draggingCard, targetStage)
                      }
                      setDraggingCard(null)
                    }
                  }}
                  onClick={() => setSelectedColumnId(col.id)}
                  className={`w-72 shrink-0 flex flex-col rounded-xl bg-slate-100/60 dark:bg-slate-800/40 border transition-all ${
                    isOver
                      ? 'border-blue-500 bg-blue-50/20 dark:bg-blue-950/20'
                      : isColSelected
                      ? 'border-slate-300 dark:border-slate-700 shadow-sm'
                      : 'border-transparent'
                  }`}
                >
                  {/* Column Header */}
                  <div className="p-3 flex items-center justify-between text-xs font-semibold text-slate-700 dark:text-slate-300 border-b border-slate-200/60 dark:border-slate-700/60">
                    <div className="flex items-center gap-2">
                      <span>{col.name}</span>
                      <span className="text-[11px] font-normal text-slate-400">
                        · {col.items.length}
                      </span>
                    </div>
                  </div>

                  {/* Cards List */}
                  <div className="flex-1 p-2 space-y-2 overflow-y-auto">
                    {displayItems.map((card) => {
                      const isCardSelected = card.project.id === selectedProjectId
                      return (
                        <ProjectCardView
                          key={card.project.id}
                          card={card}
                          isSelected={isCardSelected}
                          onSelect={() => {
                            setSelectedColumnId(col.id)
                            setSelectedProjectId(card.project.id)
                          }}
                          onOpen={() => router.push(`/projects/${card.project.id}`)}
                          onDragStart={() => setDraggingCard(card)}
                        />
                      )
                    })}

                    {hiddenCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setLayout('list')
                          setFilterQuery(col.name)
                        }}
                        className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"
                      >
                        …{hiddenCount} more
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          /* Table List View */
          <div className="h-full overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-200 dark:border-slate-800 sticky top-0">
                <tr>
                  <th className="py-2.5 px-4 font-semibold">Project</th>
                  <th className="py-2.5 px-4 font-semibold">Client</th>
                  <th className="py-2.5 px-4 font-semibold">Stage</th>
                  <th className="py-2.5 px-4 font-semibold">Next Task</th>
                  <th className="py-2.5 px-4 font-semibold">Due</th>
                  <th className="py-2.5 px-4 font-semibold text-right">Unpaid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedListProjects.map((card) => {
                  const formattedUnpaid =
                    card.money.outstandingMinor > 0
                      ? formatMinor(card.money.outstandingMinor, card.project.currency, {
                          currency: card.project.currency,
                          currencySymbol: card.project.currency === 'EUR' ? '€' : '$',
                          locale: OPERATOR_CONFIG.locale || 'en-US',
                        })
                      : '—'

                  return (
                    <tr
                      key={card.project.id}
                      onClick={() => router.push(`/projects/${card.project.id}`)}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors"
                    >
                      <td className="py-3 px-4 font-medium text-slate-900 dark:text-slate-100">
                        {card.project.title}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400">
                        {card.project.company || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {card.stage.name}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 truncate max-w-xs">
                        {card.needsNextStep ? (
                          <span className="text-amber-600 dark:text-amber-400 font-medium">
                            No dated task
                          </span>
                        ) : (
                          card.currentMilestone?.title || '—'
                        )}
                      </td>
                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400">
                        {card.project.dueDate
                          ? formatRelativeDate(card.project.dueDate, today)
                          : '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-medium text-slate-800 dark:text-slate-200">
                        {formattedUnpaid}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bottom shortcut legend */}
      <div className="h-9 border-t border-slate-200 dark:border-slate-800 px-6 flex items-center text-[11px] text-slate-500 dark:text-slate-400 shrink-0 bg-slate-50 dark:bg-slate-900/50">
        <span>←/→ column · J/K card · [ ] move stage · ↵ open · ⇧E archive · V list · P new</span>
      </div>

      {/* Close Project Dialog */}
      {closingProjectDetail && (
        <CloseProjectDialog
          isOpen={isCloseDialogOpen}
          project={closingProjectDetail.project}
          invoices={closingProjectDetail.invoices}
          openTasksCount={closingProjectDetail.tasks.filter((t) => !t.completedAt).length}
          onClose={() => {
            setIsCloseDialogOpen(false)
            setClosingProjectDetail(null)
          }}
          onCloseProject={async (input) => {
            const res = await closeProjectAction(input)
            if (res.ok) {
              showToast?.('Project closed', 'success')
              setIsCloseDialogOpen(false)
              setClosingProjectDetail(null)
              loadData()
            } else {
              showToast?.(res.error.message || 'Failed to close project', 'error')
            }
          }}
        />
      )}
    </div>
  )
}
