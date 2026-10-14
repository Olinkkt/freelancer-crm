'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CirclePlus, ArrowUpRight, Calendar, AlertCircle } from 'lucide-react'
import { Deal, DealStage, STAGE_DEFAULT_PROBABILITIES, Company, WorkspaceSettings } from '@/lib/crm-types'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'
import { Combobox } from '@/components/ui/combobox'

interface NewDealModalProps {
  isOpen: boolean
  onClose: () => void
  onAddDeal: (deal: Omit<Deal, 'id'>) => void
  companies: Company[]
  initialCompany?: string
  dealToEdit?: Deal | null
  onUpdateDeal?: (deal: Deal) => void
  settings?: WorkspaceSettings
}

const STAGES: DealStage[] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Paid',
]

export function NewDealModal({
  isOpen,
  onClose,
  onAddDeal,
  companies,
  initialCompany,
  dealToEdit,
  onUpdateDeal,
  settings,
}: NewDealModalProps) {
  const [mode, setMode] = useState<'quick' | 'detailed'>('quick')
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('Lead')
  const [probability, setProbability] = useState('20%')
  const [nextAction, setNextAction] = useState('')
  const [nextDueDate, setNextDueDate] = useState('Tomorrow, 10:00')
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      if (dealToEdit) {
        setMode('detailed')
        setTitle(dealToEdit.title || '')
        setCompany(dealToEdit.company || initialCompany || '')
        setValue(dealToEdit.value || '')
        setStage(dealToEdit.stage || 'Lead')
        setProbability(dealToEdit.probability || STAGE_DEFAULT_PROBABILITIES[dealToEdit.stage || 'Lead'] || '20%')
        setNextAction(dealToEdit.next || '')
        setNextDueDate(dealToEdit.nextDueDate || '')
        setNotes(dealToEdit.notes || '')
      } else {
        setMode('quick')
        setTitle('')
        setCompany(initialCompany || '')
        setValue(formatMoney(25000, settings))
        setStage('Lead')
        setProbability(STAGE_DEFAULT_PROBABILITIES['Lead'])
        setNextAction('Discovery call & initial scope review')
        setNextDueDate('Tomorrow, 10:00')
        setNotes('')
      }
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, companies, initialCompany, dealToEdit, settings])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || !company.trim()) return

    // Guard against negative amounts
    if (/-\s*\d+/.test(value.trim())) {
      setError('Deal value cannot be negative')
      return
    }

    // Clean number from value
    const numeric = parseInt(value.replace(/[^0-9]/g, '')) || 0
    const formattedVal = formatMoney(numeric, settings)

    const colorMap: Record<DealStage, Deal['color']> = {
      Lead: 'blue',
      Qualified: 'blue',
      Proposal: 'blue',
      Won: 'green',
      Paid: 'green',
    }

    const isPaid = stage === 'Paid'

    if (dealToEdit && onUpdateDeal) {
      onUpdateDeal({
        ...dealToEdit,
        title: title.trim(),
        company: company.trim(),
        value: formattedVal || '—',
        rawAmount: numeric,
        stage,
        probability,
        next: isPaid ? '' : nextAction.trim(),
        nextDueDate: isPaid ? undefined : nextDueDate.trim(),
        color: colorMap[stage] || dealToEdit.color || 'blue',
        notes: notes.trim(),
      })
    } else {
      onAddDeal({
        title: title.trim(),
        company: company.trim(),
        value: formattedVal || '—',
        rawAmount: numeric,
        stage: mode === 'quick' ? 'Lead' : stage,
        probability: mode === 'quick' ? '20%' : probability,
        next: isPaid ? '' : (nextAction.trim() || 'Schedule next step'),
        nextDueDate: isPaid ? undefined : (nextDueDate.trim() || 'This week'),
        color: colorMap[mode === 'quick' ? 'Lead' : stage] || 'blue',
        notes: notes.trim(),
        createdAt: 'Just now',
      })
    }

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
        className="w-full max-w-lg bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-[#e9f0ff] text-[#266df0] rounded-[7px] border border-[#d6e3fc]">
              Hotkey: N
            </span>
            <h2 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">
              {dealToEdit ? 'Edit Deal' : 'Capture Opportunity'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!dealToEdit && (
              <div className="flex items-center bg-[#f0f2f5] p-0.5 rounded-[8px] text-[11px] font-medium">
                <button
                  type="button"
                  onClick={() => setMode('quick')}
                  className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                    mode === 'quick'
                      ? 'bg-white text-[#1c1d1f] font-semibold shadow-xs'
                      : 'text-[#6f7988] hover:text-[#1c1d1f]'
                  }`}
                >
                  ⚡ Quick (5s)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('detailed')}
                  className={`px-2.5 py-1 rounded-[6px] transition-all cursor-pointer ${
                    mode === 'detailed'
                      ? 'bg-white text-[#1c1d1f] font-semibold shadow-xs'
                      : 'text-[#6f7988] hover:text-[#1c1d1f]'
                  }`}
                >
                  Detailed
                </button>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[12px] rounded-[8px]">
              <AlertCircle size={14} className="shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Deal Title *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              required
              maxLength={100}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Brand Identity & CMS Build"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Company Account *
              </label>
              <Combobox
                value={company}
                onChange={setCompany}
                options={companies.map((c) => ({
                  id: c.id,
                  label: c.name,
                  value: c.name,
                  sublabel: c.type,
                }))}
                placeholder="Select or enter company"
                required
                maxLength={100}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Value ({settings?.currencySymbol?.trim() || OPERATOR_CONFIG.currencySymbol || '$'})
              </label>
              <input
                type="text"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={formatMoney(25000, settings)}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] font-mono tabular-nums text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
            </div>
          </div>

          {/* Detailed Mode: Pipeline Stage & Probability */}
          {mode === 'detailed' && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in duration-150">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                  Pipeline Stage
                </label>
                <select
                  value={stage}
                  onChange={(e) => {
                    const newStage = e.target.value as DealStage
                    setStage(newStage)
                    setProbability(STAGE_DEFAULT_PROBABILITIES[newStage])
                  }}
                  className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
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
                  className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
                >
                  <option value="20%">20% — Lead</option>
                  <option value="40%">40% — Qualified</option>
                  <option value="70%">70% — Proposal</option>
                  <option value="100%">100% — Won / Paid</option>
                </select>
              </div>
            </div>
          )}

          {/* Mandatory Next Action GTD Prompt (hidden when stage is Paid) */}
          {stage !== 'Paid' && (
            <div className="p-3.5 bg-[#f8faff] border border-[#d6e3fc] rounded-[12px] space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
                <div className="flex items-center gap-1.5">
                  <AlertCircle size={14} />
                  <span>Mandatory Next Action (GTD Rule)</span>
                </div>
                {mode === 'quick' && (
                  <span className="text-[10px] lowercase font-normal text-[#6f7988]">auto-defaults to Lead</span>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  type="text"
                  value={nextAction}
                  onChange={(e) => setNextAction(e.target.value)}
                  placeholder="e.g. Send revised scope"
                  className="w-full h-9 px-2.5 bg-white border border-[#dbe6fe] rounded-[10px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
                />
                <input
                  type="text"
                  value={nextDueDate}
                  onChange={(e) => setNextDueDate(e.target.value)}
                  placeholder="e.g. Tomorrow 14:30"
                  className="w-full h-9 px-2.5 bg-white border border-[#dbe6fe] rounded-[10px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
                />
              </div>
            </div>
          )}

          {/* Detailed Mode: Operator Notes */}
          {mode === 'detailed' && (
            <div className="animate-in fade-in duration-150">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Operator Notes / Scoping scratchpad
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Initial requirements, key contacts, or budget parameters..."
                className="w-full p-3 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none"
              />
            </div>
          )}

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#9fa1a7] font-mono">
              Press <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">⌘</kbd> +{' '}
              <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">↵</kbd> to save
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-[12px] font-medium text-[#6f7988] hover:text-[#1c1d1f] rounded-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!title.trim() || !company.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-medium rounded-[10px] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <CirclePlus size={15} />
                <span>{dealToEdit ? 'Save Changes' : 'Save Deal'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
