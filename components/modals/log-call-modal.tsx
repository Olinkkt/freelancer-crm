'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, PhoneCall, Calendar, AlertCircle, Sparkles, MessageSquare } from 'lucide-react'
import { Activity, Company, Contact, FollowUpItem } from '@/lib/crm-types'

interface LogCallModalProps {
  isOpen: boolean
  onClose: () => void
  onLogActivity: (
    activity: Omit<Activity, 'id'>,
    followUp?: Omit<FollowUpItem, 'id'>
  ) => void
  companies: Company[]
  contacts: Contact[]
}

export function LogCallModal({
  isOpen,
  onClose,
  onLogActivity,
  companies,
  contacts,
}: LogCallModalProps) {
  const [type, setType] = useState<Activity['type']>('Call')
  const [person, setPerson] = useState('')
  const [company, setCompany] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextDue, setNextDue] = useState('Tomorrow, 10:00')
  const notesRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (isOpen) {
      setType('Call')
      setPerson(contacts[0]?.name || '')
      setCompany(contacts[0]?.company || companies[0]?.name || '')
      setTitle('Client check-in call')
      setSummary('')
      setNextAction('Send follow-up summary')
      setNextDue('Today, 17:00')
      setTimeout(() => {
        notesRef.current?.focus()
      }, 50)
    }
  }, [isOpen, contacts, companies])

  if (!isOpen) return null

  // Fast snippet inserters
  const insertTemplate = (snippet: string) => {
    setSummary((prev) => (prev ? `${prev}\n${snippet}` : snippet))
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!person.trim() && !company.trim()) return

    const colorMap: Record<Activity['type'], Activity['color']> = {
      Call: 'blue',
      Meeting: 'amber',
      Email: 'violet',
      'Follow-up': 'blue',
      Note: 'green',
    }

    const activityData: Omit<Activity, 'id'> = {
      type,
      title: title.trim() || `${type} with ${person || company}`,
      person: person.trim() || 'Client',
      company: company.trim() || 'Independent',
      date: 'Today, Just now',
      status: 'Completed',
      color: colorMap[type] || 'blue',
      summary: summary.trim(),
    }

    let followUpData: Omit<FollowUpItem, 'id'> | undefined = undefined
    if (nextAction.trim()) {
      followUpData = {
        day: nextDue.toLowerCase().includes('today')
          ? 'Today'
          : nextDue.toLowerCase().includes('tomorrow')
          ? 'Tomorrow'
          : 'This week',
        company: company.trim() || person.trim(),
        action: nextAction.trim(),
        time: nextDue.trim(),
        tone: 'urgent',
        completed: false,
      }
    }

    onLogActivity(activityData, followUpData)
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
            <span className="px-2 py-0.5 text-[10px] font-mono font-bold bg-[#fff3df] text-[#c4882b] rounded border border-[#f6e5bf]">
              Hotkey: L
            </span>
            <h2 className="text-[16px] font-bold text-[#1c1d1f] tracking-tight">
              Quick Log Call / Meeting Note
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
          {/* Interaction Type selection buttons */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Activity Type
            </label>
            <div className="grid grid-cols-5 gap-1.5">
              {(['Call', 'Meeting', 'Email', 'Follow-up', 'Note'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`py-1.5 px-2 rounded-lg text-[12px] font-semibold transition-all border ${
                    type === t
                      ? 'bg-[#1c1d1f] text-white border-[#1c1d1f] shadow-xs'
                      : 'bg-white text-[#505967] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Contact Person *
              </label>
              <input
                list="contacts-list"
                value={person}
                onChange={(e) => {
                  setPerson(e.target.value)
                  const matched = contacts.find((c) => c.name === e.target.value)
                  if (matched) setCompany(matched.company)
                }}
                placeholder="Client name"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
              <datalist id="contacts-list">
                {contacts.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Company Account
              </label>
              <input
                list="companies-list"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Company name"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-lg text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
              <datalist id="companies-list">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967]">
                Interaction Scratchpad & Scope Notes
              </label>
              <div className="flex items-center gap-1.5 text-[10px]">
                <button
                  type="button"
                  onClick={() => insertTemplate('• Decision: ')}
                  className="px-1.5 py-0.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] rounded text-[#505967] font-medium"
                >
                  + Decision
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('• Budget: ')}
                  className="px-1.5 py-0.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] rounded text-[#505967] font-medium"
                >
                  + Budget
                </button>
                <button
                  type="button"
                  onClick={() => insertTemplate('• Action Item: ')}
                  className="px-1.5 py-0.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] rounded text-[#505967] font-medium"
                >
                  + Action
                </button>
              </div>
            </div>
            <textarea
              ref={notesRef}
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="Jot down quick key takeaways, budget mentions, objections, or deliverables discussed..."
              className="w-full p-3 border border-[#e4e7ec] rounded-lg text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none leading-relaxed"
            />
          </div>

          {/* Mandatory Next Action GTD Prompt */}
          <div className="p-3.5 bg-[#fffaf1] border border-[#f6e5bf] rounded-xl space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#c4882b] uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>Mandatory Next Step (Auto-adds to Follow-ups)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Send revised scope quote"
                className="w-full h-9 px-2.5 bg-white border border-[#f2ddad] rounded-lg text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#c4882b]"
              />
              <input
                type="text"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
                placeholder="e.g. Today, 17:00"
                className="w-full h-9 px-2.5 bg-white border border-[#f2ddad] rounded-lg text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#c4882b]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#9fa1a7] font-mono">
              Press <kbd className="px-1 bg-[#f4f5f6] border rounded text-[10px]">⌘</kbd> +{' '}
              <kbd className="px-1 bg-[#f4f5f6] border rounded text-[10px]">↵</kbd>
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
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-semibold rounded-lg shadow-sm transition-all"
              >
                <PhoneCall size={15} />
                <span>Log Interaction</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
