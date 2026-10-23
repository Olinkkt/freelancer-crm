'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Calendar, DollarSign, Flag } from 'lucide-react'
import type { Milestone } from '@/lib/projects/types'
import { localToday, parseDateInput } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { handleFormKeys } from '@/components/shortcuts/form-keys'

interface MilestoneModalProps {
  milestoneToEdit?: Milestone | null
  currency: string
  isOpen: boolean
  onClose: () => void
  onSave: (params: {
    id?: string
    title: string
    dueDate: string | null
    amountMinor: number | null
  }) => Promise<void>
}

export function MilestoneModal({
  milestoneToEdit,
  currency,
  isOpen,
  onClose,
  onSave,
}: MilestoneModalProps) {
  const [title, setTitle] = useState('')
  const [dueDateText, setDueDateText] = useState('')
  const [amountMajor, setAmountMajor] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleRef = useRef<HTMLInputElement>(null)
  const today = localToday()
  const isEditing = !!milestoneToEdit

  useEscapeLayer(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      if (milestoneToEdit) {
        setTitle(milestoneToEdit.title)
        setDueDateText(milestoneToEdit.dueDate || '')
        setAmountMajor(
          milestoneToEdit.amountMinor ? (milestoneToEdit.amountMinor / 100).toString() : ''
        )
      } else {
        setTitle('')
        setDueDateText('')
        setAmountMajor('')
      }
      setError(null)
      setTimeout(() => titleRef.current?.focus(), 50)
    }
  }, [isOpen, milestoneToEdit])

  if (!isOpen) return null

  const resolvedDueDate = dueDateText.trim()
    ? parseDateInput(dueDateText.trim(), today) || dueDateText.trim()
    : null

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      const parsedAmount = amountMajor.trim()
        ? Math.round(parseFloat(amountMajor.replace(',', '.')) * 100)
        : null

      await onSave({
        id: milestoneToEdit?.id,
        title: title.trim(),
        dueDate: resolvedDueDate,
        amountMinor: parsedAmount,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save milestone')
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
        className="w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Milestone' : 'New Milestone'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Milestone Title
            </label>
            <input
              ref={titleRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Design Concepts, Final Handover"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">Due Date</label>
            <input
              type="text"
              value={dueDateText}
              onChange={(e) => setDueDateText(e.target.value)}
              placeholder='e.g. "today", "+2w", or "2026-11-15"'
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
            />
            {resolvedDueDate && (
              <div className="text-[10px] text-slate-400 pl-1">Resolves to: {resolvedDueDate}</div>
            )}
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Amount ({currency})
            </label>
            <input
              type="text"
              value={amountMajor}
              onChange={(e) => setAmountMajor(e.target.value)}
              placeholder="Optional milestone budget"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100 font-mono"
            />
          </div>
        </div>

        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-end gap-2">
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
            disabled={isSubmitting}
            className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
          >
            {isEditing ? 'Save changes' : 'Create milestone'} (⌘↵)
          </button>
        </div>
      </div>
    </div>
  )
}
