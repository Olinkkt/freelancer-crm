'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CheckSquare, Building2, Clock, Calendar } from 'lucide-react'
import { FollowUpItem } from '@/lib/crm-types'

interface EditFollowUpModalProps {
  isOpen: boolean
  onClose: () => void
  followUp: FollowUpItem | null
  onUpdateFollowUp: (updated: FollowUpItem) => void
}

export function EditFollowUpModal({
  isOpen,
  onClose,
  followUp,
  onUpdateFollowUp,
}: EditFollowUpModalProps) {
  const [action, setAction] = useState('')
  const [company, setCompany] = useState('')
  const [day, setDay] = useState('Today')
  const [time, setTime] = useState('10:00')
  const actionInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && followUp) {
      setAction(followUp.action || '')
      setCompany(followUp.company || '')
      setDay(followUp.day || 'Today')
      setTime(followUp.time || '10:00')
      setTimeout(() => {
        actionInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, followUp])

  if (!isOpen || !followUp) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!action.trim()) return

    onUpdateFollowUp({
      ...followUp,
      action: action.trim(),
      company: company.trim() || 'Workspace',
      day: (day.trim() as FollowUpItem['day']) || 'Today',
      time: time.trim() || '10:00',
    })

    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30 backdrop-blur-xs transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#eef2f6] text-[#1c1d1f] flex items-center justify-center">
              <CheckSquare size={16} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#1c1d1f]">Edit Follow-up Item</h2>
              <p className="text-[11px] text-[#6f7988]">Update GTD next action details</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8f99a8] hover:text-[#1c1d1f] p-1 rounded-md hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#505967] mb-1">
              Action Description <span className="text-red-500">*</span>
            </label>
            <input
              ref={actionInputRef}
              type="text"
              required
              placeholder="e.g. Send contract draft & scope approval"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#505967] mb-1">
              Company / Client
            </label>
            <input
              type="text"
              placeholder="e.g. Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#505967] mb-1">
                Day / Schedule
              </label>
              <input
                type="text"
                placeholder="Today / Tomorrow / Friday"
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#505967] mb-1">
                Time
              </label>
              <input
                type="text"
                placeholder="10:00"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-[#edf0f3]">
            <span className="text-[10px] text-[#8f99a8] flex items-center gap-1 font-mono">
              <kbd className="px-1 py-0.5 bg-[#f0f2f5] border border-[#dce0e5] rounded text-[9px]">
                ⌘
              </kbd>
              <kbd className="px-1 py-0.5 bg-[#f0f2f5] border border-[#dce0e5] rounded text-[9px]">
                ↵
              </kbd>
              save
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] font-medium text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] rounded-[7px] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!action.trim()}
                className="px-3.5 py-1.5 text-[12px] font-medium bg-[#232529] hover:bg-[#101113] text-white rounded-[7px] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save changes
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
