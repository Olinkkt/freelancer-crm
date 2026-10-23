'use client'

import React, { useState, useMemo } from 'react'
import {
  Plus,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  Calendar,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react'
import type { Task, Milestone } from '@/lib/projects/types'
import { TaskRow } from './task-row'
import { TaskQuickAdd } from './task-quick-add'
import { groupTasksByMilestone } from '@/lib/projects/ui-helpers'
import { useListKeyboard } from './use-list-keyboard'
import { useShortcutContext } from '@/components/shortcuts/shortcut-provider'

interface TaskListProps {
  tasks: Task[]
  milestones: Milestone[]
  selectedTaskId: string | null
  isReadOnly?: boolean
  onSelectTaskId: (id: string | null) => void
  onToggleDone: (task: Task) => void
  onSaveTaskTitle: (taskId: string, newTitle: string) => void
  onCreateTask: (params: {
    title: string
    milestoneId: string | null
    dueDate: string | null
    focusDate: string | null
    afterTaskId: string | null
  }) => Promise<boolean | void>
  onOpenDetails: (task: Task) => void
  onOpenDueDate: (task: Task) => void
  onClearDueDate: (task: Task) => void
  onToggleFocus: (task: Task) => void
  onOpenMoveMilestone: (task: Task) => void
  onMoveUp: (task: Task) => void
  onMoveDown: (task: Task) => void
  onDeleteTask: (task: Task) => void
  onReadOnlyAttempt?: () => void
}

export function TaskList({
  tasks,
  milestones,
  selectedTaskId,
  isReadOnly = false,
  onSelectTaskId,
  onToggleDone,
  onSaveTaskTitle,
  onCreateTask,
  onOpenDetails,
  onOpenDueDate,
  onClearDueDate,
  onToggleFocus,
  onOpenMoveMilestone,
  onMoveUp,
  onMoveDown,
  onDeleteTask,
  onReadOnlyAttempt,
}: TaskListProps) {
  const [showCompleted, setShowCompleted] = useState(false)
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false)
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null)

  // Visible tasks filter
  const visibleTasks = useMemo(() => {
    if (showCompleted) return tasks
    return tasks.filter((t) => !t.completedAt)
  }, [tasks, showCompleted])

  const completedCount = useMemo(() => {
    return tasks.filter((t) => !!t.completedAt).length
  }, [tasks])

  const totalCount = tasks.length
  const openCount = totalCount - completedCount

  const groups = useMemo(() => {
    return groupTasksByMilestone(visibleTasks, milestones)
  }, [visibleTasks, milestones])

  // Guard action for read-only mode
  const guard = (fn: () => void) => {
    if (isReadOnly) {
      onReadOnlyAttempt?.()
    } else {
      fn()
    }
  }

  // Hook up keyboard navigation
  useListKeyboard({
    tasks: visibleTasks,
    selectedTaskId,
    onSelectTaskId,
    onToggleDone: (task) => guard(() => onToggleDone(task)),
    onOpenQuickAdd: () => guard(() => setIsQuickAddOpen(true)),
    onStartInlineEdit: (task) => guard(() => setEditingTaskId(task.id)),
    onOpenDetails,
    onOpenDueDate: (task) => guard(() => onOpenDueDate(task)),
    onClearDueDate: (task) => guard(() => onClearDueDate(task)),
    onToggleFocus: (task) => guard(() => onToggleFocus(task)),
    onOpenMoveMilestone: (task) => guard(() => onOpenMoveMilestone(task)),
    onMoveUp: (task) => guard(() => onMoveUp(task)),
    onMoveDown: (task) => guard(() => onMoveDown(task)),
    onDelete: (task) => guard(() => onDeleteTask(task)),
    onToggleCompleted: () => setShowCompleted((prev) => !prev),
    enabled: true,
  })

  return (
    <div className="space-y-4">
      {/* Task List Header */}
      <div className="flex items-center justify-between gap-3 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Tasks
          </h2>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
            {completedCount}/{totalCount}
          </span>
        </div>

        {!isReadOnly && (
          <button
            type="button"
            onClick={() => setIsQuickAddOpen(!isQuickAddOpen)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
          >
            <Plus size={13} />
            <span>Add task</span>
            <kbd className="px-1 text-[9px] font-mono bg-blue-100 dark:bg-blue-900 rounded">
              T
            </kbd>
          </button>
        )}
      </div>

      {/* Quick Add Bar */}
      {!isReadOnly && (
        <TaskQuickAdd
          projectId={milestones[0]?.projectId || ''}
          milestones={milestones}
          afterTaskId={selectedTaskId}
          isOpen={isQuickAddOpen}
          onClose={() => setIsQuickAddOpen(false)}
          onCreateTask={onCreateTask}
        />
      )}

      {/* Task Groups */}
      <div className="space-y-5">
        {groups.map((group, groupIdx) => {
          // If group is empty and not showCompleted or no tasks at all
          const groupTasks = group.tasks
          const milestone = group.milestone
          const allTasksForGroup = tasks.filter((t) =>
            milestone ? t.milestoneId === milestone.id : !t.milestoneId
          )
          const groupCompleted = allTasksForGroup.filter((t) => !!t.completedAt).length
          const groupTotal = allTasksForGroup.length

          // Skip empty groups if no milestone or if no tasks at all and not first
          if (groupTotal === 0 && !milestone) return null

          return (
            <div key={milestone ? milestone.id : 'no-milestone'} className="space-y-1.5">
              {/* Group Header */}
              <div className="flex items-center justify-between text-xs px-2 py-1 text-slate-600 dark:text-slate-300 font-semibold bg-slate-50/50 dark:bg-slate-800/30 rounded-md">
                <div className="flex items-center gap-2">
                  <span>▾</span>
                  <span>{milestone ? milestone.title : 'No milestone'}</span>
                  {milestone?.status === 'approved' && (
                    <span className="text-emerald-500 font-bold">✓</span>
                  )}
                  {milestone?.dueDate && (
                    <span className="text-[11px] font-normal text-slate-400">
                      · due {milestone.dueDate}
                    </span>
                  )}
                </div>
                <span className="text-[11px] font-mono text-slate-400">
                  {groupCompleted}/{groupTotal}
                </span>
              </div>

              {/* Tasks Rows */}
              <div className="space-y-0.5 pl-1">
                {groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    isSelected={task.id === selectedTaskId}
                    isEditing={task.id === editingTaskId}
                    isReadOnly={isReadOnly}
                    onSelect={() => onSelectTaskId(task.id)}
                    onToggleDone={() => onToggleDone(task)}
                    onSaveTitle={(title) => {
                      onSaveTaskTitle(task.id, title)
                      setEditingTaskId(null)
                    }}
                    onCancelEdit={() => setEditingTaskId(null)}
                    onOpenDetails={() => onOpenDetails(task)}
                    onOpenDueDate={() => onOpenDueDate(task)}
                    onToggleFocus={() => onToggleFocus(task)}
                  />
                ))}
                {groupTasks.length === 0 && (
                  <div className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500 italic">
                    {groupTotal > 0 ? 'All tasks completed' : 'No tasks in this milestone'}
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {tasks.length === 0 && (
          <div className="text-center py-8 text-xs text-slate-400 dark:text-slate-500 space-y-1">
            <p>No tasks yet.</p>
            {!isReadOnly && <p>Add your first task (T) or a milestone (⇧M)</p>}
          </div>
        )}
      </div>

      {/* Completed tasks toggle footer */}
      {completedCount > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
          >
            {showCompleted ? <EyeOff size={13} /> : <Eye size={13} />}
            <span>
              {showCompleted ? 'Hide completed' : `Show ${completedCount} completed`}
            </span>
            <kbd className="px-1 text-[9px] font-mono bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700">
              H
            </kbd>
          </button>
        </div>
      )}
    </div>
  )
}
