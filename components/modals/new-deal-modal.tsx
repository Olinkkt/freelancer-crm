'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, CirclePlus, ArrowUpRight, Calendar, AlertCircle } from 'lucide-react'
import { Contact, Deal, DealStage, DEAL_STAGE_HINTS, WorkspaceSettings, isPmStage } from '@/lib/crm-types'
import { StageOptions } from '@/components/deals/stage-options'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'
import { Combobox } from '@/components/ui/combobox'
import { NextActionFields } from '@/components/deals/next-action-fields'
import { addDays, isUntouchedPreset, nextActionPresets, normalizeDueDate } from '@/lib/due-date'
import { getDateString } from '@/lib/date-utils'

interface NewDealModalProps {
  isOpen: boolean
  onClose: () => void
  onAddDeal: (deal: Omit<Deal, 'id'>) => void
  /** Existing clients; typing a new name creates a client on save */
  clients: Contact[]
  initialClientName?: string
  dealToEdit?: Deal | null
  onUpdateDeal?: (deal: Deal) => void
  settings?: WorkspaceSettings
}

export function NewDealModal({
  isOpen,
  onClose,
  onAddDeal,
  clients,
  initialClientName,
  dealToEdit,
  onUpdateDeal,
  settings,
}: NewDealModalProps) {
  const [title, setTitle] = useState('')
  const [clientName, setClientName] = useState('')
  const [value, setValue] = useState('')
  const [stage, setStage] = useState<DealStage>('Lead')
  const [nextAction, setNextAction] = useState('')
  const [nextDueDate, setNextDueDate] = useState(getDateString(addDays(new Date(), 1)))
  const [waiting, setWaiting] = useState(false)
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)
  const titleInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setError(null)
      if (dealToEdit) {
        setTitle(dealToEdit.title || '')
        setClientName(dealToEdit.contactName || initialClientName || '')
        setValue(dealToEdit.value || '')
        setStage(dealToEdit.stage || 'Lead')
        setNextAction(dealToEdit.waiting ? '' : dealToEdit.next || '')
        setNextDueDate(normalizeDueDate(dealToEdit.nextDueDate) || getDateString(addDays(new Date(), 1)))
        setWaiting(!!dealToEdit.waiting)
        setNotes(dealToEdit.notes || '')
      } else {
        setTitle('')
        setClientName(initialClientName || '')
        setValue(formatMoney(25000, settings))
        setStage('Lead')
        setNextAction(nextActionPresets('Lead')[0])
        setNextDueDate(getDateString(addDays(new Date(), 1)))
        setWaiting(false)
        setNotes('')
      }
      setTimeout(() => {
        titleInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, initialClientName, dealToEdit, settings])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim() || !clientName.trim()) return

    // Link to an existing client by name; otherwise the server creates one
    const typedName = clientName.trim()
    const existingClient =
      (dealToEdit?.contactId && dealToEdit.contactName.trim().toLowerCase() === typedName.toLowerCase()
        ? clients.find((c) => c.id === dealToEdit.contactId)
        : undefined) || clients.find((c) => c.name.trim().toLowerCase() === typedName.toLowerCase())
    const clientFields = {
      contactId: existingClient?.id,
      contactName: existingClient?.name || typedName,
      contactEmail: existingClient ? existingClient.email || undefined : undefined,
    }

    // Guard against negative amounts
    if (/-\s*\d+/.test(value.trim())) {
      setError('Deal value cannot be negative')
      return
    }

    // Clean number from value
    const numeric = parseInt(value.replace(/[^0-9]/g, '')) || 0
    const formattedVal = formatMoney(numeric, settings)

    // Signed deals (Closed and every PM stage after it) are green
    const stageColor: Deal['color'] = isPmStage(stage) ? 'green' : 'blue'

    if (dealToEdit && onUpdateDeal) {
      onUpdateDeal({
        ...dealToEdit,
        title: title.trim(),
        ...clientFields,
        value: formattedVal || '—',
        rawAmount: numeric,
        stage,
        next: waiting ? 'Waiting on client' : nextAction.trim(),
        nextDueDate: waiting ? undefined : nextDueDate || undefined,
        waiting,
        color: stageColor || dealToEdit.color || 'blue',
        notes: notes.trim(),
      })
    } else {
      onAddDeal({
        title: title.trim(),
        ...clientFields,
        value: formattedVal || '—',
        rawAmount: numeric,
        stage,
        next: waiting ? 'Waiting on client' : nextAction.trim() || 'Schedule next step',
        nextDueDate: waiting ? undefined : nextDueDate || getDateString(addDays(new Date(), 1)),
        waiting,
        color: stageColor || 'blue',
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30"
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
              {dealToEdit ? 'Edit deal' : 'New deal'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
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
                Client *
              </label>
              <Combobox
                value={clientName}
                onChange={setClientName}
                options={clients.map((c) => ({
                  id: c.id,
                  label: c.name,
                  value: c.name,
                  sublabel: c.email || undefined,
                }))}
                placeholder="Choose or add a client"
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

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Pipeline Stage
            </label>
            <select
              value={stage}
              onChange={(e) => {
                const newStage = e.target.value as DealStage
                setStage(newStage)
                if (!dealToEdit && isUntouchedPreset(nextAction)) {
                  setNextAction(nextActionPresets(newStage)[0] ?? '')
                }
              }}
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            >
              <StageOptions />
            </select>
            <p className="mt-1 text-[11px] text-[#8f99a8]">{DEAL_STAGE_HINTS[stage]}</p>
          </div>

          {/* Mandatory Next Action GTD Prompt */}
          <div className="p-3.5 bg-[#fafbfc] border border-[#e4e7ec] rounded-[12px] space-y-2">
            <div className="flex items-center justify-between text-[11px] font-bold text-[#505967] uppercase tracking-wider">
              <div className="flex items-center gap-1.5">
                <AlertCircle size={14} />
                <span>Next Action</span>
              </div>
              <label className="flex items-center gap-1.5 normal-case tracking-normal font-medium text-[#505967] cursor-pointer">
                <input type="checkbox" checked={waiting} onChange={(e) => {
                    setWaiting(e.target.checked)
                    if (e.target.checked && nextAction.trim() === '') return
                    if (!e.target.checked && nextAction === 'Waiting on client') setNextAction('')
                  }} />
                Waiting on client
              </label>
            </div>
            {waiting ? (
              <p className="text-[13px] font-medium text-[#1c1d1f]">Waiting on client</p>
            ) : (
              <NextActionFields
                stage={stage}
                action={nextAction}
                dueDate={nextDueDate}
                onActionChange={setNextAction}
                onDueDateChange={setNextDueDate}
              />
            )}
          </div>

          <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Notes
              </label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Initial requirements, key contacts, or budget parameters..."
                className="w-full p-3 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none"
              />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span />
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
                disabled={!title.trim() || !clientName.trim()}
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
