'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CirclePlus, ArrowUpRight, Calendar, AlertCircle } from 'lucide-react'
import { Deal, DealStage, Company } from '@/lib/crm-types'

interface NewDealModalProps {
  isOpen: boolean
  onClose: () => void
  onAddDeal: (deal: Omit<Deal, 'id'>) => void
  companies: Company[]
}

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Scope', 'Quote sent', 'Negotiation', 'Won']

export function NewDealModal({ isOpen, onClose, onAddDeal, companies }: NewDealModalProps) {
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('Lead')
  const [probability, setProbability] = useState('30%')
  const [nextAction, setNextAction] = useState('')
  const [nextDueDate, setNextDueDate] = useState('Tomorrow, 10:00')
  const [notes, setNotes] = useState('')
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTitle('')
      setCompany(companies[0]?.name || '')
      setValue('25 000 Kč')
      setStage('Lead')
      setProbability('30%')
      setNextAction('Send intro email & discovery questionnaire')
      setNextDueDate('Tomorrow, 10:00')
      setNotes('')
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, companies])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || !company.trim()) return

    // Clean number from value
    const numeric = parseInt(value.replace(/[^0-9]/g, '')) || 0
    const formattedVal = value.includes('Kč') ? value.trim() : `${value.trim()} Kč`

    const colorMap: Record<DealStage, Deal['color']> = {
      Lead: 'blue',
      Qualified: 'amber',
      Scope: 'violet',
      'Quote sent': 'blue',
      Negotiation: 'violet',
      Won: 'green',
    }

    onAddDeal({
      title: title.trim(),
      company: company.trim(),
      value: formattedVal || '—',
      rawAmount: numeric,
      stage,
      probability,
      next: nextAction.trim() || 'Schedule next step',
      nextDueDate: nextDueDate.trim() || 'This week',
      color: colorMap[stage] || 'blue',
      notes: notes.trim(),
      createdAt: 'Just now',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/50 backdrop-blur-sm transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#e9f0ff] text-[#266df0] rounded border border-[#d6e3fc]">
              Hotkey: N
            </span>
            <h2 className="text-[16px] font-bold text-[#1c1d1f] tracking-tight">
              Create New Deal
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Deal Title *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brand Identity & CMS Build"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Company Account *
              </label>
              <input
                list="company-list"
                required
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Select or enter company"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
              <datalist id="company-list">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Value (Kč)
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="25 000 Kč"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] font-mono tabular-nums text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Pipeline Stage
              </label>
              <select
                value={stage}
                onChange={(e) => setStage(e.target.value as DealStage)}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              >
                {STAGES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Win Probability
              </label>
              <select
                value={probability}
                onChange={(e) => setProbability(e.target.value)}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              >
                <option value="20%">20% — Low</option>
                <option value="40%">40% — Qualified</option>
                <option value="60%">60% — In Scoping</option>
                <option value="80%">80% — Proposal Out</option>
                <option value="90%">90% — Verbal OK</option>
                <option value="100%">100% — Won</option>
              </select>
            </div>
          </div>

          {/* Mandatory Next Action GTD Prompt */}
          <div className="p-3.5 bg-[#f8faff] border border-[#d6e3fc] rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>Mandatory Next Action (GTD Rule)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Send revised scope"
                className="w-full h-9 px-2.5 bg-white border border-[#dbe6fe] rounded-lg text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
              />
              <input
                type="text"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                placeholder="e.g. Tomorrow 14:30"
                className="w-full h-9 px-2.5 bg-white border border-[#dbe6fe] rounded-lg text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
              />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Operator Notes / Scoping scratchpad
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Initial requirements, key contacts, or budget parameters..."
              className="w-full p-3 border border-[#e4e7ec] rounded-lg text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#9fa1a7] font-mono">
              Press <kbd className="px-1 bg-[#f4f5f6] border rounded text-[10px]">⌘</kbd> +{' '}
              <kbd className="px-1 bg-[#f4f5f6] border rounded text-[10px]">↵</kbd> to save
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-[12px] font-semibold text-[#6f7988] hover:text-[#1c1d1f] rounded-lg"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !company.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-semibold rounded-lg shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CirclePlus size={15} />
                <span>Save Deal</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
