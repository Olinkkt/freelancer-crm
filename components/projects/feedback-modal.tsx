'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  MessageSquare,
  AlertCircle,
  Check,
  Calendar,
  Sparkles,
  Edit2,
  Trash2,
} from 'lucide-react'
import type { Milestone, Project, Task } from '@/lib/projects/types'
import { splitFeedback, calculateRevisionRound } from '@/lib/projects/feedback'
import { localToday, parseDateInput } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { handleFormKeys } from '@/components/shortcuts/form-keys'

interface FeedbackModalProps {
  project: Project
  milestones: Milestone[]
  tasks: Task[]
  currentMilestoneId?: string | null
  isOpen: boolean
  onClose: () => void
  onSubmitFeedback: (params: {
    source: 'Email' | 'Call' | 'Meeting' | 'Note'
    date: string
    milestoneId: string | null
    text: string
    items: string[]
    dueDate: string | null
  }) => Promise<void>
}

export function FeedbackModal({
  project,
  milestones,
  tasks,
  currentMilestoneId = null,
  isOpen,
  onClose,
  onSubmitFeedback,
}: FeedbackModalProps) {
  const [source, setSource] = useState<'Email' | 'Call' | 'Meeting' | 'Note'>('Email')
  const [date, setDate] = useState('')
  const [milestoneId, setMilestoneId] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [dueDateText, setDueDateText] = useState('')
  const [items, setItems] = useState<{ text: string; enabled: boolean }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const today = localToday()

  useEscapeLayer(onClose, isOpen)

  const { round, overScope } = calculateRevisionRound(tasks, project.revisionsIncluded)

  useEffect(() => {
    if (isOpen) {
      setDate(today)
      setMilestoneId(currentMilestoneId || milestones[0]?.id || null)
      setText('')
      setDueDateText('')
      setItems([])
      setError(null)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [isOpen, currentMilestoneId, milestones, today])

  // Live split items on text change
  useEffect(() => {
    if (!text.trim()) {
      setItems([])
      return
    }
    const extracted = splitFeedback(text)
    setItems(extracted.map((t) => ({ text: t, enabled: true })))
  }, [text])

  if (!isOpen) return null

  const resolvedDueDate = dueDateText.trim()
    ? parseDateInput(dueDateText.trim(), today)
    : null

  const selectedItems = items.filter((i) => i.enabled).map((i) => i.text.trim())

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!text.trim()) {
      setError('Feedback text is required')
      return
    }
    if (selectedItems.length === 0) {
      setError('At least one task item must be selected')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmitFeedback({
        source,
        date: date || today,
        milestoneId,
        text: text.trim(),
        items: selectedItems,
        dueDate: resolvedDueDate,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to log feedback')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onKeyDown={(e) =>
        handleFormKeys(e, {
          onSubmit: () => handleSubmit(),
          onCancel: onClose,
        })
      }
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
              Log Client Feedback
            </h2>
            <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-purple-50 dark:bg-purple-950/50 text-purple-700 dark:text-purple-300">
              Round {round}
              {project.revisionsIncluded !== null && ` of ${project.revisionsIncluded}`}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Warning banner if over scope */}
        {overScope && (
          <div className="px-5 py-2.5 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-800/50 flex items-center gap-2 text-xs text-amber-800 dark:text-amber-300">
            <AlertCircle size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
            <span>
              Round {round} is over the {project.revisionsIncluded} included revision
              {project.revisionsIncluded === 1 ? '' : 's'}. Consider billing out-of-scope work.
            </span>
          </div>
        )}

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Meta row: Source, Date, Milestone */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Source</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as any)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              >
                <option value="Email">Email</option>
                <option value="Call">Call</option>
                <option value="Meeting">Meeting</option>
                <option value="Note">Note</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">Milestone</label>
              <select
                value={milestoneId || ''}
                onChange={(e) => setMilestoneId(e.target.value || null)}
                className="w-full px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              >
                <option value="">No milestone</option>
                {milestones.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Textarea */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Feedback Content *
            </label>
            <textarea
              ref={textareaRef}
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={6}
              placeholder="Paste email, bullet points, or notes. Checklist items or sentences will be automatically turned into revision tasks..."
              className="w-full p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Live Extracted Checklist */}
          {items.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                <span>REVISION TASKS TO CREATE ({selectedItems.length}/{items.length})</span>
                <span className="text-[10px] text-slate-400">Marked with ⟲R{round}</span>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
                {items.map((item, idx) => (
                  <div key={idx} className="flex items-start gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={item.enabled}
                      onChange={(e) => {
                        const updated = [...items]
                        updated[idx].enabled = e.target.checked
                        setItems(updated)
                      }}
                      className="mt-0.5 rounded text-blue-600 focus:ring-0"
                    />
                    <input
                      type="text"
                      value={item.text}
                      onChange={(e) => {
                        const updated = [...items]
                        updated[idx].text = e.target.value
                        setItems(updated)
                      }}
                      className="flex-1 bg-transparent border-b border-transparent focus:border-blue-400 outline-none text-slate-800 dark:text-slate-200 font-medium"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Optional Due Date for generated tasks */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Due Date for Tasks (optional)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={dueDateText}
                onChange={(e) => setDueDateText(e.target.value)}
                placeholder='e.g. "+3d", "fri", or "2026-11-05"'
                className="w-48 px-2.5 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
              />
              {resolvedDueDate && (
                <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                  Resolves to: {resolvedDueDate}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {selectedItems.length} revision task{selectedItems.length === 1 ? '' : 's'} will be created
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting || selectedItems.length === 0}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              Create tasks (⌘↵)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
