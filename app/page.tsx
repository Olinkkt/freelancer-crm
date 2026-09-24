'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  CirclePlus,
  FileText,
  LayoutDashboard,
  MessageSquare,
  MoreHorizontal,
  Search,
  Settings2,
  Users,
  WalletCards,
  Clock,
  Sparkles,
  PhoneCall,
  UserPlus,
  Keyboard,
} from 'lucide-react'
import { CalendarView } from '@/components/calendar/calendar-view'
import { Deal, Contact, Company, Activity, FollowUpItem, DealStage } from '@/lib/crm-types'
import {
  INITIAL_COMPANIES,
  INITIAL_CONTACTS,
  INITIAL_DEALS,
  INITIAL_FOLLOW_UPS,
  INITIAL_ACTIVITIES,
} from '@/lib/crm-data'
import {
  CommandPalette,
  PaletteActionType,
} from '@/components/command-palette/command-palette'
import { ShortcutsModal } from '@/components/modals/shortcuts-modal'
import { NewDealModal } from '@/components/modals/new-deal-modal'
import { NewContactModal } from '@/components/modals/new-contact-modal'
import { LogCallModal } from '@/components/modals/log-call-modal'
import { DealDetailDrawer } from '@/components/drawers/deal-detail-drawer'
import { DealKanban } from '@/components/deals/deal-kanban'
import { ToastHUD, ToastHUDItem } from '@/components/ui/toast-hud'
import { MarkdownFormatter } from '@/components/ui/markdown-formatter'

function NavItem({
  icon: Icon,
  label,
  active = false,
  badge,
  onClick,
}: {
  icon: typeof LayoutDashboard
  label: string
  active?: boolean
  badge?: string
  onClick?: () => void
}) {
  return (
    <button
      className={`nav-item ${active ? 'active' : ''}`}
      onClick={onClick}
    >
      <Icon size={17} strokeWidth={1.8} />
      <span>{label}</span>
      {badge && <span className="nav-badge">{badge}</span>}
    </button>
  )
}

