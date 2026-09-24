'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Search,
  PlusCircle,
  UserPlus,
  PhoneCall,
  LayoutDashboard,
  WalletCards,
  Building2,
  Users,
  CalendarDays,
  Settings2,
  FileText,
  ArrowRight,
  Sparkles,
  Command,
  CornerDownLeft,
  X,
  Kanban,
  TableProperties,
  Keyboard,
  Clock,
  CheckCircle2,
} from 'lucide-react'
import { Deal, Contact, Company } from '@/lib/crm-types'

export type PaletteActionType =
  | 'navigate'
  | 'new_deal'
  | 'new_contact'
  | 'log_call'
  | 'open_deal'
  | 'open_company'
  | 'open_contact'
  | 'toggle_kanban'
  | 'toggle_table'
  | 'show_shortcuts'

export interface PaletteItem {
  id: string
  category: 'Actions' | 'Deals' | 'Contacts' | 'Companies' | 'Navigation'
  title: string
  subtitle?: string
  badge?: string
  shortcut?: string
  icon?: React.ReactNode
  color?: 'blue' | 'violet' | 'amber' | 'green'
  payload?: any
  actionType: PaletteActionType
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onSelectAction: (actionType: PaletteActionType, payload?: any) => void
  deals: Deal[]
  contacts: Contact[]
  companies: Company[]
}

