'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  Calendar,
  Star,
  Flag,
  Mail,
  Clock,
  CheckCircle2,
  Trash2,
} from 'lucide-react'
import type { Task, Milestone } from '@/lib/projects/types'
import { formatRelativeDate, localToday } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

interface TaskDetailPanelProps {
  task: Task | null
  milestones: Milestone[]
  isOpen: boolean
  isReadOnly?: boolean
  onClose: () => void
  onUpdateTask: (patch: {
    title?: string
    notes?: string | null
    dueDate?: string | null
    focusDate?: string | null
    milestoneId?: string | null
  }) => void
  onDeleteTask: (task: Task) => void
}

export function TaskDetailPanel({
  task,
  milestones,
  isOpen,
  isReadOnly = false,
  onClose,
  onUpdateTask,
  onDeleteTask,
}: TaskDetailPanelProps) {
  const [title, setTitle] = useState(task?.title || '')
  const [notes, setNotes] = useState(task?.notes || '')
  const today = localToday()

  useEscapeLayer(onClose, isOpen)

  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setNotes(task.notes || '')
    }
  }, [task])

  if (!isOpen || !task) return null

  const isCompleted = !!task.completedAt

  const handleBlurTitle = () => {
    if (title.trim() && title.trim() !== task.title) {
      onUpdateTask({ title: title.trim() })
    }
  }

  const handleBlurNotes = () => {
    if (notes !== (task.notes || '')) {
      onUpdateTask({ notes: notes || null })
    }
  }

  return (
    <div className="absolute inset-y-0 right-0 w-full sm:w-[380px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-40 flex flex-col animate-in slide-in-from-right duration-150">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {isCompleted && (
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full">
              <CheckCircle2 size={12} />
              <span>Completed</span>
            </span>
          )}
          {task.revisionRound !== null && (
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
              ⟲ Round {task.revisionRound}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-md"
          title="Close details (Esc)"
        >
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs">
        {/* Title */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={handleBlurTitle}
            disabled={isReadOnly}
            className="w-full text-sm font-semibold bg-transparent text-slate-900 dark:text-slate-100 border-b border-transparent hover:border-slate-300 dark:hover:border-slate-700 focus:border-blue-500 outline-none py-1"
          />
        </div>

        {/* Milestone selector */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Milestone
          </label>
          <select
            value={task.milestoneId || ''}
            onChange={(e) => onUpdateTask({ milestoneId: e.target.value || null })}
            disabled={isReadOnly}
            className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none"
          >
            <option value="">No milestone</option>
            {milestones.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </select>
        </div>

        {/* Due Date & Focus Date */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Due Date
            </label>
            <input
              type="date"
              value={task.dueDate || ''}
              onChange={(e) => onUpdateTask({ dueDate: e.target.value || null })}
              disabled={isReadOnly}
              className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none text-xs"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Pin to Today
            </label>
            <button
              type="button"
              onClick={() => onUpdateTask({ focusDate: task.focusDate ? null : today })}
              disabled={isReadOnly}
              className={`w-full px-2.5 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 font-medium transition-colors ${
                task.focusDate
                  ? 'bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-800 text-amber-700 dark:text-amber-300'
                  : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
              }`}
            >
              <Star
                size={12}
                className={task.focusDate ? 'fill-amber-400 text-amber-500' : ''}
              />
              <span>{task.focusDate ? 'Pinned' : 'Not pinned'}</span>
            </button>
          </div>
        </div>

        {/* Notes editor (autosaves on blur) */}
        <div className="space-y-1">
          <label className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Notes (Markdown)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            onBlur={handleBlurNotes}
            disabled={isReadOnly}
            rows={8}
            placeholder="Add task notes, links, checklist..."
            className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 outline-none focus:border-blue-500 font-mono text-xs leading-relaxed resize-y"
          />
        </div>

        {/* Source Activity */}
        {task.sourceActivityId && (
          <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700 dark:text-slate-300">
              <Mail size={12} className="text-blue-500" />
              <span>Created from Activity</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Source activity ID: {task.sourceActivityId}
            </p>
          </div>
        )}

        {/* Timestamps */}
        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px] text-slate-400 dark:text-slate-500">
          <div className="flex items-center gap-1">
            <Clock size={11} />
            <span>Created {task.createdAt?.slice(0, 10)}</span>
          </div>
          {task.completedAt && (
            <div className="flex items-center gap-1">
              <CheckCircle2 size={11} className="text-emerald-500" />
              <span>Completed {task.completedAt.slice(0, 10)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      {!isReadOnly && (
        <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex justify-between items-center">
          <button
            type="button"
            onClick={() => {
              onDeleteTask(task)
              onClose()
            }}
            className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 flex items-center gap-1"
          >
            <Trash2 size={12} />
            <span>Delete task</span>
          </button>
          <span className="text-[11px] text-slate-400">Esc to close</span>
        </div>
      )}
    </div>
  )
}