export default function Page() {
  // Navigation & View State
  const [activeView, setActiveView] = useState<string>('Dashboard')
  const [activeTab, setActiveTab] = useState<string>('Overview')

  // CRM Data State
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS)
  const [companies, setCompanies] = useState<Company[]>(INITIAL_COMPANIES)
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS)
  const [activities, setActivities] = useState<Activity[]>(INITIAL_ACTIVITIES)
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(INITIAL_FOLLOW_UPS)
  const [completedFollowUps, setCompletedFollowUps] = useState<string[]>([])

  // Search in sub-views
  const [companySearch, setCompanySearch] = useState('')
  const [contactSearch, setContactSearch] = useState('')
  const [activitySearch, setActivitySearch] = useState('')
  const [dealSearch, setDealSearch] = useState('')
  const [isDealSearchOpen, setIsDealSearchOpen] = useState(false)
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({})

  const toggleExpandActivity = (id: string) => {
    setExpandedActivityIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  // Modals & Drawers State
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)
  const [isNewContactOpen, setIsNewContactOpen] = useState(false)
  const [isLogCallOpen, setIsLogCallOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [isDealDrawerOpen, setIsDealDrawerOpen] = useState(false)

  // Floating Toasts / HUD
  const [toasts, setToasts] = useState<ToastHUDItem[]>([])

  const addToast = useCallback((message: string, shortcut?: string, type: ToastHUDItem['type'] = 'success') => {
    const id = `toast-${Date.now()}`
    setToasts((prev) => [...prev, { id, message, shortcut, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
  }, [])

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Two-key chord navigation state ("G" then another key)
  const pendingChordRef = useRef<string | null>(null)
  const chordTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Global Keyboard Shortcuts Listener
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Ctrl+K or Cmd+K: Toggle Command Palette anywhere
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setIsPaletteOpen((prev) => !prev)
        return
      }

      // If user is inside an input, do not trigger single-letter shortcuts
      if (isInput) return

      // If any modal/drawer is open, handle ESC to close
      const isAnyModalOpen =
        isPaletteOpen ||
        isShortcutsOpen ||
        isNewDealOpen ||
        isNewContactOpen ||
        isLogCallOpen ||
        isDealDrawerOpen

      if (e.key === 'Escape') {
        if (isPaletteOpen) setIsPaletteOpen(false)
        if (isShortcutsOpen) setIsShortcutsOpen(false)
        if (isNewDealOpen) setIsNewDealOpen(false)
        if (isNewContactOpen) setIsNewContactOpen(false)
        if (isLogCallOpen) setIsLogCallOpen(false)
        if (isDealDrawerOpen) setIsDealDrawerOpen(false)
        return
      }

      // If a modal or drawer is open, don't trigger global background hotkeys
      if (isAnyModalOpen) return

      const key = e.key.toLowerCase()

      // ? or Shift+/ : Show Shortcuts
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsOpen(true)
        return
      }

      // Handle G chords: 'g' then 'd', 'p', 'c', 'u', 'k', 'a', 's'
      if (pendingChordRef.current === 'g') {
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
        pendingChordRef.current = null

        if (key === 'd') {
          e.preventDefault()
          setActiveView('Dashboard')
          addToast('Navigated to Dashboard', 'G D')
          return
        } else if (key === 'p') {
          e.preventDefault()
          setActiveView('Deals')
          addToast('Navigated to Deals & Pipeline', 'G P')
          return
        } else if (key === 'c') {
          e.preventDefault()
          setActiveView('Companies')
          addToast('Navigated to Companies', 'G C')
          return
        } else if (key === 'u') {
          e.preventDefault()
          setActiveView('Contacts')
          addToast('Navigated to Contacts', 'G U')
          return
        } else if (key === 'k') {
          e.preventDefault()
          setActiveView('Calendar')
          addToast('Navigated to Calendar', 'G K')
          return
        } else if (key === 'a') {
          e.preventDefault()
          setActiveView('Activities')
          addToast('Navigated to Activities', 'G A')
          return
        } else if (key === 's') {
          e.preventDefault()
          setActiveView('Settings')
          addToast('Navigated to Settings', 'G S')
          return
        }
      }

      if (key === 'g' && !e.metaKey && !e.ctrlKey) {
        pendingChordRef.current = 'g'
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
        chordTimeoutRef.current = setTimeout(() => {
          pendingChordRef.current = null
        }, 1200)
        return
      }

      // Single-key Operator Hotkeys (Linear / Superhuman speed)
      if (key === 'n' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setIsNewDealOpen(true)
        addToast('Quick Capture Deal', 'N')
        return
      }

      if (key === 'c' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setIsNewContactOpen(true)
        addToast('Quick Capture Contact', 'C')
        return
      }

      if (key === 'l' && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setIsLogCallOpen(true)
        addToast('Quick Log Call / Note', 'L')
        return
      }
    }

    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown)
      if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
    }
  }, [
    isPaletteOpen,
    isShortcutsOpen,
    isNewDealOpen,
    isNewContactOpen,
    isLogCallOpen,
    isDealDrawerOpen,
    addToast,
  ])

  // Handle Command Palette Selection
  const handlePaletteAction = (actionType: PaletteActionType, payload?: any) => {
    switch (actionType) {
      case 'navigate':
        if (typeof payload === 'string') {
          setActiveView(payload)
          addToast(`Navigated to ${payload}`)
        }
        break
      case 'new_deal':
        setIsNewDealOpen(true)
        break
      case 'new_contact':
        setIsNewContactOpen(true)
        break
      case 'log_call':
        setIsLogCallOpen(true)
        break
      case 'show_shortcuts':
        setIsShortcutsOpen(true)
        break
      case 'open_deal':
        if (payload) {
          setSelectedDeal(payload)
          setIsDealDrawerOpen(true)
        }
        break
      case 'open_company':
        setActiveView('Companies')
        if (payload?.name) setCompanySearch(payload.name)
        break
      case 'open_contact':
        setActiveView('Contacts')
        if (payload?.name) setContactSearch(payload.name)
        break
      case 'toggle_kanban':
      case 'toggle_table':
        setActiveView('Deals')
        break
      case 'open_scratchpad':
        setIsPaletteOpen(true)
        break
      default:
        break
    }
  }

  // Create Deal Handler
  const handleAddDeal = (dealData: Omit<Deal, 'id'>) => {
    const newDeal: Deal = {
      ...dealData,
      id: `deal-${Date.now()}`,
    }
    setDeals((prev) => [newDeal, ...prev])
    addToast(`Added deal "${newDeal.title}"`, 'N')
  }

  // Create Contact Handler
  const handleAddContact = (contactData: Omit<Contact, 'id'>) => {
    const newContact: Contact = {
      ...contactData,
      id: `cont-${Date.now()}`,
    }
    setContacts((prev) => [newContact, ...prev])
    addToast(`Added contact "${newContact.name}"`, 'C')
  }

  // Log Activity Handler with unified Deal and Scratchpad sync
  const handleLogActivity = (
    activityData: Omit<Activity, 'id'>,
    followUpData?: Omit<FollowUpItem, 'id'>,
    dealId?: string
  ) => {
    const targetDealId = dealId || activityData.dealId
    const newActivity: Activity = {
      ...activityData,
      dealId: targetDealId,
      id: `act-${Date.now()}`,
    }
    setActivities((prev) => [newActivity, ...prev])

    if (followUpData) {
      const newFollowUp: FollowUpItem = {
        ...followUpData,
        id: `fu-${Date.now()}`,
      }
      setFollowUps((prev) => [newFollowUp, ...prev])
    }

    // Sync to linked deal notes & next action
    if (targetDealId) {
      const now = new Date()
      const timeStr = now.toLocaleDateString('cs-CZ', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      const noteHeading = `\n\n### 📞 ${newActivity.type}: ${newActivity.title} (${timeStr})\n`
      const noteBody = newActivity.summary ? `${noteHeading}${newActivity.summary}` : ''

      setDeals((prev) =>
        prev.map((d) => {
          if (d.id !== targetDealId) return d
          return {
            ...d,
            notes: d.notes ? `${d.notes}${noteBody}` : (newActivity.summary || ''),
            next: followUpData?.action || d.next,
            nextDueDate: followUpData?.time || d.nextDueDate,
          }
        })
      )

      if (selectedDeal?.id === targetDealId) {
        setSelectedDeal((prev) => {
          if (!prev) return null
          return {
            ...prev,
            notes: prev.notes ? `${prev.notes}${noteBody}` : (newActivity.summary || ''),
            next: followUpData?.action || prev.next,
            nextDueDate: followUpData?.time || prev.nextDueDate,
          }
        })
      }
    }

    const linkedDeal = deals.find((d) => d.id === targetDealId)
    const toastMsg = linkedDeal
      ? `Logged ${newActivity.type} & synced to ${linkedDeal.title}`
      : `Logged ${newActivity.type} with ${newActivity.person}`
    addToast(toastMsg, 'L')
  }

  // Update Deal in list
  const handleUpdateDeal = (updated: Deal) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    if (selectedDeal?.id === updated.id) {
      setSelectedDeal(updated)
    }
  }

  // Sync action items from Scratchpad to Dashboard Follow-ups
  const handleSyncTodos = (todos: string[], companyName: string = 'Workspace') => {
    const newItems: FollowUpItem[] = todos.map((todo, idx) => ({
      id: `fu-${Date.now()}-${idx}`,
      day: 'Today',
      company: companyName,
      action: todo,
      time: '14:00',
      tone: 'urgent',
      completed: false,
    }))
    setFollowUps((prev) => [...newItems, ...prev])
    addToast(`Synced ${todos.length} action item${todos.length > 1 ? 's' : ''} to Follow-ups`, 'GTD')
  }

  // Delete Deal
  const handleDeleteDeal = (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id))
    addToast('Deal deleted')
  }

  // Move deal stage in Kanban
  const handleMoveDealStage = (dealId: string, newStage: DealStage) => {
    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === dealId) {
          return {
            ...d,
            stage: newStage,
            probability: newStage === 'Won' ? '100%' : d.probability,
            color: 'blue',
          }
        }
        return d
      })
    )
    addToast(`Moved deal to ${newStage}`)
  }

  // Follow-up toggle complete
  const toggleFollowUp = (id: string) => {
    setCompletedFollowUps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  // Compute metrics
  const totalPipelineAmount = deals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  const openDealsCount = deals.filter((d) => d.stage !== 'Won').length
  const closingDeals = deals.filter((d) => d.stage === 'Quote sent' || d.stage === 'Negotiation')
  const expectedCloseAmount = closingDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  const activeProjectsCount = deals.filter((d) => d.stage !== 'Lead' && d.stage !== 'Won').length
  const dueTodayFollowUpsCount = followUps.filter(
    (f) => f.day.toLowerCase() === 'today' && !completedFollowUps.includes(f.id)
  ).length
  const winRate =
    deals.length > 0
      ? `${Math.round((deals.filter((d) => d.stage === 'Won').length / deals.length) * 100)}%`
      : '0%'

  const pipelineStagesSummary: { label: DealStage; count: number; amount: string }[] = [
    'Lead',
    'Qualified',
    'Scope',
    'Quote sent',
    'Negotiation',
    'Won',
  ].map((st) => {
    const stageDeals = deals.filter((d) => d.stage === st)
    const stageSum = stageDeals.reduce(
      (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
      0
    )
    return {
      label: st as DealStage,
      count: stageDeals.length,
      amount: stageSum.toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč',
    }
  })

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">S</span>
          <span>Oliver Seidl</span>
        </div>
        <nav className="nav-group" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <NavItem
            icon={LayoutDashboard}
            label="Dashboard"
            active={activeView === 'Dashboard'}
            onClick={() => setActiveView('Dashboard')}
          />
          <NavItem
            icon={WalletCards}
            label="Deals"
            badge={String(deals.length)}
            active={activeView === 'Deals'}
            onClick={() => setActiveView('Deals')}
          />
          <NavItem
            icon={Building2}
            label="Companies"
            badge={String(companies.length)}
            active={activeView === 'Companies'}
            onClick={() => setActiveView('Companies')}
          />
          <NavItem
            icon={Users}
            label="Contacts"
            badge={String(contacts.length)}
            active={activeView === 'Contacts'}
            onClick={() => setActiveView('Contacts')}
          />
          <NavItem
            icon={FileText}
            label="Activities"
            active={activeView === 'Activities'}
            onClick={() => setActiveView('Activities')}
          />
          <p className="nav-label second">Manage</p>
          <NavItem
            icon={CalendarDays}
            label="Calendar"
            active={activeView === 'Calendar'}
            onClick={() => setActiveView('Calendar')}
          />
          <NavItem
            icon={Settings2}
            label="Settings"
            active={activeView === 'Settings'}
            onClick={() => setActiveView('Settings')}
          />
        </nav>

        <div className="sidebar-bottom">
          <div className="health-dot" />
          <div>
            <strong>All systems operational</strong>
            <span>Last synced just now</span>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            <strong>{activeView}</strong>
          </div>

          <div className="top-actions">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="topbar-search"
              title="Search workspace (Ctrl+K)"
            >
              <Search size={14} />
              <span>Search workspace...</span>
              <span className="search-shortcut">Ctrl+K</span>
            </button>

            <button className="avatar" title="Oliver Seidl">
              OS
            </button>
          </div>
        </header>

        {/* VIEW CONTAINER */}
        <div className="content-wrap">
          {activeView === 'Deals' ? (
            /* DEALS & PIPELINE VIEW (Kanban Board + Dense Table switch) */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Sales workspace</p>
                  <h1>Deals & Pipeline</h1>
                  <p className="subcopy">
                    Manage every opportunity from first conversation to close.
                  </p>
                </div>
              </section>

              {/* Deal Metrics Summary */}
              <section className="deal-summary">
                <div>
                  <span className="metric-label">Open deals</span>
                  <strong>{openDealsCount}</strong>
                  <small>Across 6 active stages</small>
                </div>
                <div>
                  <span className="metric-label">Pipeline value</span>
                  <strong className="font-mono tabular-nums">
                    {totalPipelineAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč
                  </strong>
                  <small>
                    <span className="positive">+12.4%</span> vs last month
                  </small>
                </div>
                <div>
                  <span className="metric-label">Expected close</span>
                  <strong className="font-mono tabular-nums">
                    {expectedCloseAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč
                  </strong>
                  <small>
                    {closingDeals.length} deal{closingDeals.length === 1 ? '' : 's'} closing soon
                  </small>
                </div>
                <div>
                  <span className="metric-label">Win rate</span>
                  <strong>{winRate}</strong>
                  <small>Closed won / total</small>
                </div>
              </section>

              {/* Kanban Board Component */}
              <DealKanban
                deals={deals}
                onOpenDeal={(deal) => {
                  setSelectedDeal(deal)
                  setIsDealDrawerOpen(true)
                }}
                onAddDealClick={() => setIsNewDealOpen(true)}
                onMoveDealStage={handleMoveDealStage}
              />
            </>
          ) : activeView === 'Calendar' ? (
            /* CALENDAR VIEW */
            <CalendarView
              deals={deals}
              followUps={followUps}
              onOpenDeal={(deal) => {
                setSelectedDeal(deal)
                setIsDealDrawerOpen(true)
              }}
            />
          ) : activeView === 'Activities' ? (
            /* ACTIVITIES TIMELINE VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Workspace timeline</p>
                  <h1>Activities & Meeting Notes</h1>
                  <p className="subcopy">
                    Keep track of client calls, scoping decisions, and next actions.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsLogCallOpen(true)}
                >
                  <CirclePlus size={17} />
                  <span>Log interaction</span>
                  <kbd className="ml-1 px-1 bg-[#3a3e45] text-white rounded text-[10px] font-mono">
                    L
                  </kbd>
                </button>
              </section>

              <section className="company-summary">
                <div>
                  <span className="metric-label">Total activities</span>
                  <strong>{activities.length}</strong>
                  <small>+8 added this month</small>
                </div>
                <div>
                  <span className="metric-label">Due today</span>
                  <strong>2</strong>
                  <small>Keep momentum going</small>
                </div>
                <div>
                  <span className="metric-label">Completed</span>
                  <strong>
                    {activities.filter((a) => a.status === 'Completed').length}
                  </strong>
                  <small>High client touch frequency</small>
                </div>
              </section>

              <section className="panel companies-panel">
                <div className="company-toolbar">
                  <div>
                    <p className="section-kicker">Touchpoint history</p>
                    <h2>Activity timeline</h2>
                  </div>
                  <div className="company-tools">
                    <label className="search-field">
                      <Search size={15} />
                      <input
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        placeholder="Search activities"
                      />
                    </label>
                  </div>
                </div>

                <div className="company-table activities-table">
                  <div className="company-table-head">
                    <span>Activity</span>
                    <span>Contact</span>
                    <span>Company</span>
                    <span>Date</span>
                    <span>Status</span>
                    <span />
                  </div>
                  {activities.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                        <PhoneCall size={18} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No activities logged yet</h3>
                      <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                        Keep a running timeline of discovery calls, meeting minutes, and notes.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsLogCallOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                      >
                        <PhoneCall size={13} />
                        <span>Quick-log call / note (L)</span>
                      </button>
                    </div>
                  ) : (
                    activities
                      .filter(
                        (a) =>
                          a.title.toLowerCase().includes(activitySearch.toLowerCase()) ||
                          a.person.toLowerCase().includes(activitySearch.toLowerCase()) ||
                          a.company.toLowerCase().includes(activitySearch.toLowerCase())
                      )
                      .map((activity) => {
                      const isExpanded = !!expandedActivityIds[activity.id]
                      const associatedDeal = deals.find(
                        (d) => d.id === activity.dealId || d.company === activity.company
                      )

                      return (
                        <div key={`${activity.id}-${activity.title}`}>
                          <div
                            className="company-row cursor-pointer hover:bg-[#fafbfc] transition-colors"
                            onClick={() => toggleExpandActivity(activity.id)}
                          >
                            <div className="company-name">
                              <span className={`company-avatar ${activity.color}`}>
                                {activity.type.charAt(0)}
                              </span>
                              <div>
                                <strong>{activity.title}</strong>
                                <span>{activity.type}</span>
                              </div>
                            </div>
                            <div className="company-contact">
                              <strong>{activity.person}</strong>
                            </div>
                            <div className="company-contact">
                              <strong>{activity.company}</strong>
                            </div>
                            <span className="last-touch">{activity.date}</span>
                            <span
                              className={`status-pill ${
                                activity.status === 'Completed'
                                  ? 'active'
                                  : activity.status === 'Due today'
                                  ? 'prospect'
                                  : 'inactive'
                              }`}
                            >
                              {activity.status}
                            </span>
                            <div className="flex items-center justify-end">
                              {activity.summary ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    toggleExpandActivity(activity.id)
                                  }}
                                  className="w-6 h-6 flex items-center justify-center text-[#8f99a8] hover:text-[#1c1d1f] rounded transition-colors"
                                  title={isExpanded ? 'Collapse notes' : 'Expand notes'}
                                >
                                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                                </button>
                              ) : (
                                <button
                                  className="more-button"
                                  aria-label={`Options for ${activity.title}`}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <MoreHorizontal size={17} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Expanded Notes & Linked Deal Opportunity */}
                          {isExpanded && (
                            <div className="px-4 py-3 bg-[#fafbfc] border-t border-[#edf0f3] text-[12px] space-y-2.5 animate-in fade-in duration-100">
                              {activity.summary ? (
                                <div className="p-3.5 bg-white border border-[#e4e7ec] rounded-[8px] shadow-2xs">
                                  <MarkdownFormatter content={activity.summary} />
                                </div>
                              ) : (
                                <p className="text-[11px] text-[#8f99a8] italic">
                                  No detailed notes recorded for this interaction.
                                </p>
                              )}

                              {associatedDeal && (
                                <div className="flex items-center justify-between pt-1 text-[11px]">
                                  <span className="text-[#6f7988] flex items-center gap-1.5">
                                    <Building2 size={13} className="text-[#8f99a8]" />
                                    Opportunity: <strong className="text-[#1c1d1f]">{associatedDeal.title}</strong>{' '}
                                    <span className="font-mono text-[#505967]">({associatedDeal.value})</span>
                                  </span>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedDeal(associatedDeal)
                                      setIsDealDrawerOpen(true)
                                    }}
                                    className="inline-flex items-center gap-1 text-[#266df0] hover:underline font-semibold cursor-pointer"
                                  >
                                    <span>Open Deal Drawer</span>
                                    <ArrowUpRight size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })
                  )}

                  {activities.length > 0 &&
                    activities.filter(
                      (a) =>
                        a.title.toLowerCase().includes(activitySearch.toLowerCase()) ||
                        a.person.toLowerCase().includes(activitySearch.toLowerCase()) ||
                        a.company.toLowerCase().includes(activitySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                        No activities matching &ldquo;{activitySearch}&rdquo;
                      </div>
                    )}
                </div>
              </section>
            </>
          ) : activeView === 'Contacts' ? (
            /* CONTACTS VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Workspace directory</p>
                  <h1>Contacts</h1>
                  <p className="subcopy">
                    Stay close to the people who move every opportunity forward.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsNewContactOpen(true)}
                >
                  <CirclePlus size={17} />
                  <span>Add contact</span>
                  <kbd className="ml-1 px-1 bg-[#3a3e45] text-white rounded text-[10px] font-mono">
                    C
                  </kbd>
                </button>
              </section>

              <section className="company-summary">
                <div>
                  <span className="metric-label">Total contacts</span>
                  <strong>{contacts.length}</strong>
                  <small>+4 added this month</small>
                </div>
                <div>
                  <span className="metric-label">Recently contacted</span>
                  <strong>18</strong>
                  <small>75% of your directory</small>
                </div>
                <div>
                  <span className="metric-label">Open opportunities</span>
                  <strong>{openDealsCount}</strong>
                  <small>Across {companies.length} companies</small>
                </div>
              </section>

              <section className="panel companies-panel">
                <div className="company-toolbar">
                  <div>
                    <p className="section-kicker">People directory</p>
                    <h2>All contacts</h2>
                  </div>
                  <div className="company-tools">
                    <label className="search-field">
                      <Search size={15} />
                      <input
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search contacts"
                      />
                    </label>
                  </div>
                </div>

                <div className="company-table contacts-table">
                  <div className="company-table-head">
                    <span>Contact</span>
                    <span>Company</span>
                    <span>Open deals</span>
                    <span>Last touch</span>
                    <span>Email</span>
                    <span />
                  </div>
                  {contacts.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                        <Users size={18} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No contacts yet</h3>
                      <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                        Save client founders, project stakeholders, and creative partners.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewContactOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                      >
                        <UserPlus size={13} />
                        <span>Add contact (C)</span>
                      </button>
                    </div>
                  ) : (
                    contacts
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          c.email.toLowerCase().includes(contactSearch.toLowerCase())
                      )
                      .map((contact) => (
                        <div className="company-row" key={contact.id}>
                          <div className="company-name">
                            <span className={`company-avatar ${contact.color}`}>
                              {contact.name.charAt(0)}
                            </span>
                            <div>
                              <strong>{contact.name}</strong>
                              <span>{contact.role}</span>
                            </div>
                          </div>
                          <div className="company-contact">
                            <strong>{contact.company}</strong>
                            <span>{contact.email}</span>
                          </div>
                          <strong>{contact.deals}</strong>
                          <span className="last-touch">{contact.lastTouch}</span>
                          <span className="contact-email">{contact.email}</span>
                          <button
                            className="more-button"
                            aria-label={`More options for ${contact.name}`}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>
                      ))
                  )}

                  {contacts.length > 0 &&
                    contacts.filter(
                      (c) =>
                        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                        c.company.toLowerCase().includes(contactSearch.toLowerCase()) ||
                        c.email.toLowerCase().includes(contactSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                        No contacts matching &ldquo;{contactSearch}&rdquo;
                      </div>
                    )}
                </div>
              </section>
            </>
          ) : activeView === 'Companies' ? (
            /* COMPANIES VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Workspace directory</p>
                  <h1>Companies</h1>
                  <p className="subcopy">
                    Keep track of the people and businesses behind your pipeline.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsNewDealOpen(true)}
                >
                  <CirclePlus size={17} /> Add company
                </button>
              </section>

              <section className="company-summary">
                <div>
                  <span className="metric-label">Total companies</span>
                  <strong>{companies.length}</strong>
                  <small>Accounts tracked</small>
                </div>
                <div>
                  <span className="metric-label">Active accounts</span>
                  <strong>
                    {companies.filter((c) => c.status === 'Active').length}
                  </strong>
                  <small>Key client roster</small>
                </div>
                <div>
                  <span className="metric-label">Open opportunities</span>
                  <strong>{openDealsCount}</strong>
                  <small className="font-mono">
                    {totalPipelineAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč in pipeline
                  </small>
                </div>
              </section>

              <section className="panel companies-panel">
                <div className="company-toolbar">
                  <div>
                    <p className="section-kicker">All accounts</p>
                    <h2>Company directory</h2>
                  </div>
                  <div className="company-tools">
                    <label className="search-field">
                      <Search size={15} />
                      <input
                        value={companySearch}
                        onChange={(e) => setCompanySearch(e.target.value)}
                        placeholder="Search companies"
                      />
                    </label>
                  </div>
                </div>

                <div className="company-table">
                  <div className="company-table-head">
                    <span>Company</span>
                    <span>Primary contact</span>
                    <span>Open deals</span>
                    <span>Pipeline value</span>
                    <span>Status</span>
                    <span />
                  </div>
                  {companies.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                        <Building2 size={18} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No company accounts yet</h3>
                      <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                        Companies are registered automatically as you log deals and contacts.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewDealOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                      >
                        <CirclePlus size={13} />
                        <span>Add opportunity (N)</span>
                      </button>
                    </div>
                  ) : (
                    companies
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
                          c.contact.toLowerCase().includes(companySearch.toLowerCase())
                      )
                      .map((comp) => (
                        <div className="company-row" key={comp.id}>
                          <div className="company-name">
                            <span className={`company-avatar ${comp.color}`}>
                              {comp.name.charAt(0)}
                            </span>
                            <div>
                              <strong>{comp.name}</strong>
                              <span>{comp.type}</span>
                            </div>
                          </div>
                          <div className="company-contact">
                            <strong>{comp.contact}</strong>
                            <span>{comp.email}</span>
                          </div>
                          <strong>{comp.deals}</strong>
                          <strong className="font-mono tabular-nums">{comp.value}</strong>
                          <span className={`status-pill ${comp.status.toLowerCase()}`}>
                            {comp.status}
                          </span>
                          <button
                            className="more-button"
                            aria-label={`More options for ${comp.name}`}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>
                      ))
                  )}

                  {companies.length > 0 &&
                    companies.filter(
                      (c) =>
                        c.name.toLowerCase().includes(companySearch.toLowerCase()) ||
                        c.contact.toLowerCase().includes(companySearch.toLowerCase())
                    ).length === 0 && (
                      <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                        No companies matching &ldquo;{companySearch}&rdquo;
                      </div>
                    )}
                </div>
              </section>
            </>
          ) : activeView === 'Settings' ? (
            /* SETTINGS VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Workspace preferences</p>
                  <h1>Settings & System</h1>
                  <p className="subcopy">
                    Personal operator cockpit preferences, account details, and high-velocity keyboard controls.
                  </p>
                </div>
              </section>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 max-w-5xl">
                {/* CARD 1: YOUR PROFILE */}
                <div className="panel lg:col-span-5 flex flex-col justify-between">
                  <div>
                    <div className="panel-heading">
                      <div>
                        <p className="section-kicker">Operator Account</p>
                        <h2>Your Profile</h2>
                      </div>
                      <span className="status-pill active">Active</span>
                    </div>

                    <div className="settings-profile mt-4">
                      <span className="avatar large">OS</span>
                      <div>
                        <strong>Oliver Seidl</strong>
                        <span>oliver@seidltech.cz</span>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3 text-[12px]">
                      <div className="flex items-center justify-between py-1.5 border-b border-[#f0f1f3]">
                        <span className="text-[#6f7988]">Operator Role</span>
                        <strong className="text-[#1c1d1f]">Creative & Tech Operator</strong>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-[#f0f1f3]">
                        <span className="text-[#6f7988]">Default Currency</span>
                        <strong className="font-mono text-[#1c1d1f]">CZK (Kč)</strong>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-[#f0f1f3]">
                        <span className="text-[#6f7988]">Timezone</span>
                        <span className="text-[#505967]">Europe/Prague (CET)</span>
                      </div>
                      <div className="flex items-center justify-between py-1.5 border-b border-[#f0f1f3]">
                        <span className="text-[#6f7988]">Workflow Engine</span>
                        <span className="text-[#266df0] font-semibold">GTD Mandatory Next Action</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-6 mt-4 border-t border-[#f0f1f3] flex items-center justify-between">
                    <button className="select-button">
                      Change password <ArrowUpRight size={14} />
                    </button>
                    <span className="text-[10px] text-[#9fa1a7]">v1.0.4 • Personal Cockpit</span>
                  </div>
                </div>

                {/* CARD 2: KEYBOARD SHORTCUTS (TOP 10 + READ MORE) */}
                <div className="panel lg:col-span-7 flex flex-col justify-between">
                  <div>
                    <div className="panel-heading">
                      <div>
                        <p className="section-kicker">Operator Velocity</p>
                        <h2>Keyboard Shortcuts</h2>
                      </div>
                      <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[7px] bg-[#e9f0ff] text-[#266df0]">
                        Top 10 Core
                      </span>
                    </div>

                    <p className="text-[12px] text-[#6f7988] mt-2 mb-3">
                      Superhuman & Linear speed. Execute actions with single keystrokes without reaching for your mouse.
                    </p>

                    {/* Top 10 Compact List */}
                    <div className="space-y-1">
                      {[
                        { label: 'Universal Command Palette', keys: ['Ctrl+K'], tag: 'Global', primary: true },
                        { label: 'Quick-add new deal drawer', keys: ['N'], tag: 'Capture', primary: false },
                        { label: 'Quick-add new contact drawer', keys: ['C'], tag: 'Capture', primary: false },
                        { label: 'Quick-log call / meeting note', keys: ['L'], tag: 'Capture', primary: false },
                        { label: 'Navigate Kanban stage columns', keys: ['←', '→'], tag: 'Kanban', primary: false },
                        { label: 'Select deal card in column', keys: ['↑', '↓'], tag: 'Kanban', primary: false },
                        { label: 'Cycle forward through deals', keys: ['Tab'], tag: 'Kanban', primary: false },
                        { label: 'Inspect deal (slide-over drawer)', keys: ['↵'], tag: 'Kanban', primary: false },
                        { label: 'Shift deal stage left / right', keys: ['[', ']'], tag: 'Kanban', primary: false },
                        { label: 'Jump to Dashboard view', keys: ['G', 'D'], tag: 'Nav', primary: false },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-2.5 rounded-[10px] text-[12px] hover:bg-[#fafbfc] transition-colors border-b border-[#f7f8fa] last:border-b-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                item.primary ? 'bg-[#266df0]' : 'bg-[#9fa1a7]'
                              }`}
                            />
                            <span className="text-[#232529] font-medium truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            {item.keys.map((k, kIdx) => (
                              <kbd
                                key={kIdx}
                                className="px-1.5 py-0.5 min-w-[20px] text-center text-[10px] font-mono font-semibold text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded-[5px] shadow-2xs"
                              >
                                {k}
                              </kbd>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Read More Trigger Bar */}
                  <div className="pt-6 mt-4 border-t border-[#f0f1f3] flex items-center justify-between">
                    <button
                      onClick={() => setIsShortcutsOpen(true)}
                      className="select-button"
                    >
                      Read more <ArrowUpRight size={14} />
                    </button>
                    <span className="text-[10px] text-[#9fa1a7] hidden sm:inline-flex items-center gap-1">
                      <span>Or press</span>
                      <kbd className="px-1.5 py-0.5 bg-[#f4f5f6] border border-[#e4e7ec] rounded font-mono text-[10px] text-[#6f7988]">
                        ?
                      </kbd>
                      <span>anywhere</span>
                    </span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            /* DASHBOARD / OVERVIEW VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Monday, September 22, 2026</p>
                  <h1>Good morning, Oliver.</h1>
                  <p className="subcopy">Here&apos;s what needs your attention today.</p>
                </div>
              </section>

              {/* Metric Cards */}
              <section className="metric-grid" aria-label="Summary metrics">
                <div className="metric-card">
                  <div className="metric-icon dark">
                    <WalletCards size={18} />
                  </div>
                  <span className="metric-label">Pipeline value</span>
                  <strong className="font-mono tabular-nums">
                    {totalPipelineAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč
                  </strong>
                  <small>
                    {deals.length === 0 ? 'No active deals' : `${deals.length} total deals`}
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon blue">
                    <CalendarDays size={18} />
                  </div>
                  <span className="metric-label">This month</span>
                  <strong className="font-mono tabular-nums">
                    {expectedCloseAmount.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč
                  </strong>
                  <small>
                    {closingDeals.length > 0
                      ? `${closingDeals.length} deal${closingDeals.length === 1 ? '' : 's'} closing soon`
                      : 'Expected close'}
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon green">
                    <Building2 size={18} />
                  </div>
                  <span className="metric-label">Active projects</span>
                  <strong>{activeProjectsCount}</strong>
                  <small>
                    {activeProjectsCount === 0
                      ? 'No active client projects'
                      : `${activeProjectsCount} active project${activeProjectsCount === 1 ? '' : 's'}`}
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon amber">
                    <Clock size={18} />
                  </div>
                  <span className="metric-label">Follow-ups</span>
                  <strong>{followUps.length}</strong>
                  <small>
                    {dueTodayFollowUpsCount > 0 ? (
                      <>
                        <span className="warning">{dueTodayFollowUpsCount} due today</span> keep momentum
                      </>
                    ) : (
                      'All caught up'
                    )}
                  </small>
                </div>
              </section>

              {/* Dashboard Grid: Follow-ups & Pipeline stages */}
              <div className="dashboard-grid">
                {/* Follow-ups panel */}
                <section className="panel followups-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">Your next actions (GTD)</p>
                      <h2>Follow-ups</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveView('Calendar')}
                    >
                      View calendar <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="followup-list">
                    {followUps.length === 0 ? (
                      <div className="py-8 px-4 text-center">
                        <div className="w-8 h-8 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2">
                          <Check size={16} className="text-[#43a878]" />
                        </div>
                        <h4 className="text-[12px] font-semibold text-[#1c1d1f] mb-0.5">All caught up</h4>
                        <p className="text-[11px] text-[#8f99a8]">No pending follow-ups or next actions.</p>
                      </div>
                    ) : (
                      followUps.map((item, index) => {
                        const done = completedFollowUps.includes(item.id)
                        return (
                          <div
                            className={`followup-row ${done ? 'done' : ''}`}
                            key={item.id}
                          >
                            <button
                              className="check-button"
                              onClick={() => toggleFollowUp(item.id)}
                              aria-label={`Mark ${item.action} complete`}
                            >
                              {done && <Check size={13} />}
                            </button>
                            <div className="followup-copy">
                              <span className="followup-day">
                                {index === 0 || followUps[index - 1].day !== item.day
                                  ? item.day
                                  : ''}
                              </span>
                              <strong>{item.company}</strong>
                              <span>{item.action}</span>
                            </div>
                            <time>{item.time}</time>
                            <MoreHorizontal size={17} className="muted-icon" />
                          </div>
                        )
                      })
                    )}
                  </div>

                  <button
                    className="add-action"
                    onClick={() => setIsLogCallOpen(true)}
                  >
                    <CirclePlus size={16} />
                    <span>Quick-log follow-up</span>
                    <kbd className="ml-1 text-[10px] font-mono text-[#9fa1a7]">L</kbd>
                  </button>
                </section>

                {/* Pipeline breakdown panel */}
                <section className="panel pipeline-panel">
                  <div className="panel-heading">
                    <div>
                      <p className="section-kicker">Sales overview</p>
                      <h2>Pipeline</h2>
                    </div>
                    <button
                      className="text-button"
                      onClick={() => setActiveView('Deals')}
                    >
                      Open Kanban <ArrowUpRight size={14} />
                    </button>
                  </div>

                  <div className="pipeline-list">
                    {pipelineStagesSummary.map((item, index) => (
                      <div
                        className="pipeline-row cursor-pointer hover:bg-[#fafbfc] rounded px-1 -mx-1"
                        key={item.label}
                        onClick={() => setActiveView('Deals')}
                      >
                        <div className="pipeline-name">
                          <span className={`stage-dot dot-${(index % 5) + 1}`} />
                          <strong>{item.label}</strong>
                        </div>
                        <div className="pipeline-bar">
                          <span
                            style={{
                              width:
                                deals.length > 0 && item.count > 0
                                  ? `${Math.min(100, Math.max(12, (item.count / deals.length) * 100))}%`
                                  : '0%',
                            }}
                          />
                        </div>
                        <span className="pipeline-count">{item.count}</span>
                        <span className="pipeline-amount font-mono tabular-nums">
                          {item.amount}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="pipeline-footer">
                    <span>{deals.length} active deals</span>
                    <button
                      className="text-button"
                      onClick={() => setActiveView('Deals')}
                    >
                      Open board <ArrowUpRight size={14} />
                    </button>
                  </div>
                </section>
              </div>

              {/* Active Deals Directory in Dashboard */}
              <section className="panel deals-panel">
                <div className="panel-heading">
                  <div>
                    <p className="section-kicker">Keep an eye on</p>
                    <h2>Active deals</h2>
                  </div>
                  <div className="panel-heading-actions">
                    {isDealSearchOpen ? (
                      <label className="search-field animate-in fade-in duration-150">
                        <Search size={14} />
                        <input
                          autoFocus
                          value={dealSearch}
                          onChange={(e) => setDealSearch(e.target.value)}
                          placeholder="Search deals..."
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                              setDealSearch('')
                              setIsDealSearchOpen(false)
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setDealSearch('')
                            setIsDealSearchOpen(false)
                          }}
                          className="text-xs text-[#8f99a8] hover:text-[#1c1d1f] ml-0.5 px-0.5"
                          aria-label="Close search"
                        >
                          ×
                        </button>
                      </label>
                    ) : (
                      <button
                        className="icon-button"
                        onClick={() => setIsDealSearchOpen(true)}
                        title="Search active deals"
                        aria-label="Search active deals"
                      >
                        <Search size={16} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="tabs">
                  {['Overview', 'Closing soon', 'Recently added'].map((tab) => (
                    <button
                      key={tab}
                      className={activeTab === tab ? 'tab-active' : ''}
                      onClick={() => setActiveTab(tab)}
                    >
                      {tab}
                    </button>
                  ))}
                </div>

                <div className="deal-table">
                  <div className="table-head">
                    <span>Deal</span>
                    <span>Stage</span>
                    <span>Value</span>
                    <span>Probability</span>
                    <span>Next action</span>
                    <span />
                  </div>
                  {deals.length === 0 ? (
                    <div className="py-12 px-4 text-center">
                      <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                        <WalletCards size={18} />
                      </div>
                      <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No deals in pipeline</h3>
                      <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                        Track client scopes, estimated value, and GTD next steps.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewDealOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                      >
                        <CirclePlus size={13} />
                        <span>Add first deal (N)</span>
                      </button>
                    </div>
                  ) : (
                    deals
                      .filter((deal) => {
                        if (dealSearch.trim()) {
                          const q = dealSearch.toLowerCase().trim()
                          const matches =
                            deal.title.toLowerCase().includes(q) ||
                            deal.company.toLowerCase().includes(q) ||
                            deal.stage.toLowerCase().includes(q) ||
                            (deal.next && deal.next.toLowerCase().includes(q)) ||
                            deal.value.toLowerCase().includes(q)
                          if (!matches) return false
                        }
                        if (activeTab === 'Closing soon') {
                          return (
                            deal.stage === 'Quote sent' ||
                            deal.stage === 'Negotiation' ||
                            parseInt(deal.probability) >= 70
                          )
                        }
                        if (activeTab === 'Recently added') {
                          return deal.stage === 'Lead'
                        }
                        return true
                      })
                      .map((deal) => (
                        <div
                          className="deal-row cursor-pointer hover:bg-[#fafbfc] transition-colors"
                          key={deal.id}
                          onClick={() => {
                            setSelectedDeal(deal)
                            setIsDealDrawerOpen(true)
                          }}
                        >
                          <div className="deal-title">
                            <span className={`deal-avatar ${deal.color}`}>
                              {deal.company.charAt(0)}
                            </span>
                            <div>
                              <strong>{deal.title}</strong>
                              <span>{deal.company}</span>
                            </div>
                          </div>
                          <span className="stage-pill">{deal.stage}</span>
                          <strong className="font-mono tabular-nums">{deal.value}</strong>
                          <span className="probability font-mono">{deal.probability}</span>
                          <span className="next-action flex items-center gap-1">
                            <Clock size={12} className="text-[#266df0]" />
                            <span>{deal.next}</span>
                          </span>
                          <button
                            className="more-button"
                            aria-label={`More options for ${deal.title}`}
                          >
                            <MoreHorizontal size={17} />
                          </button>
                        </div>
                      ))
                  )}
                  {deals.length > 0 &&
                    dealSearch.trim() &&
                    deals.filter((deal) => {
                      const q = dealSearch.toLowerCase().trim()
                      return (
                        deal.title.toLowerCase().includes(q) ||
                        deal.company.toLowerCase().includes(q) ||
                        deal.stage.toLowerCase().includes(q) ||
                        (deal.next && deal.next.toLowerCase().includes(q)) ||
                        deal.value.toLowerCase().includes(q)
                      )
                    }).length === 0 && (
                      <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                        No deals matching &ldquo;{dealSearch}&rdquo;
                      </div>
                    )}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* COMMAND PALETTE (Ctrl+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelectAction={handlePaletteAction}
        deals={deals}
        contacts={contacts}
        companies={companies}
        onUpdateDeal={handleUpdateDeal}
        onSyncTodos={handleSyncTodos}
        onAddActivity={(act) => handleLogActivity(act)}
      />

      {/* SHORTCUTS CHEATSHEET MODAL (?) */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* QUICK ADD DEAL MODAL (N) */}
      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={() => setIsNewDealOpen(false)}
        onAddDeal={handleAddDeal}
        companies={companies}
      />

      {/* QUICK ADD CONTACT MODAL (C) */}
      <NewContactModal
        isOpen={isNewContactOpen}
        onClose={() => setIsNewContactOpen(false)}
        onAddContact={handleAddContact}
        companies={companies}
      />

      {/* QUICK LOG CALL / MEETING NOTE MODAL (L) */}
      <LogCallModal
        isOpen={isLogCallOpen}
        onClose={() => setIsLogCallOpen(false)}
        onLogActivity={handleLogActivity}
        companies={companies}
        contacts={contacts}
        deals={deals}
        initialDealId={selectedDeal?.id}
      />

      {/* SLIDE-OVER DEAL DETAIL DRAWER */}
      <DealDetailDrawer
        deal={selectedDeal}
        isOpen={isDealDrawerOpen}
        onClose={() => setIsDealDrawerOpen(false)}
        onUpdateDeal={handleUpdateDeal}
        onDeleteDeal={handleDeleteDeal}
        onSyncTodos={handleSyncTodos}
        activities={activities}
        onAddActivity={(act) => handleLogActivity(act)}
        onOpenLogCallModal={() => setIsLogCallOpen(true)}
      />

      {/* FLOATING TOAST HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