export function CommandPalette({
  isOpen,
  onClose,
  onSelectAction,
  deals,
  contacts,
  companies,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  // Focus input when opened and reset query
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setSelectedCategory('All')
      const timer = setTimeout(() => {
        inputRef.current?.focus()
      }, 30)
      return () => clearTimeout(timer)
    }
  }, [isOpen])

  // Build searchable items
  const allItems: PaletteItem[] = useMemo(() => {
    const items: PaletteItem[] = [
      // Quick Actions
      {
        id: 'action-new-deal',
        category: 'Actions',
        title: 'Create new deal',
        subtitle: 'Quick capture pipeline opportunity',
        shortcut: 'N',
        icon: <PlusCircle size={15} className="text-[#266df0]" />,
        actionType: 'new_deal',
      },
      {
        id: 'action-new-contact',
        category: 'Actions',
        title: 'Add new contact',
        subtitle: 'Create a stakeholder or lead in directory',
        shortcut: 'C',
        icon: <UserPlus size={15} className="text-[#6f7988]" />,
        actionType: 'new_contact',
      },
      {
        id: 'action-log-call',
        category: 'Actions',
        title: 'Log call or meeting note',
        subtitle: 'Fast GTD interaction & next action scratchpad',
        shortcut: 'L',
        icon: <PhoneCall size={15} className="text-[#6f7988]" />,
        actionType: 'log_call',
      },
      {
        id: 'action-shortcuts',
        category: 'Actions',
        title: 'Keyboard shortcuts cheatsheet',
        subtitle: 'View all operator cockpit hotkeys',
        shortcut: '?',
        icon: <Keyboard size={15} className="text-[#6f7988]" />,
        actionType: 'show_shortcuts',
      },
      {
        id: 'action-switch-kanban',
        category: 'Actions',
        title: 'Switch to Deals Kanban board',
        subtitle: 'Visual stage columns with hotkey navigation',
        shortcut: 'G P',
        icon: <Kanban size={15} className="text-[#266df0]" />,
        actionType: 'toggle_kanban',
      },
      {
        id: 'action-switch-table',
        category: 'Actions',
        title: 'Switch to Deals Dense table',
        subtitle: 'Compact high-density opportunity view',
        icon: <TableProperties size={15} className="text-[#6f7988]" />,
        actionType: 'toggle_table',
      },

      // Navigation
      {
        id: 'nav-dashboard',
        category: 'Navigation',
        title: 'Go to Dashboard',
        subtitle: 'Overview, today’s follow-ups & metrics',
        shortcut: 'G D',
        icon: <LayoutDashboard size={15} className="text-[#6f7988]" />,
        actionType: 'navigate',
        payload: 'Dashboard',
      },
      {
        id: 'nav-deals',
        category: 'Navigation',
        title: 'Go to Deals & Pipeline',
        subtitle: 'Active opportunities, Kanban board & values',
        shortcut: 'G P',
        icon: <WalletCards size={15} className="text-[#266df0]" />,
        actionType: 'navigate',
        payload: 'Deals',
      },
      {
        id: 'nav-companies',
        category: 'Navigation',
        title: 'Go to Companies',
        subtitle: 'Client accounts, industry types & accounts',
        shortcut: 'G C',
        icon: <Building2 size={15} className="text-[#6f7988]" />,
        actionType: 'navigate',
        payload: 'Companies',
      },
      {
        id: 'nav-contacts',
        category: 'Navigation',
        title: 'Go to Contacts',
        subtitle: 'Client stakeholders, founders & emails',
        shortcut: 'G U',
        icon: <Users size={15} className="text-[#6f7988]" />,
        actionType: 'navigate',
        payload: 'Contacts',
      },
      {
        id: 'nav-calendar',
        category: 'Navigation',
        title: 'Go to Calendar',
        subtitle: 'Weekly schedule, meetings & milestone timeline',
        shortcut: 'G K',
        icon: <CalendarDays size={15} className="text-[#266df0]" />,
        actionType: 'navigate',
        payload: 'Calendar',
      },
      {
        id: 'nav-activities',
        category: 'Navigation',
        title: 'Go to Activities',
        subtitle: 'Call logs, touch history & timeline',
        shortcut: 'G A',
        icon: <FileText size={15} className="text-[#6f7988]" />,
        actionType: 'navigate',
        payload: 'Activities',
      },
      {
        id: 'nav-settings',
        category: 'Navigation',
        title: 'Go to Settings',
        subtitle: 'Workspace preferences & operator profile',
        shortcut: 'G S',
        icon: <Settings2 size={15} className="text-[#6f7988]" />,
        actionType: 'navigate',
        payload: 'Settings',
      },
    ]

    // Add Deals
    deals.forEach((deal) => {
      items.push({
        id: `deal-${deal.id}`,
        category: 'Deals',
        title: deal.title,
        subtitle: `${deal.company} • ${deal.stage} • Next: ${deal.next}`,
        badge: deal.value,
        color: deal.color,
        icon: (
          <span className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-semibold bg-[#e9f0ff] text-[#266df0] shrink-0">
            {deal.company.charAt(0)}
          </span>
        ),
        actionType: 'open_deal',
        payload: deal,
      })
    })

    // Add Companies
    companies.forEach((comp) => {
      items.push({
        id: `comp-${comp.id}`,
        category: 'Companies',
        title: comp.name,
        subtitle: `${comp.type} • Contact: ${comp.contact} (${comp.deals} deal${comp.deals !== 1 ? 's' : ''})`,
        badge: comp.status,
        color: comp.color,
        icon: (
          <span className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-semibold bg-[#f0f2f5] text-[#232529] shrink-0">
            {comp.name.charAt(0)}
          </span>
        ),
        actionType: 'open_company',
        payload: comp,
      })
    })

    // Add Contacts
    contacts.forEach((contact) => {
      items.push({
        id: `contact-${contact.id}`,
        category: 'Contacts',
        title: contact.name,
        subtitle: `${contact.role} at ${contact.company} • ${contact.email}`,
        badge: contact.lastTouch,
        color: contact.color,
        icon: (
          <span className="w-5 h-5 rounded-[6px] flex items-center justify-center text-[10px] font-semibold bg-[#f0f2f5] text-[#232529] shrink-0">
            {contact.name.charAt(0)}
          </span>
        ),
        actionType: 'open_contact',
        payload: contact,
      })
    })

    return items
  }, [deals, companies, contacts])

  // Filter items by query and category
  const filteredItems = useMemo(() => {
    let list = allItems

    if (selectedCategory !== 'All') {
      list = list.filter((item) => item.category === selectedCategory)
    }

    const cleanQuery = query.trim().toLowerCase()
    if (!cleanQuery) return list

    // Check for special prefix shortcuts like > for actions, @ for contacts, # for deals
    let targetCategory = ''
    let searchTerm = cleanQuery
    if (cleanQuery.startsWith('>')) {
      targetCategory = 'Actions'
      searchTerm = cleanQuery.slice(1).trim()
    } else if (cleanQuery.startsWith('@')) {
      targetCategory = 'Contacts'
      searchTerm = cleanQuery.slice(1).trim()
    } else if (cleanQuery.startsWith('#')) {
      targetCategory = 'Deals'
      searchTerm = cleanQuery.slice(1).trim()
    }

    return list.filter((item) => {
      if (targetCategory && item.category !== targetCategory) {
        return false
      }
      if (!searchTerm) return true
      const matchTitle = item.title.toLowerCase().includes(searchTerm)
      const matchSubtitle = item.subtitle?.toLowerCase().includes(searchTerm)
      const matchBadge = item.badge?.toLowerCase().includes(searchTerm)
      const matchShortcut = item.shortcut?.toLowerCase().includes(searchTerm)
      return matchTitle || matchSubtitle || matchBadge || matchShortcut
    })
  }, [allItems, query, selectedCategory])

  // Keep selected index within bounds
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredItems])

  // Auto scroll focused item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector('[data-active="true"]') as HTMLElement
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex])

  // Keyboard navigation within the palette
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown' || (e.ctrlKey && e.key === 'n')) {
      e.preventDefault()
      setSelectedIndex((prev) => (filteredItems.length > 0 ? (prev + 1) % filteredItems.length : 0))
    } else if (e.key === 'ArrowUp' || (e.ctrlKey && e.key === 'p')) {
      e.preventDefault()
      setSelectedIndex((prev) =>
        filteredItems.length > 0 ? (prev - 1 + filteredItems.length) % filteredItems.length : 0
      )
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        executeItem(filteredItems[selectedIndex])
      }
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    } else if (e.key === 'Tab') {
      // Cycle through categories
      e.preventDefault()
      const categories = ['All', 'Actions', 'Deals', 'Contacts', 'Companies', 'Navigation']
      const currentIndex = categories.indexOf(selectedCategory)
      const nextIndex = e.shiftKey
        ? (currentIndex - 1 + categories.length) % categories.length
        : (currentIndex + 1) % categories.length
      setSelectedCategory(categories[nextIndex])
    }
  }

  const executeItem = (item: PaletteItem) => {
    onClose()
    onSelectAction(item.actionType, item.payload)
  }

  if (!isOpen) return null

  // Group items by category for rendering headers
  const categories = ['Actions', 'Navigation', 'Deals', 'Companies', 'Contacts'] as const

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-[#10141c]/30 backdrop-blur-xs transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden flex flex-col max-h-[75vh] animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-[#edf0f3] bg-white gap-3">
          <Search size={18} className="text-[#9fa1a7] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command, search deals, contacts, companies, or > for actions..."
            className="flex-1 bg-transparent text-[14px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none font-medium"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="text-[#9fa1a7] hover:text-[#1c1d1f] p-1 rounded-[6px] text-xs"
              title="Clear"
            >
              <X size={14} />
            </button>
          )}
          <div className="flex items-center gap-1.5 shrink-0 pl-2 border-l border-[#f0f1f3]">
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-medium text-[#8f99a8] bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px]">
              ESC
            </kbd>
          </div>
        </div>

        {/* Filter Category Chips */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-[#f0f1f3] bg-[#fafbfc] overflow-x-auto text-[11px] scrollbar-none">
          {['All', 'Actions', 'Deals', 'Contacts', 'Companies', 'Navigation'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2.5 py-1 rounded-[7px] font-medium transition-colors ${
                selectedCategory === cat
                  ? 'bg-[#232529] text-white shadow-xs'
                  : 'text-[#6f7988] hover:bg-[#edf0f3] hover:text-[#1c1d1f]'
              }`}
            >
              {cat}
            </button>
          ))}
          <div className="ml-auto text-[10px] text-[#9fa1a7] hidden sm:flex items-center gap-1">
            <span>Press</span>
            <kbd className="px-1 py-0.2 text-[9px] bg-white border border-[#e4e7ec] rounded-[4px] font-mono">
              Tab
            </kbd>
            <span>to cycle</span>
          </div>
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-[#f5f6f8] max-h-[50vh]"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-[#8f99a8]">
              <Search size={28} className="mx-auto mb-2.5 text-[#cbd0d8] opacity-70" />
              <p className="text-[13px] font-medium text-[#505967]">No results found</p>
              <p className="text-[11px] text-[#9fa1a7] mt-1">
                No matching actions, deals, or contacts for &ldquo;{query}&rdquo;
              </p>
            </div>
          ) : (
            (() => {
              // Group items cleanly for rendering
              let itemCounter = 0
              return categories
                .map((category) => {
                  const itemsInCat = filteredItems.filter((i) => i.category === category)
                  if (itemsInCat.length === 0) return null

                  return (
                    <div key={category} className="pt-2 first:pt-0">
                      <div className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-[#9fa1a7] flex items-center justify-between">
                        <span>{category}</span>
                        <span className="text-[10px] font-medium lowercase font-mono">
                          {itemsInCat.length}
                        </span>
                      </div>
                      <div className="mt-1 space-y-0.5">
                        {itemsInCat.map((item) => {
                          const isSelected = itemCounter === selectedIndex
                          const thisIndex = itemCounter
                          itemCounter++

                          return (
                            <button
                              key={item.id}
                              data-active={isSelected}
                              onClick={() => executeItem(item)}
                              onMouseEnter={() => setSelectedIndex(thisIndex)}
                              className={`w-full flex items-center justify-between px-3 py-2 rounded-[10px] text-left transition-all duration-75 group ${
                                isSelected
                                  ? 'bg-[#f1f5ff] text-[#1c1d1f] shadow-2xs'
                                  : 'text-[#33383f] hover:bg-[#f8f9fa]'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="shrink-0 flex items-center justify-center">
                                  {item.icon}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2">
                                    <span
                                      className={`text-[13px] font-medium truncate ${
                                        isSelected ? 'text-[#266df0]' : 'text-[#1c1d1f]'
                                      }`}
                                    >
                                      {item.title}
                                    </span>
                                    {item.badge && (
                                      <span
                                        className={`px-1.5 py-0.5 text-[10px] rounded-[7px] font-mono font-medium ${
                                          item.category === 'Deals'
                                            ? 'bg-[#e9f0ff] text-[#266df0]'
                                            : 'bg-[#f0f1f3] text-[#6f7988]'
                                        }`}
                                      >
                                        {item.badge}
                                      </span>
                                    )}
                                  </div>
                                  {item.subtitle && (
                                    <p className="text-[11px] text-[#6f7988] truncate mt-0.5">
                                      {item.subtitle}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0 ml-3">
                                {item.shortcut && (
                                  <kbd
                                    className={`px-1.5 py-0.5 text-[10px] font-mono font-medium rounded-[5px] ${
                                      isSelected
                                        ? 'bg-white text-[#266df0] border border-[#d6e3fc]'
                                        : 'bg-[#f4f5f6] text-[#8f99a8] border border-[#e4e7ec]'
                                    }`}
                                  >
                                    {item.shortcut}
                                  </kbd>
                                )}
                                {isSelected && (
                                  <CornerDownLeft
                                    size={13}
                                    className="text-[#266df0] opacity-80 animate-in fade-in"
                                  />
                                )}
                              </div>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })
                .filter(Boolean)
            })()
          )}
        </div>

        {/* Command Palette Footer */}
        <div className="px-4 py-2.5 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between text-[11px] text-[#8f99a8]">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#e4e7ec] rounded font-mono font-semibold text-[#6f7988]">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#e4e7ec] rounded font-mono font-semibold text-[#6f7988]">
                ↵
              </kbd>
              <span>select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 text-[10px] bg-white border border-[#e4e7ec] rounded font-mono font-semibold text-[#6f7988]">
                esc
              </kbd>
              <span>close</span>
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-2 font-mono text-[10px] text-[#9fa1a7]">
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white border border-[#e4e7ec] rounded font-bold">N</kbd> deal
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white border border-[#e4e7ec] rounded font-bold">C</kbd> contact
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 bg-white border border-[#e4e7ec] rounded font-bold">L</kbd> log
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
