'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Check,
  Star,
  Mail,
  Calendar,
  AlertCircle,
  MoreVertical,
  RotateCcw,
} from 'lucide-react'
import type { Task } from '@/lib/projects/types'
import { formatRelativeDate, localToday } from '@/lib/projects/dates'

interface TaskRowProps {
  task: Task
  isSelected: boolean
  isEditing?: boolean
  isReadOnly?: boolean
  onSelect: () => void
  onToggleDone: () => void
  onSaveTitle?: (newTitle: string) => void
  onCancelEdit?: () => void
  onOpenDetails: () => void
  onOpenDueDate?: () => void
  onToggleFocus?: () => void
}

export function TaskRow({
  task,
  isSelected,
  isEditing = false,
  isReadOnly = false,
  onSelect,
  onToggleDone,
  onSaveTitle,
  onCancelEdit,
  onOpenDetails,
  onOpenDueDate,
  onToggleFocus,
}: TaskRowProps) {
  const [editTitle, setEditTitle] = useState(task.title)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = localToday()

  const isCompleted = !!task.completedAt
  const isOverdue =
    !isCompleted && !!task.dueDate && task.dueDate < today
  const isDueToday = !isCompleted && task.dueDate === today

  useEffect(() => {
    if (isEditing) {
      setEditTitle(task.title)
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isEditing, task.title])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (editTitle.trim() && editTitle.trim() !== task.title) {
        onSaveTitle?.(editTitle.trim())
      } else {
        onCancelEdit?.()
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setEditTitle(task.title)
      onCancelEdit?.()
    }
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onOpenDetails}
      className={`group relative flex items-center justify-between min-h-[40px] px-3 py-2 rounded-lg text-xs transition-colors cursor-pointer select-none ${
        isSelected
          ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/50'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      {/* Left: Checkbox & Title */}
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {/* Checkbox button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (!isReadOnly) onToggleDone()
          }}
          disabled={isReadOnly}
          className={`w-4 h-4 rounded flex items-center justify-center shrink-0 transition-colors border ${
            isCompleted
              ? 'bg-blue-600 border-blue-600 text-white'
              : 'border-slate-300 dark:border-slate-600 hover:border-slate-400 dark:hover:border-slate-500 bg-white dark:bg-slate-800'
          }`}
          title={isCompleted ? 'Mark open (X)' : 'Mark complete (X)'}
        >
          {isCompleted && <Check size={11} strokeWidth={3} />}
        </button>

        {/* Title or inline edit */}
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => {
              if (editTitle.trim() && editTitle.trim() !== task.title) {
                onSaveTitle?.(editTitle.trim())
              } else {
                onCancelEdit?.()
              }
            }}
            className="flex-1 bg-white dark:bg-slate-900 border border-blue-500 rounded px-1.5 py-0.5 text-xs text-slate-900 dark:text-slate-100 outline-none"
          />
        ) : (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span
              className={`truncate font-medium ${
                isCompleted
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-800 dark:text-slate-200'
              }`}
            >
              {task.title}
            </span>

            {/* Revision badge ⟲Rn */}
            {task.revisionRound !== null && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 shrink-0">
                <span>⟲R{task.revisionRound}</span>
              </span>
            )}

            {/* Source activity link icon ✉ */}
            {task.sourceActivityId && (
              <span
                className="text-slate-400 dark:text-slate-500 shrink-0"
                title="Created from activity feedback"
              >
                <Mail size={12} />
              </span>
            )}
          </div>
        )}
      </div>

      {/* Right: Badges & Due date */}
      <div className="flex items-center gap-2 shrink-0 ml-2">
        {/* Star Pin ★ */}
        {task.focusDate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!isReadOnly) onToggleFocus?.()
            }}
            className="text-amber-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors p-0.5"
            title="Pinned to Today"
          >
            <Star size={12} className="fill-amber-400 text-amber-500" />
          </button>
        )}

        {/* Due date pill */}
        {task.dueDate && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              if (!isReadOnly) onOpenDueDate?.()
            }}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium transition-colors ${
              isOverdue
                ? 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50'
                : isDueToday
                ? 'bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50'
                : 'text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'
            }`}
            title="Set due date (D)"
          >
            <Calendar size={11} />
            <span>{formatRelativeDate(task.dueDate, today)}</span>
            {isOverdue && <AlertCircle size={10} className="text-red-500" />}
          </button>
        )}
      </div>
    </div>
  )
}
