'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import {
  ArrowUpRight,
  Building2,
  CalendarDays,
  Check,
  ChevronDown,
  CirclePlus,
  FileText,
  LayoutDashboard,
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

      // Cmd+K or Ctrl+K: Toggle Command Palette anywhere
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
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

  // Log Activity Handler
  const handleLogActivity = (
    activityData: Omit<Activity, 'id'>,
    followUpData?: Omit<FollowUpItem, 'id'>
  ) => {
    const newActivity: Activity = {
      ...activityData,
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

    addToast(`Logged ${newActivity.type} with ${newActivity.person}`, 'L')
  }

  // Update Deal in list
  const handleUpdateDeal = (updated: Deal) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    if (selectedDeal?.id === updated.id) {
      setSelectedDeal(updated)
    }
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
            color:
              newStage === 'Won'
                ? 'green'
                : newStage === 'Qualified'
                ? 'amber'
                : newStage === 'Scope' || newStage === 'Negotiation'
                ? 'violet'
                : 'blue',
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
              title="Search workspace (Cmd+K)"
            >
              <Search size={14} />
              <span>Search workspace...</span>
              <span className="search-shortcut">⌘K</span>
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
                  <strong className="font-mono tabular-nums">86 000 Kč</strong>
                  <small>3 deals closing this month</small>
                </div>
                <div>
                  <span className="metric-label">Win rate</span>
                  <strong>68%</strong>
                  <small>Last 90 days</small>
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
            <CalendarView />
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
                  {activities
                    .filter(
                      (a) =>
                        a.title.toLowerCase().includes(activitySearch.toLowerCase()) ||
                        a.person.toLowerCase().includes(activitySearch.toLowerCase()) ||
                        a.company.toLowerCase().includes(activitySearch.toLowerCase())
                    )
                    .map((activity) => (
                      <div
                        className="company-row"
                        key={`${activity.id}-${activity.title}`}
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
                        <button
                          className="more-button"
                          aria-label={`Options for ${activity.title}`}
                        >
                          <MoreHorizontal size={17} />
                        </button>
                      </div>
                    ))}
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
                  {contacts
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
                    ))}
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
                  <small>+2 added this month</small>
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
                  {companies
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
                    ))}
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
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-md bg-[#e9f0ff] text-[#266df0]">
                        Top 10 Core
                      </span>
                    </div>

                    <p className="text-[12px] text-[#6f7988] mt-2 mb-3">
                      Superhuman & Linear speed. Execute actions with single keystrokes without reaching for your mouse.
                    </p>

                    {/* Top 10 Compact List */}
                    <div className="space-y-1">
                      {[
                        { label: 'Universal Command Palette', keys: ['⌘K'], tag: 'Global', color: 'blue' },
                        { label: 'Quick-add new deal drawer', keys: ['N'], tag: 'Capture', color: 'amber' },
                        { label: 'Quick-add new contact drawer', keys: ['C'], tag: 'Capture', color: 'violet' },
                        { label: 'Quick-log call / meeting note', keys: ['L'], tag: 'Capture', color: 'green' },
                        { label: 'Navigate Kanban stage columns', keys: ['H', 'L'], tag: 'Kanban', color: 'blue' },
                        { label: 'Select deal card in column', keys: ['J', 'K'], tag: 'Kanban', color: 'blue' },
                        { label: 'Inspect deal (slide-over drawer)', keys: ['↵'], tag: 'Kanban', color: 'blue' },
                        { label: 'Shift deal stage left / right', keys: ['[', ']'], tag: 'Kanban', color: 'amber' },
                        { label: 'Jump to Dashboard view', keys: ['G', 'D'], tag: 'Nav', color: 'violet' },
                        { label: 'Jump to Deals & Pipeline', keys: ['G', 'P'], tag: 'Nav', color: 'violet' },
                      ].map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between py-1.5 px-2.5 rounded-lg text-[12px] hover:bg-[#fafbfc] transition-colors border-b border-[#f7f8fa] last:border-b-0"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                                item.color === 'violet'
                                  ? 'bg-[#805ad5]'
                                  : item.color === 'amber'
                                  ? 'bg-[#c4882b]'
                                  : item.color === 'green'
                                  ? 'bg-[#43a878]'
                                  : 'bg-[#266df0]'
                              }`}
                            />
                            <span className="text-[#232529] font-medium truncate">{item.label}</span>
                          </div>
                          <div className="flex items-center gap-1 shrink-0 ml-3">
                            {item.keys.map((k, kIdx) => (
                              <kbd
                                key={kIdx}
                                className="px-1.5 py-0.5 min-w-[20px] text-center text-[10px] font-mono font-semibold text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded shadow-2xs"
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
                    <span className="positive">+12.4%</span> vs last month
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon blue">
                    <CalendarDays size={18} />
                  </div>
                  <span className="metric-label">This month</span>
                  <strong className="font-mono tabular-nums">86 000 Kč</strong>
                  <small>
                    <span className="positive">+8.2%</span> expected close
                  </small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon green">
                    <Building2 size={18} />
                  </div>
                  <span className="metric-label">Active projects</span>
                  <strong>4</strong>
                  <small>2 launching this month</small>
                </div>

                <div className="metric-card">
                  <div className="metric-icon amber">
                    <Clock size={18} />
                  </div>
                  <span className="metric-label">Follow-ups</span>
                  <strong>{followUps.length}</strong>
                  <small>
                    <span className="warning">2 due today</span> keep momentum
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
                    {followUps.map((item, index) => {
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
                    })}
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
                              width: `${Math.min(
                                100,
                                Math.max(15, (item.count / deals.length) * 100)
                              )}%`,
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
                    <button
                      className="icon-button"
                      onClick={() => setIsPaletteOpen(true)}
                      title="Search (⌘K)"
                    >
                      <Search size={16} />
                    </button>
                    <button
                      className="select-button"
                      onClick={() => setActiveView('Deals')}
                    >
                      All stages <ChevronDown size={14} />
                    </button>
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
                  {deals.map((deal) => (
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
                  ))}
                </div>
              </section>
            </>
          )}
        </div>
      </main>

      {/* COMMAND PALETTE (Cmd+K) */}
      <CommandPalette
        isOpen={isPaletteOpen}
        onClose={() => setIsPaletteOpen(false)}
        onSelectAction={handlePaletteAction}
        deals={deals}
        contacts={contacts}
        companies={companies}
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
      />

      {/* SLIDE-OVER DEAL DETAIL DRAWER */}
      <DealDetailDrawer
        deal={selectedDeal}
        isOpen={isDealDrawerOpen}
        onClose={() => setIsDealDrawerOpen(false)}
        onUpdateDeal={handleUpdateDeal}
        onDeleteDeal={handleDeleteDeal}
      />

      {/* FLOATING TOAST HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
