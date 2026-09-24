'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Mail,
  Send,
  Trash2,
  ChevronRight,
  ExternalLink,
  Edit3,
} from 'lucide-react'
import { Deal, DealStage } from '@/lib/crm-types'

interface DealDetailDrawerProps {
  deal: Deal | null
  isOpen: boolean
  onClose: () => void
  onUpdateDeal: (deal: Deal) => void
  onDeleteDeal?: (id: string) => void
}

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Scope', 'Quote sent', 'Negotiation', 'Won']

export function DealDetailDrawer({
  deal,
  isOpen,
  onClose,
  onUpdateDeal,
  onDeleteDeal,
}: DealDetailDrawerProps) {
  const [currentDeal, setCurrentDeal] = useState<Deal | null>(deal)
  const [isEditingNotes, setIsEditingNotes] = useState(false)
  const [notes, setNotes] = useState('')

  useEffect(() => {
    setCurrentDeal(deal)
    if (deal) {
      setNotes(deal.notes || '')
    }
  }, [deal])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !currentDeal) return null

  const handleStageChange = (newStage: DealStage) => {
    const updated: Deal = {
      ...currentDeal,
      stage: newStage,
      probability: newStage === 'Won' ? '100%' : currentDeal.probability,
      color:
        newStage === 'Won'
          ? 'green'
          : newStage === 'Qualified'
          ? 'amber'
          : newStage === 'Scope' || newStage === 'Negotiation'
          ? 'violet'
          : 'blue',
    }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
  }

  const handleSaveNotes = () => {
    const updated = { ...currentDeal, notes }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
    setIsEditingNotes(false)
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#10141c]/40 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="absolute inset-y-0 right-0 max-w-full flex pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-md bg-white border-l border-[#e4e7ec] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* Topbar of Drawer */}
          <div className="p-5 border-b border-[#edf0f3] flex items-center justify-between bg-[#fafbfc]">
            <div className="flex items-center gap-2">
              <span
                className={`w-7 h-7 rounded-lg flex items-center justify-center text-[12px] font-bold ${
                  currentDeal.color === 'violet'
                    ? 'bg-[#f0eaff] text-[#805ad5]'
                    : currentDeal.color === 'amber'
                    ? 'bg-[#fff3df] text-[#c4882b]'
                    : currentDeal.color === 'green'
                    ? 'bg-[#e7f6ee] text-[#43a878]'
                    : 'bg-[#e9f0ff] text-[#266df0]'
                }`}
              >
                {currentDeal.company.charAt(0)}
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f99a8] block">
                  Opportunity Drawer
                </span>
                <span className="text-[12px] font-semibold text-[#1c1d1f]">
                  {currentDeal.company}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#8f99a8] bg-[#f4f5f6] border border-[#e4e7ec] rounded mr-1">
                ESC
              </kbd>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title & Value */}
            <div>
              <h1 className="text-[20px] font-bold text-[#1c1d1f] tracking-tight leading-snug">
                {currentDeal.title}
              </h1>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-[28px] font-bold font-mono tabular-nums text-[#1c1d1f] tracking-tight">
                  {currentDeal.value}
                </span>
                <span className="px-2 py-0.5 text-[11px] font-bold rounded-md bg-[#e7f6ee] text-[#43a878] font-mono">
                  {currentDeal.probability} prob.
                </span>
              </div>
            </div>

            {/* Stage Selector */}
            <div className="space-y-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                Pipeline Stage
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {STAGES.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleStageChange(s)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all border text-center ${
                      currentDeal.stage === s
                        ? 'bg-[#1c1d1f] text-white border-[#1c1d1f] shadow-xs'
                        : 'bg-white text-[#505967] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Mandatory Next Action (GTD Rule) */}
            <div className="p-4 bg-[#f8faff] border border-[#d6e3fc] rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
                  <AlertCircle size={14} />
                  <span>Mandatory Next Action</span>
                </div>
                <span className="text-[10px] font-semibold text-[#266df0] bg-[#e9f0ff] px-2 py-0.5 rounded">
                  {currentDeal.nextDueDate || 'Scheduled'}
                </span>
              </div>
              <p className="text-[13px] font-semibold text-[#1c1d1f]">{currentDeal.next}</p>
            </div>

            {/* Contact Information */}
            <div className="space-y-2 pt-2 border-t border-[#f0f1f3]">
              <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                Primary Contact
              </span>
              <div className="p-3 bg-[#fafbfc] border border-[#edf0f3] rounded-xl flex items-center justify-between">
                <div>
                  <div className="text-[13px] font-semibold text-[#1c1d1f]">
                    {currentDeal.contactName || currentDeal.company}
                  </div>
                  <div className="text-[11px] text-[#6f7988]">
                    {currentDeal.contactEmail || `contact@${currentDeal.company.toLowerCase().replace(/\s+/g, '')}.cz`}
                  </div>
                </div>
                <a
                  href={`mailto:${currentDeal.contactEmail || 'client@example.cz'}`}
                  className="w-8 h-8 rounded-lg bg-white border border-[#e4e7ec] text-[#266df0] hover:bg-[#e9f0ff] flex items-center justify-center transition-colors"
                  title="Send email"
                >
                  <Mail size={15} />
                </a>
              </div>
            </div>

            {/* Meeting Scratchpad / Scoping Notes */}
            <div className="space-y-2 pt-2 border-t border-[#f0f1f3]">
              <div className="flex items-center justify-between">
                <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                  Scoping Scratchpad & Meeting Notes
                </span>
                {!isEditingNotes && (
                  <button
                    onClick={() => setIsEditingNotes(true)}
                    className="text-[11px] font-semibold text-[#266df0] hover:underline flex items-center gap-1"
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                )}
              </div>

              {isEditingNotes ? (
                <div className="space-y-2">
                  <textarea
                    rows={5}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="w-full p-3 border border-[#e4e7ec] rounded-lg text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none leading-relaxed"
                    placeholder="Enter call notes or scope requirements..."
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setIsEditingNotes(false)}
                      className="px-2.5 py-1 text-[11px] text-[#6f7988]"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveNotes}
                      className="px-3 py-1 bg-[#1c1d1f] text-white text-[11px] font-semibold rounded-md shadow-xs"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 bg-[#fafbfc] border border-[#edf0f3] rounded-xl text-[12px] text-[#505967] leading-relaxed whitespace-pre-wrap">
                  {currentDeal.notes || (
                    <span className="text-[#9fa1a7] italic">
                      No scratchpad notes logged yet. Click edit to log meeting notes or scope items.
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between">
            {onDeleteDeal && (
              <button
                onClick={() => {
                  onDeleteDeal(currentDeal.id)
                  onClose()
                }}
                className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#d73a49] hover:text-[#b31d28] p-1.5 rounded"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => handleStageChange('Won')}
                disabled={currentDeal.stage === 'Won'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#e7f6ee] hover:bg-[#d5eedf] text-[#43a878] text-[11px] font-bold rounded-lg transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={14} />
                <span>{currentDeal.stage === 'Won' ? 'Won' : 'Mark as Won'}</span>
              </button>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#1c1d1f] text-white text-[11px] font-semibold rounded-lg shadow-xs hover:bg-[#000] transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
