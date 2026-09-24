'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X,
  PhoneCall,
  Calendar,
  AlertCircle,
  Sparkles,
  MessageSquare,
  Briefcase,
  ListTodo,
  Calculator,
  CheckSquare,
  CornerDownLeft,
  ChevronDown,
} from 'lucide-react'
import { Activity, Company, Contact, FollowUpItem, Deal } from '@/lib/crm-types'

interface LogCallModalProps {
  isOpen: boolean
  onClose: () => void
  onLogActivity: (
    activity: Omit<Activity, 'id'>,
    followUp?: Omit<FollowUpItem, 'id'>,
    dealId?: string
  ) => void
  companies: Company[]
  contacts: Contact[]
  deals?: Deal[]
  initialDealId?: string
}

interface SlashCommand {
  id: string
  command: string
  title: string
  description: string
  icon: React.ReactNode
  snippet: (ctx?: { person?: string; company?: string; dealTitle?: string; value?: string }) => string
}

export function LogCallModal({
  isOpen,
  onClose,
  onLogActivity,
  companies,
  contacts,
  deals = [],
  initialDealId,
}: LogCallModalProps) {
  const [type, setType] = useState<Activity['type']>('Call')
  const [person, setPerson] = useState('')
  const [company, setCompany] = useState('')
  const [selectedDealId, setSelectedDealId] = useState<string>('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [nextAction, setNextAction] = useState('')
  const [nextDue, setNextDue] = useState('Tomorrow, 10:00')

  // Slash commands state
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [slashSearch, setSlashSearch] = useState('')
  const [selectedSlashIndex, setSelectedSlashIndex] = useState(0)

  const notesRef = useRef<HTMLTextAreaElement>(null)

  const slashCommands: SlashCommand[] = [
    {
      id: 'call',
      command: '/call',
      title: 'Call Log Template',
      description: 'Timestamped call notes & takeaway checklist',
      icon: <PhoneCall size={13} className="text-[#266df0]" />,
      snippet: (ctx) => {
        const now = new Date()
        const timeStr = now.toLocaleDateString('cs-CZ', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        return `### 📞 Client Call — ${timeStr}
- **Client:** ${ctx?.person || ctx?.company || 'Client'}
- **Focus:** ${ctx?.dealTitle || 'Project Scope & Timeline'}
- **Key Takeaways:**
  • Client discussed: 
  • Feedback / Scope adjustments: 
- **Agreed Decisions:**
  • `
      },
    },
    {
      id: 'quote',
      command: '/quote',
      title: 'Quote & Pricing',
      description: 'Milestone payment calculation breakdown',
      icon: <Calculator size={13} className="text-[#43a878]" />,
      snippet: (ctx) => `### 💰 Commercial Quote
- **Project Value:** ${ctx?.value || '25 000 Kč'}
- **Deposit (50%):** Kickoff invoice
- **Final (50%):** Delivery & source code handoff`,
    },
    {
      id: 'scope',
      command: '/scope',
      title: 'Scope Checklist',
      description: 'Project milestone deliverables list',
      icon: <ListTodo size={13} className="text-[#805ad5]" />,
      snippet: (ctx) => `### 📋 Deliverables Scope: ${ctx?.dealTitle || 'Milestones'}
- [ ] Phase 1: Wireframes & Architecture
- [ ] Phase 2: Design & Brand Polish
- [ ] Phase 3: Code Implementation & QA
- [ ] Phase 4: Production Deployment`,
    },
    {
      id: 'todo',
      command: '/todo',
      title: 'Action Item / Todo',
      description: 'GTD next action checklist',
      icon: <CheckSquare size={13} className="text-[#c4882b]" />,
      snippet: (ctx) =>
        `- [ ] Send revised proposal to ${ctx?.person || ctx?.company || 'client'} by tomorrow 14:00`,
    },
  ]

  const filteredCommands = slashCommands.filter(
    (c) =>
      c.command.toLowerCase().includes(slashSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(slashSearch.toLowerCase())
  )

  useEffect(() => {
    if (isOpen) {
      setType('Call')
      setTitle('Client check-in call')
      setSummary('')
      setNextAction('Send follow-up summary')
      setNextDue('Today, 17:00')
      setIsSlashMenuOpen(false)

      // Smart initial deal/contact binding
      if (initialDealId) {
        const foundDeal = deals.find((d) => d.id === initialDealId)
        if (foundDeal) {
          setSelectedDealId(foundDeal.id)
          setCompany(foundDeal.company)
          setPerson(foundDeal.contactName || contacts.find((c) => c.company === foundDeal.company)?.name || '')
          setTitle(`Call regarding ${foundDeal.title}`)
        }
      } else {
        const defaultContact = contacts[0]
        const initialPerson = defaultContact?.name || ''
        const initialCompany = defaultContact?.company || companies[0]?.name || ''
        setPerson(initialPerson)
        setCompany(initialCompany)

        // Try to find matching active deal for initial contact/company
        const matchedDeal = deals.find(
          (d) => d.company === initialCompany || d.contactName === initialPerson
        )
        if (matchedDeal) {
          setSelectedDealId(matchedDeal.id)
          setTitle(`Call regarding ${matchedDeal.title}`)
        } else {
          setSelectedDealId('')
        }
      }

      setTimeout(() => {
        notesRef.current?.focus()
      }, 60)
    }
  }, [isOpen, initialDealId, contacts, companies, deals])

  if (!isOpen) return null

  const currentLinkedDeal = deals.find((d) => d.id === selectedDealId)

  // Deal changed from dropdown
  const handleDealSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const dealId = e.target.value
    setSelectedDealId(dealId)
    if (!dealId) return

    const matched = deals.find((d) => d.id === dealId)
    if (matched) {
      setCompany(matched.company)
      if (matched.contactName) setPerson(matched.contactName)
      setTitle(`Call regarding ${matched.title}`)
    }
  }

  // Insert snippet directly at cursor
  const insertSnippet = (snippetText: string) => {
    const textarea = notesRef.current
    if (!textarea) {
      setSummary((prev) => (prev ? `${prev}\n${snippetText}` : snippetText))
      return
    }

    const cursor = textarea.selectionStart
    const textBefore = summary.slice(0, cursor)
    const textAfter = summary.slice(cursor)
    const lastSlashIndex = textBefore.lastIndexOf('/')

    let nextText = ''
    if (lastSlashIndex !== -1 && isSlashMenuOpen) {
      nextText = textBefore.slice(0, lastSlashIndex) + snippetText + textAfter
    } else {
      nextText = summary ? `${summary}\n\n${snippetText}` : snippetText
    }

    setSummary(nextText)
    setIsSlashMenuOpen(false)

    setTimeout(() => {
      textarea.focus()
      const newPos = (lastSlashIndex !== -1 ? lastSlashIndex : summary.length) + snippetText.length
      textarea.setSelectionRange(newPos, newPos)
    }, 20)
  }

  const applySlashCommand = (cmd: SlashCommand) => {
    const snippet = cmd.snippet({
      person,
      company,
      dealTitle: currentLinkedDeal?.title,
      value: currentLinkedDeal?.value,
    })
    insertSnippet(snippet)
  }

  // Handle textarea typing & slash detection
  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    setSummary(val)

    const cursor = e.target.selectionStart
    const textBefore = val.slice(0, cursor)
    const lastSlash = textBefore.lastIndexOf('/')

    if (
      lastSlash !== -1 &&
      (lastSlash === 0 || textBefore[lastSlash - 1] === '\n' || textBefore[lastSlash - 1] === ' ')
    ) {
      const q = textBefore.slice(lastSlash + 1)
      if (!q.includes(' ') && !q.includes('\n')) {
        setSlashSearch(q)
        setIsSlashMenuOpen(true)
        setSelectedSlashIndex(0)
        return
      }
    }

    setIsSlashMenuOpen(false)
  }

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!person.trim() && !company.trim()) return

    const colorMap: Record<Activity['type'], Activity['color']> = {
      Call: 'blue',
      Meeting: 'blue',
      Email: 'blue',
      'Follow-up': 'blue',
      Note: 'blue',
    }

    const activityData: Omit<Activity, 'id'> = {
      dealId: selectedDealId || undefined,
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

    onLogActivity(activityData, followUpData, selectedDealId || undefined)
    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (isSlashMenuOpen && filteredCommands.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedSlashIndex((prev) => (prev + 1) % filteredCommands.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedSlashIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        applySlashCommand(filteredCommands[selectedSlashIndex])
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        setIsSlashMenuOpen(false)
        return
      }
    }

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
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-[#e9f0ff] text-[#266df0] rounded-[7px] border border-[#d6e3fc]">
              Hotkey: L
            </span>
            <h2 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">
              Quick Log Call & Deal Note
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
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
                  className={`py-1.5 px-2 rounded-[10px] text-[12px] font-medium transition-all border ${
                    type === t
                      ? 'bg-[#232529] text-white border-[#232529] shadow-xs'
                      : 'bg-white text-[#505967] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Unified Deal & Project Link */}
          <div className="p-3 bg-[#fafbfc] border border-[#e4e7ec] rounded-[10px] space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#505967]">
                <Briefcase size={12} className="text-[#266df0]" />
                <span>Link to Deal / Project</span>
              </label>
              {currentLinkedDeal && (
                <span className="text-[10px] text-[#43a878] font-medium flex items-center gap-1">
                  ✓ Syncs to Deal Scratchpad
                </span>
              )}
            </div>
            <select
              value={selectedDealId}
              onChange={handleDealSelectChange}
              className="w-full h-9 px-3 border border-[#cad0d9] rounded-[8px] text-[12px] bg-white text-[#1c1d1f] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            >
              <option value="">No linked deal (General touchpoint)</option>
              {deals.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title} — {d.company} ({d.value})
                </option>
              ))}
            </select>
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
                  const val = e.target.value
                  setPerson(val)
                  const matched = contacts.find((c) => c.name === val)
                  if (matched) {
                    setCompany(matched.company)
                    // If no deal selected, auto-select if contact has a deal
                    if (!selectedDealId) {
                      const deal = deals.find(
                        (d) => d.company === matched.company || d.contactName === matched.name
                      )
                      if (deal) {
                        setSelectedDealId(deal.id)
                        setTitle(`Call regarding ${deal.title}`)
                      }
                    }
                  }
                }}
                placeholder="Client name"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
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
                onChange={(e) => {
                  const val = e.target.value
                  setCompany(val)
                  if (!selectedDealId) {
                    const deal = deals.find((d) => d.company.toLowerCase() === val.toLowerCase())
                    if (deal) setSelectedDealId(deal.id)
                  }
                }}
                placeholder="Company name"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
              <datalist id="companies-list">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
          </div>

          {/* Notes area with Slash commands & Quick chips */}
          <div className="relative">
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967]">
                Meeting Scratchpad & Scope Notes
              </label>
              <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                <button
                  type="button"
                  onClick={() =>
                    applySlashCommand(slashCommands.find((c) => c.id === 'call')!)
                  }
                  className="px-2 py-0.5 bg-[#e9f0ff] hover:bg-[#d6e3fc] text-[#266df0] rounded-[6px] font-medium"
                >
                  /call
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySlashCommand(slashCommands.find((c) => c.id === 'quote')!)
                  }
                  className="px-2 py-0.5 bg-[#e7f6ee] hover:bg-[#cdeedc] text-[#43a878] rounded-[6px] font-medium"
                >
                  /quote
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySlashCommand(slashCommands.find((c) => c.id === 'scope')!)
                  }
                  className="px-2 py-0.5 bg-[#f0eaff] hover:bg-[#e0d3fc] text-[#805ad5] rounded-[6px] font-medium"
                >
                  /scope
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applySlashCommand(slashCommands.find((c) => c.id === 'todo')!)
                  }
                  className="px-2 py-0.5 bg-[#fff3df] hover:bg-[#fde4ba] text-[#c4882b] rounded-[6px] font-medium"
                >
                  /todo
                </button>
                <button
                  type="button"
                  onClick={() => insertSnippet('• **Decision:** ')}
                  className="px-2 py-0.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] rounded-[6px] text-[#505967] font-medium"
                >
                  + Decision
                </button>
              </div>
            </div>

            <textarea
              ref={notesRef}
              rows={4}
              value={summary}
              onChange={handleNotesChange}
              placeholder="Type '/' for quick templates (/call, /quote, /scope, /todo) or jot down notes..."
              className="w-full p-3 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none leading-relaxed font-mono"
            />

            {/* Slash Command Autocomplete Popover */}
            {isSlashMenuOpen && filteredCommands.length > 0 && (
              <div className="absolute left-2 bottom-4 z-20 w-72 bg-white border border-[#e4e7ec] rounded-[10px] shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                <div className="px-2.5 py-1.5 bg-[#fafbfc] border-b border-[#edf0f3] flex items-center justify-between text-[10px] text-[#8f99a8]">
                  <span>Insert template</span>
                  <span className="font-mono">↑↓ Enter</span>
                </div>
                <div className="p-1 space-y-0.5 max-h-48 overflow-y-auto">
                  {filteredCommands.map((cmd, idx) => (
                    <button
                      key={cmd.id}
                      type="button"
                      onClick={() => applySlashCommand(cmd)}
                      onMouseEnter={() => setSelectedSlashIndex(idx)}
                      className={`w-full flex items-center gap-2 px-2.5 py-2 text-left rounded-[7px] text-[12px] transition-colors ${
                        selectedSlashIndex === idx
                          ? 'bg-[#232529] text-white'
                          : 'text-[#1c1d1f] hover:bg-[#f4f5f6]'
                      }`}
                    >
                      <span className="shrink-0">{cmd.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium flex items-center gap-1.5">
                          <span>{cmd.title}</span>
                          <span
                            className={`font-mono text-[10px] px-1 rounded-[4px] ${
                              selectedSlashIndex === idx
                                ? 'bg-white/20 text-white'
                                : 'bg-[#e4e7ec] text-[#505967]'
                            }`}
                          >
                            {cmd.command}
                          </span>
                        </div>
                        <p
                          className={`text-[10px] truncate ${
                            selectedSlashIndex === idx ? 'text-[#bad0fa]' : 'text-[#8f99a8]'
                          }`}
                        >
                          {cmd.description}
                        </p>
                      </div>
                      <CornerDownLeft
                        size={12}
                        className={selectedSlashIndex === idx ? 'text-white' : 'text-[#9fa1a7]'}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Mandatory Next Action GTD Prompt */}
          <div className="p-3.5 bg-[#fffaf1] border border-[#f6e5bf] rounded-[12px] space-y-2">
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#c4882b] uppercase tracking-wider">
              <AlertCircle size={14} />
              <span>Mandatory Next Step (Auto-adds to Follow-ups & Deal)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                value={nextAction}
                onChange={(e) => setNextAction(e.target.value)}
                placeholder="e.g. Send revised scope quote"
                className="w-full h-9 px-2.5 bg-white border border-[#f2ddad] rounded-[10px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#c4882b]"
              />
              <input
                type="text"
                value={nextDue}
                onChange={(e) => setNextDue(e.target.value)}
                placeholder="e.g. Today, 17:00"
                className="w-full h-9 px-2.5 bg-white border border-[#f2ddad] rounded-[10px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#c4882b]"
              />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#9fa1a7] font-mono">
              Press <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">⌘</kbd> +{' '}
              <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">↵</kbd>
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
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-medium rounded-[10px] shadow-xs transition-all cursor-pointer"
              >
                <PhoneCall size={15} />
                <span>Log & Sync Note</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
