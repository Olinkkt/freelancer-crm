'use client'

import React, { useRef } from 'react'
import { CalendarDays } from 'lucide-react'
import { dueDatePresets, formatDue, nextActionPresets } from '@/lib/due-date'

interface NextActionFieldsProps {
  stage: string
  action: string
  dueDate: string
  onActionChange: (value: string) => void
  onDueDateChange: (value: string) => void
  autoFocusAction?: boolean
}

/**
 * What to do next + when. The action reads like a line of text (no input box),
 * suggestions follow the stage, and the date is one segmented control.
 */
export function NextActionFields({
  stage,
  action,
  dueDate,
  onActionChange,
  onDueDateChange,
  autoFocusAction,
}: NextActionFieldsProps) {
  const dateRef = useRef<HTMLInputElement>(null)
  const presets = nextActionPresets(stage)
  const datePresets = dueDatePresets()
  const isCustomDate = !!dueDate && !datePresets.some((p) => p.value === dueDate)

  const openPicker = () => {
    const el = dateRef.current
    if (!el) return
    if (typeof el.showPicker === 'function') el.showPicker()
    else el.focus()
  }

  return (
    <div className="space-y-3">
      <div>
        <input
          type="text"
          value={action}
          autoFocus={autoFocusAction}
          maxLength={200}
          onChange={(e) => onActionChange(e.target.value)}
          placeholder="What's the next step?"
          aria-label="Next action"
          className="w-full bg-transparent border-0 border-b border-transparent hover:border-[#e4e7ec] focus:border-[#1c1d1f] px-0 py-1 text-[15px] font-medium text-[#1c1d1f] placeholder:text-[#9fa1a7] placeholder:font-normal focus:outline-none focus:ring-0 transition-colors"
        />
        {presets.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1.5 text-[11px]">
            {presets.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onActionChange(p)}
                className={`cursor-pointer transition-colors ${
                  action === p ? 'text-[#1c1d1f] font-semibold' : 'text-[#8f99a8] hover:text-[#1c1d1f]'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative inline-flex items-center gap-0.5 p-0.5 rounded-[9px] bg-[#f0f2f5] text-[11px] font-medium">
        {datePresets.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => onDueDateChange(p.value)}
            className={`px-2.5 py-1 rounded-[7px] cursor-pointer transition-all ${
              dueDate === p.value
                ? 'bg-white text-[#1c1d1f] font-semibold shadow-xs'
                : 'text-[#6f7988] hover:text-[#1c1d1f]'
            }`}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          onClick={openPicker}
          aria-label="Pick a date"
          className={`flex items-center gap-1 px-2.5 py-1 rounded-[7px] cursor-pointer transition-all ${
            isCustomDate
              ? 'bg-white text-[#1c1d1f] font-semibold shadow-xs'
              : 'text-[#6f7988] hover:text-[#1c1d1f]'
          }`}
        >
          <CalendarDays size={12} />
          {isCustomDate ? formatDue(dueDate) : 'Pick'}
        </button>
        <input
          ref={dateRef}
          type="date"
          value={dueDate}
          onChange={(e) => e.target.value && onDueDateChange(e.target.value)}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute right-0 bottom-0 w-0 h-0 opacity-0 pointer-events-none"
        />
      </div>
    </div>
  )
}
