'use client'

import { useState, useCallback, useMemo } from 'react'
import type { Task } from '@/lib/projects/types'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'

export interface UseListKeyboardOptions {
  tasks: Task[]
  selectedTaskId: string | null
  onSelectTaskId: (id: string | null) => void
  onToggleDone?: (task: Task) => void
  onOpenQuickAdd?: () => void
  onStartInlineEdit?: (task: Task) => void
  onOpenDetails?: (task: Task) => void
  onOpenDueDate?: (task: Task) => void
  onClearDueDate?: (task: Task) => void
  onToggleFocus?: (task: Task) => void
  onOpenMoveMilestone?: (task: Task) => void
  onMoveUp?: (task: Task) => void
  onMoveDown?: (task: Task) => void
  onDelete?: (task: Task) => void
  onToggleCompleted?: () => void
  enabled?: boolean
}

export function useListKeyboard({
  tasks,
  selectedTaskId,
  onSelectTaskId,
  onToggleDone,
  onOpenQuickAdd,
  onStartInlineEdit,
  onOpenDetails,
  onOpenDueDate,
  onClearDueDate,
  onToggleFocus,
  onOpenMoveMilestone,
  onMoveUp,
  onMoveDown,
  onDelete,
  onToggleCompleted,
  enabled = true,
}: UseListKeyboardOptions) {
  const selectedTask = useMemo(() => {
    return tasks.find((t) => t.id === selectedTaskId) || null
  }, [tasks, selectedTaskId])

  const selectNext = useCallback(() => {
    if (tasks.length === 0) return
    const currentIndex = tasks.findIndex((t) => t.id === selectedTaskId)
    if (currentIndex === -1 || currentIndex >= tasks.length - 1) {
      onSelectTaskId(tasks[0].id)
    } else {
      onSelectTaskId(tasks[currentIndex + 1].id)
    }
  }, [tasks, selectedTaskId, onSelectTaskId])

  const selectPrev = useCallback(() => {
    if (tasks.length === 0) return
    const currentIndex = tasks.findIndex((t) => t.id === selectedTaskId)
    if (currentIndex <= 0) {
      onSelectTaskId(tasks[tasks.length - 1].id)
    } else {
      onSelectTaskId(tasks[currentIndex - 1].id)
    }
  }, [tasks, selectedTaskId, onSelectTaskId])

  useShortcut('list.down', selectNext, { enabled })
  useShortcut('list.up', selectPrev, { enabled })

  useShortcut(
    'list.toggleDone',
    () => {
      if (selectedTask && onToggleDone) {
        onToggleDone(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.addTask',
    () => {
      onOpenQuickAdd?.()
    },
    { enabled }
  )

  useShortcut(
    'list.edit',
    () => {
      if (selectedTask && onStartInlineEdit) {
        onStartInlineEdit(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.open',
    () => {
      if (selectedTask && onOpenDetails) {
        onOpenDetails(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.setDue',
    () => {
      if (selectedTask && onOpenDueDate) {
        onOpenDueDate(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.clearDue',
    () => {
      if (selectedTask && onClearDueDate) {
        onClearDueDate(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.toggleFocus',
    () => {
      if (selectedTask && onToggleFocus) {
        onToggleFocus(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.moveToMilestone',
    () => {
      if (selectedTask && onOpenMoveMilestone) {
        onOpenMoveMilestone(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.moveUp',
    () => {
      if (selectedTask && onMoveUp) {
        onMoveUp(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.moveDown',
    () => {
      if (selectedTask && onMoveDown) {
        onMoveDown(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.delete',
    () => {
      if (selectedTask && onDelete) {
        onDelete(selectedTask)
      }
    },
    { enabled: enabled && !!selectedTask }
  )

  useShortcut(
    'list.toggleCompleted',
    () => {
      onToggleCompleted?.()
    },
    { enabled }
  )

  return {
    selectedTask,
    selectNext,
    selectPrev,
  }
}
