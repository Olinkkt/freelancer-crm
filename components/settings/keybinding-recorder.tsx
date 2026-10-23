'use client'

import React, { useEffect, useRef, useState } from 'react'
import { eventToStep, formatStep } from '@/lib/shortcuts/keys'
import type { Platform } from '@/lib/shortcuts/types'

interface KeybindingRecorderProps {
  onComplete: (binding: string) => void
  onCancel: () => void
  platform: Platform
}

export function KeybindingRecorder({
  onComplete,
  onCancel,
  platform,
}: KeybindingRecorderProps) {
  const [firstStep, setFirstStep] = useState<string | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (e.key === 'Escape') {
      if (timerRef.current) clearTimeout(timerRef.current)
      onCancel()
      return
    }

    const step = eventToStep(e.nativeEvent, platform)
    if (!step) {
      // Bare modifier press; wait for full key
      return
    }

    setFirstStep((prev) => {
      if (!prev) {
        // First step captured; start 1000ms timer
        timerRef.current = setTimeout(() => {
          onComplete(step)
        }, 1000)
        return step
      } else {
        // Second step captured within 1000ms
        if (timerRef.current) clearTimeout(timerRef.current)
        onComplete(`${prev} ${step}`)
        return null
      }
    })
  }

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      autoFocus
      onKeyDown={handleKeyDown}
      className="inline-flex items-center gap-2 px-2.5 py-1 bg-[#266df0]/10 border border-[#266df0] text-[#266df0] rounded-[6px] text-[12px] font-medium animate-pulse outline-none focus:ring-2 focus:ring-[#266df0]"
    >
      <span>Press new shortcut…</span>
      {firstStep && (
        <span className="font-mono font-bold bg-[#266df0] text-white px-1.5 py-0.5 rounded text-[10px]">
          {formatStep(firstStep, platform)} …
        </span>
      )}
      <span className="text-[11px] text-[#6f7988]">(Esc to cancel)</span>
    </div>
  )
}
