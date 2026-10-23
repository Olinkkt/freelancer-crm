'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Calendar, X, Check } from 'lucide-react'
import { parseDateInput, localToday, addDays } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

interface DueDatePopoverProps {
  currentDueDate: string | null
  isOpen: boolean
  onClose: () => void
  onSaveDueDate: (dueDate: string | null) => void
}

export function DueDatePopover({
  currentDueDate,
  isOpen,
  onClose,
  onSaveDueDate,
}: DueDatePopoverProps) {
  const [text, setText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const today = localToday()

  useEscapeLayer(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      setText('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const resolvedDate = text.trim() ? parseDateInput(text.trim(), today) : null

  const handleApply = (date: string | null) => {
    onSaveDueDate(date)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (resolvedDate) {
        handleApply(resolvedDate)
      } else if (!text.trim()) {
        handleApply(null)
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[1px] p-4">
      <div
        className="w-full max-w-xs bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 p-3.5 space-y-3 animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between text-xs font-semibold text-slate-800 dark:text-slate-200">
          <div className="flex items-center gap-1.5">
            <Calendar size={13} className="text-blue-500" />
            <span>Set due date</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={14} />
          </button>
        </div>

        {/* Input field */}
        <div className="space-y-1">
          <input
            ref={inputRef}
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='Type "fri", "+2w", or "25.11"'
            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium"
          />
          {text.trim() && (
            <div className="text-[11px] px-1 font-medium text-slate-500 dark:text-slate-400">
              {resolvedDate ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Resolves to: {resolvedDate}
                </span>
              ) : (
                <span className="text-amber-500">Unrecognized date expression</span>
              )}
            </div>
          )}
        </div>

        {/* Quick Tokens */}
        <div className="grid grid-cols-2 gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => handleApply(today)}
            className="px-2 py-1.5 text-left rounded-md bg-slate-50 dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
          >
            <span>Today</span>
            <span className="text-[10px] text-slate-400">today</span>
          </button>
          <button
            type="button"
            onClick={() => handleApply(addDays(today, 1))}
            className="px-2 py-1.5 text-left rounded-md bg-slate-50 dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
          >
            <span>Tomorrow</span>
            <span className="text-[10px] text-slate-400">+1d</span>
          </button>
          <button
            type="button"
            onClick={() => {
              const date = parseDateInput('fri', today)
              if (date) handleApply(date)
            }}
            className="px-2 py-1.5 text-left rounded-md bg-slate-50 dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
          >
            <span>Friday</span>
            <span className="text-[10px] text-slate-400">fri</span>
          </button>
          <button
            type="button"
            onClick={() => handleApply(addDays(today, 7))}
            className="px-2 py-1.5 text-left rounded-md bg-slate-50 dark:bg-slate-750 hover:bg-blue-50 dark:hover:bg-blue-950/40 text-slate-700 dark:text-slate-300 transition-colors flex items-center justify-between"
          >
            <span>In 1 week</span>
            <span className="text-[10px] text-slate-400">+1w</span>
          </button>
        </div>

        {/* Clear Date */}
        {currentDueDate && (
          <div className="pt-1 border-t border-slate-100 dark:border-slate-700/60">
            <button
              type="button"
              onClick={() => handleApply(null)}
              className="w-full px-2 py-1 text-center text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md transition-colors"
            >
              Clear due date
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
