'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Plus, CornerDownLeft, Sparkles } from 'lucide-react'
import type { Milestone } from '@/lib/projects/types'
import { parseQuickAdd } from '@/lib/projects/quick-add'
import { localToday } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

interface TaskQuickAddProps {
  projectId: string
  milestones: Milestone[]
  defaultMilestoneId?: string | null
  afterTaskId?: string | null
  isOpen: boolean
  onClose: () => void
  onCreateTask: (params: {
    title: string
    milestoneId: string | null
    dueDate: string | null
    focusDate: string | null
    afterTaskId: string | null
  }) => Promise<boolean | void>
}

export function TaskQuickAdd({
  projectId,
  milestones,
  defaultMilestoneId = null,
  afterTaskId = null,
  isOpen,
  onClose,
  onCreateTask,
}: TaskQuickAddProps) {
  const [text, setText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const today = localToday()

  useEscapeLayer(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
    } else {
      setText('')
    }
  }, [isOpen])

  // Parse preview
  const parsed = text.trim() ? parseQuickAdd(text, { today, milestones }) : null
  const targetMilestoneId = parsed?.milestoneId ?? defaultMilestoneId
  const targetMilestone = milestones.find((m) => m.id === targetMilestoneId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || isSubmitting) return

    const { title, dueDate, focusToday, milestoneId } = parseQuickAdd(text, {
      today,
      milestones,
    })

    if (!title.trim()) return

    setIsSubmitting(true)
    try {
      const success = await onCreateTask({
        title: title.trim(),
        milestoneId: milestoneId ?? defaultMilestoneId,
        dueDate,
        focusDate: focusToday ? today : null,
        afterTaskId,
      })
      if (success !== false) {
        setText('')
        inputRef.current?.focus()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <form
      onSubmit={handleSubmit}
      className="p-2.5 rounded-lg border border-blue-200 dark:border-blue-900/60 bg-blue-50/40 dark:bg-blue-950/20 space-y-2 animate-in fade-in duration-100"
    >
      <div className="flex items-center gap-2">
        <Plus size={14} className="text-blue-500 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Add task e.g. "Fix footer fri #launch !"'
          className="flex-1 bg-transparent text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 outline-none font-medium"
          disabled={isSubmitting}
        />
        <button
          type="submit"
          disabled={!text.trim() || isSubmitting}
          className="px-2 py-0.5 text-[11px] font-medium rounded bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-40 transition-colors flex items-center gap-1 cursor-pointer"
        >
          <span>Add</span>
          <CornerDownLeft size={10} />
        </button>
      </div>

      {/* Live parsing helper tags */}
      {parsed && (parsed.dueDate || parsed.focusToday || targetMilestone) && (
        <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-slate-400 pl-5 flex-wrap">
          <span className="font-semibold text-slate-700 dark:text-slate-300">Preview:</span>
          {targetMilestone && (
            <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              #{targetMilestone.title}
            </span>
          )}
          {parsed.dueDate && (
            <span className="px-1.5 py-0.2 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
              Due: {parsed.dueDate}
            </span>
          )}
          {parsed.focusToday && (
            <span className="px-1.5 py-0.2 rounded bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300">
              ★ Focus Today
            </span>
          )}
        </div>
      )}
    </form>
  )
}
