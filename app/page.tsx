'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import {
  ArrowUpRight,
  CirclePlus,
  FileText,
  LayoutDashboard,
  Search,
  Settings2,
  Users,
  WalletCards,
  UserPlus,
  Keyboard,
  Download,
  Trash2,
  Mail,
  Edit3,
  Upload,
  Calendar,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import {
  exportDealsCSV,
  exportContactsCSV,
  exportFollowUpsCSV,
} from '@/lib/csv-export'
import { getFormattedToday, getDynamicGreeting } from '@/lib/date-utils'
import { OPERATOR_CONFIG, formatMoney, getOperatorInitials } from '@/lib/config'
import { Deal, Contact, FollowUpItem, DealStage, OPEN_DEAL_STAGES, isPmStage } from '@/lib/crm-types'
import { useModKey } from '@/lib/use-mod-key'
import {
  INITIAL_CONTACTS,
  INITIAL_DEALS,
  INITIAL_FOLLOW_UPS,
} from '@/lib/crm-data'
import {
  CommandPalette,
  PaletteActionType,
} from '@/components/command-palette/command-palette'
import { NotesModal } from '@/components/modals/notes-modal'
import { ShortcutsModal } from '@/components/modals/shortcuts-modal'
import { NewDealModal } from '@/components/modals/new-deal-modal'
import { NewContactModal } from '@/components/modals/new-contact-modal'
import { EditFollowUpModal } from '@/components/modals/edit-follow-up-modal'
import { EditSettingsModal } from '@/components/modals/edit-settings-modal'
import { DealList } from '@/components/deals/deal-list'
import { DealDetail } from '@/components/deals/deal-detail'
import { TodayList, buildToday } from '@/components/home/today-list'
import { ToastHUD, ToastHUDItem } from '@/components/ui/toast-hud'
import { OperatorGate } from '@/components/auth/operator-gate'
import { SetupWizard } from '@/components/auth/setup-wizard'
import { RowActionMenu } from '@/components/ui/row-action-menu'
import { WorkspaceSettings } from '@/lib/crm-types'
import {
  fetchWorkspaceData,
  createDealAction,
  updateDealAction,
  deleteDealAction,
  moveDealStageAction,
  createContactAction,
  updateContactAction,
  deleteContactAction,
  deleteFollowUpAction,
  updateFollowUpAction,
  toggleFollowUpAction,
} from '@/app/actions/crm'
import {
  getAuthStatus,
  logoutOperator,
  updateWorkspaceSettingsAction,
} from '@/app/actions/auth'


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
  const modKey = useModKey()
  // Navigation & View State
  const [activeView, setActiveView] = useState<string>('Home')
  /** Deal shown in the 'Deal' view, and the view Back returns to */
  const [openDealId, setOpenDealId] = useState<string | null>(null)
  const [dealReturnView, setDealReturnView] = useState<string>('Deals')

  // Dynamic Dashboard Date & Greeting
  const [formattedToday, setFormattedToday] = useState<string>('')
  const [greeting, setGreeting] = useState<string>('')

  useEffect(() => {
    setFormattedToday(getFormattedToday())
  }, [])

  // CRM Data State
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS)
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS)
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(INITIAL_FOLLOW_UPS)
  const [completedFollowUps, setCompletedFollowUps] = useState<string[]>([])

  // Search in sub-views
  const [contactSearch, setContactSearch] = useState('')
  // Modals State
  const [isPaletteOpen, setIsPaletteOpen] = useState(false)
  /** Deal whose notes the palette should open on (set by "Notes" on a deal row) */
  const [notesDealId, setNotesDealId] = useState<string | null>(null)
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false)
  const [isNewDealOpen, setIsNewDealOpen] = useState(false)
  const [isNewContactOpen, setIsNewContactOpen] = useState(false)
  const [prefilledClient, setPrefilledClient] = useState<string | undefined>(undefined)

  // Editing state for entities
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpItem | null>(null)
  const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false)
  const [settingsModalInitialTab, setSettingsModalInitialTab] = useState<'profile' | 'calendar'>('profile')
  const [settingsTab, setSettingsTab] = useState<'profile' | 'shortcuts' | 'export' | 'system'>('profile')
  const [shortcutFilter, setShortcutFilter] = useState('')

  // Floating Toasts / HUD
  const [toasts, setToasts] = useState<ToastHUDItem[]>([])
  const toastCounterRef = useRef(0)

  const addToast = useCallback((message: string, shortcut?: string, type: ToastHUDItem['type'] = 'success') => {
    toastCounterRef.current += 1
    const rand = Math.random().toString(36).substring(2, 7)
    const id = `toast-${Date.now()}-${toastCounterRef.current}-${rand}`
    setToasts((prev) => [...prev.slice(-1), { id, message, shortcut, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 2500)
  }, [])

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }

  // Auth & Backend Loading State
  const [isLoading, setIsLoading] = useState(true)
  const [authRequired, setAuthRequired] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(true)
  const [isSetupComplete, setIsSetupComplete] = useState(true)
  const [currentSettings, setCurrentSettings] = useState<WorkspaceSettings>({
    operatorName: OPERATOR_CONFIG.name,
    operatorEmail: OPERATOR_CONFIG.email,
    operatorRole: OPERATOR_CONFIG.role,
    currency: OPERATOR_CONFIG.currency,
    currencySymbol: OPERATOR_CONFIG.currencySymbol,
    locale: OPERATOR_CONFIG.locale,
    isClaimed: false,
  })
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'error'>('checking')

  const loadData = useCallback(async () => {
    try {
      const auth = await getAuthStatus()
      setAuthRequired(auth.required)
      setIsAuthenticated(auth.authenticated)
      setIsSetupComplete(auth.isSetupComplete)

      if (auth.settings) {
        setCurrentSettings(auth.settings)
        const firstName = auth.settings.operatorName.trim().split(' ')[0]
        setGreeting(getDynamicGreeting(firstName))
      }

      if (auth.isSetupComplete && (auth.authenticated || !auth.required)) {
        const data = await fetchWorkspaceData()
        setDeals(data.deals)
        setContacts(data.contacts)
        setFollowUps(data.followUps)
        setCompletedFollowUps(
          data.followUps.filter((f) => f.completed).map((f) => f.id)
        )
        if (data.settings) {
          setCurrentSettings(data.settings)
        }
        setDbStatus('connected')
      }
    } catch (err: any) {
      console.error('Failed to load workspace data:', err)
      setDbStatus('error')
      addToast('Error loading workspace data', undefined, 'warning')
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // ?settings=open deep link opens the settings modal
  useEffect(() => {
    if (typeof window === 'undefined') return
    const url = new URL(window.location.href)
    if (url.searchParams.get('settings') !== 'open') return
    setIsEditSettingsOpen(true)
    url.searchParams.delete('settings')
    window.history.replaceState({}, '', url.pathname + url.search + url.hash)
  }, [])

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
      const isBlockingModalOpen =
        isPaletteOpen ||
        notesDealId !== null ||
        isShortcutsOpen ||
        isNewDealOpen ||
        isNewContactOpen

      if (e.key === 'Escape') {
        if (isPaletteOpen) setIsPaletteOpen(false)
        if (isShortcutsOpen) setIsShortcutsOpen(false)
        if (isNewDealOpen) setIsNewDealOpen(false)
        if (isNewContactOpen) setIsNewContactOpen(false)
        if (!isBlockingModalOpen && activeView === 'Deal') {
          setOpenDealId(null)
          setActiveView(dealReturnView)
        }
        return
      }

      // If a blocking modal is open, don't trigger global background hotkeys
      if (isBlockingModalOpen) return

      const key = e.key.toLowerCase()

      // ? or Shift+/ : Show Shortcuts
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        e.preventDefault()
        setIsShortcutsOpen(true)
        return
      }

      // Handle G chords: 'g' then 'd', 'p', 'u', 'k', 's'
      if (pendingChordRef.current === 'g') {
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
        pendingChordRef.current = null

        if (key === 'd') {
          e.preventDefault()
          setActiveView('Home')
          addToast('Navigated to Home', 'G D')
          return
        } else if (key === 'p') {
          e.preventDefault()
          setActiveView('Deals')
          addToast('Navigated to Deals', 'G P')
          return
        } else if (key === 'u') {
          e.preventDefault()
          setActiveView('Clients')
          addToast('Navigated to Clients', 'G U')
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
        addToast('Quick Capture Client', 'C')
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
    notesDealId,
    isShortcutsOpen,
    isNewDealOpen,
    isNewContactOpen,
    addToast,
    activeView,
    dealReturnView,
  ])

  // Clicking a deal opens its in-app subpage; Back / Esc returns to where you were
  const openDeal = (deal: Deal) => {
    setOpenDealId(deal.id)
    if (activeView !== 'Deal') setDealReturnView(activeView)
    setActiveView('Deal')
  }
  const closeDeal = () => {
    setOpenDealId(null)
    setActiveView(dealReturnView)
  }
  const openedDeal = openDealId ? deals.find((d) => d.id === openDealId) ?? null : null

  // The open deal was deleted (here or from the palette): go back
  useEffect(() => {
    if (activeView === 'Deal' && !openedDeal) setActiveView(dealReturnView)
  }, [activeView, openedDeal, dealReturnView])

  // Deal notes open in their own light modal
  const openDealNotes = (deal: Deal) => setNotesDealId(deal.id)

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
      case 'show_shortcuts':
        setIsShortcutsOpen(true)
        break
      case 'open_deal':
        if (payload?.id) {
          openDeal(payload)
        }
        break
      case 'open_contact':
        setActiveView('Clients')
        if (payload?.name) setContactSearch(payload.name)
        break
      case 'open_deal_notes':
        setNotesDealId(payload)
        break
      case 'open_scratchpad':
        setIsPaletteOpen(true)
        break
      default:
        break
    }
  }

  // Create Deal Handler
  const handleAddDeal = async (dealData: Omit<Deal, 'id'>) => {
    try {
      const newDeal = await createDealAction(dealData)
      setDeals((prev) => [newDeal, ...prev])
      addToast(`Added deal "${newDeal.title}"`, 'N')
    } catch (err: any) {
      addToast(err?.message || 'Failed to create deal', undefined, 'warning')
    }
  }

  // Create Contact Handler
  const handleAddContact = async (contactData: Omit<Contact, 'id'>) => {
    try {
      const newContact = await createContactAction(contactData)
      setContacts((prev) => [newContact, ...prev])
      addToast(`Added client "${newContact.name}"`, 'C')
    } catch (err: any) {
      addToast(err?.message || 'Failed to create client', undefined, 'warning')
    }
  }

  // Update Deal in list
  const handleUpdateDeal = async (updated: Deal, opts?: { silent?: boolean }) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    try {
      const saved = await updateDealAction(updated)
      setDeals((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
      if (!opts?.silent) addToast(`Deal "${saved.title}" updated`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update deal', undefined, 'warning')
    }
  }

  // Update Contact
  const handleUpdateContact = async (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    try {
      const saved = await updateContactAction(updated)
      setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      addToast(`Client "${saved.name}" updated`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update client', undefined, 'warning')
    }
  }

  // Update Follow-up
  const handleUpdateFollowUp = async (updated: FollowUpItem) => {
    setFollowUps((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    try {
      const saved = await updateFollowUpAction(updated as any)
      setFollowUps((prev) => prev.map((f) => (f.id === saved.id ? saved : f)))
      addToast('Follow-up updated')
    } catch (err: any) {
      addToast(err?.message || 'Failed to update follow-up', undefined, 'warning')
    }
  }

  // Sync action items from Scratchpad to Dashboard Follow-ups
  // Delete Deal
  const handleDeleteDeal = async (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id))
    try {
      await deleteDealAction(id)
      addToast('Deal deleted')
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete deal', undefined, 'warning')
    }
  }

  // Delete Client (server first: a client with deals can't be deleted)
  const handleDeleteContact = async (id: string, name: string) => {
    const linkedDeals = deals.filter((d) => d.contactId === id).length
    if (linkedDeals > 0) {
      addToast(
        `"${name}" still has ${linkedDeals} deal${linkedDeals === 1 ? '' : 's'}. Delete or reassign them first.`,
        undefined,
        'warning'
      )
      return
    }
    try {
      await deleteContactAction(id)
      setContacts((prev) => prev.filter((c) => c.id !== id))
      addToast(`Client "${name}" deleted`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete client', undefined, 'warning')
    }
  }

  // Delete Follow-up
  const handleDeleteFollowUp = async (id: string) => {
    setFollowUps((prev) => prev.filter((f) => f.id !== id))
    setCompletedFollowUps((prev) => prev.filter((x) => x !== id))
    addToast('Follow-up removed')
    try {
      await deleteFollowUpAction(id)
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete follow-up', undefined, 'warning')
    }
  }

  const handleMoveDealStage = async (dealId: string, newStage: DealStage) => {
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)))
    addToast(newStage === 'Closed' ? 'Deal closed: contract signed, PM starts' : `Moved deal to ${newStage}`)

    try {
      const updated = await moveDealStageAction(dealId, newStage)
      if (updated) {
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      }
    } catch (err: any) {
      addToast(err?.message || 'Failed to move deal stage', undefined, 'warning')
    }
  }

  // Follow-up toggle complete
  const toggleFollowUp = async (id: string) => {
    setCompletedFollowUps((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
    try {
      await toggleFollowUpAction(id)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update follow-up', undefined, 'warning')
    }
  }

  // Operator Lock Action
  const handleLockWorkspace = async () => {
    await logoutOperator()
    setIsAuthenticated(false)
    addToast('Workspace locked')
  }


  // Compute metrics
  const openDeals = deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage))
  const openDealsCount = openDeals.length
  const totalPipelineAmount = openDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  const getContactOpenDealsCount = (contact: Contact) =>
    openDeals.filter((d) => d.contactId === contact.id).length

  const closingDeals = deals.filter((d) => d.stage === 'Proposal')
  const expectedCloseAmount = closingDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  // Closed = contract signed, so every PM stage (Closed…Completed) counts as closed
  const wonDealsCount = deals.filter((d) => isPmStage(d.stage)).length
  const winRate = deals.length > 0 ? `${Math.round((wonDealsCount / deals.length) * 100)}%` : '0%'

  const todayGroups = buildToday(deals, followUps, completedFollowUps)

  if (isLoading) {
    return (
      <div className="min-h-screen w-full bg-[#0d0f12] flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-[#2563eb] border-t-transparent animate-spin" />
          <p className="text-xs text-[#8f99a8] font-mono">Initializing workspace...</p>
        </div>
      </div>
    )
  }

  // 1. FIRST-RUN SETUP WIZARD (Claim workspace)
  if (!isSetupComplete) {
    return (
      <SetupWizard
        envAuthRequired={authRequired}
        onSetupComplete={(newSettings) => {
          setCurrentSettings(newSettings)
          setIsSetupComplete(true)
          setIsAuthenticated(true)
          loadData()
          addToast(`Welcome to your workspace, ${newSettings.operatorName}!`)
        }}
      />
    )
  }

  // 2. OPERATOR LOCK GATE
  if (authRequired && !isAuthenticated) {
    return (
      <OperatorGate
        operatorName={currentSettings.operatorName}
        onAuthenticated={() => {
          setIsAuthenticated(true)
          loadData()
        }}
      />
    )
  }

  return (
    <div className="app-shell">
      {/* SIDEBAR */}
      <aside className="sidebar">

        <div className="brand">
          <span className="brand-mark">{currentSettings.operatorName.charAt(0) || 'S'}</span>
          <span>{currentSettings.operatorName}</span>
        </div>
        <nav className="nav-group" aria-label="Primary navigation">
          <p className="nav-label">Workspace</p>
          <NavItem
            icon={LayoutDashboard}
            label="Home"
            active={activeView === 'Home'}
            onClick={() => setActiveView('Home')}
          />
          <NavItem
            icon={Users}
            label="Clients"
            badge={String(contacts.length)}
            active={activeView === 'Clients'}
            onClick={() => setActiveView('Clients')}
          />
          <NavItem
            icon={WalletCards}
            label="Deals"
            badge={String(deals.length)}
            active={activeView === 'Deals'}
            onClick={() => setActiveView('Deals')}
          />
          <p className="nav-label second">Manage</p>
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
            <strong>Workspace synced</strong>
            <span>Last synced just now</span>
          </div>
        </div>
      </aside>

      {/* MOBILE NAV (sidebar is hidden below 760px) */}
      <nav className="mobile-nav" aria-label="Primary navigation (mobile)">
        {[
          { label: 'Home', icon: LayoutDashboard },
          { label: 'Clients', icon: Users },
          { label: 'Deals', icon: WalletCards },
          { label: 'Settings', icon: Settings2 },
        ].map(({ label, icon: Icon }) => (
          <button
            key={label}
            type="button"
            className={activeView === label ? 'active' : ''}
            aria-current={activeView === label ? 'page' : undefined}
            onClick={() => setActiveView(label)}
          >
            <Icon size={19} strokeWidth={1.8} />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {/* MAIN CONTENT AREA */}
      <main className="main-content">
        {/* TOPBAR */}
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span>/</span>
            {activeView === 'Deal' && openedDeal ? (
              <>
                <button type="button" onClick={closeDeal} className="cursor-pointer hover:text-[#1c1d1f]">
                  {dealReturnView}
                </button>
                <span>/</span>
                <strong className="truncate max-w-[40ch]">{openedDeal.title}</strong>
              </>
            ) : (
              <strong>{activeView}</strong>
            )}
          </div>

          <div className="top-actions">
            <button
              type="button"
              onClick={() => setIsPaletteOpen(true)}
              className="topbar-search"
              title={`Search workspace (${modKey}+K)`}
            >
              <Search size={14} />
              <span>Search workspace...</span>
              <span className="search-shortcut">{modKey}+K</span>
            </button>

            <button className="avatar" title={currentSettings.operatorName}>
              {getOperatorInitials(currentSettings.operatorName)}
            </button>
          </div>
        </header>

        {/* VIEW CONTAINER */}
        <div className="content-wrap">
          {activeView === 'Deal' && openedDeal ? (
            /* DEAL VIEW: one deal, CRM info + PM progress */
            <DealDetail
              deal={openedDeal}
              settings={currentSettings}
              onBack={closeDeal}
              onEdit={(deal) => {
                setEditingDeal(deal)
                setIsNewDealOpen(true)
              }}
              onOpenNotes={openDealNotes}
              onMoveStage={handleMoveDealStage}
              onDelete={(id) => {
                closeDeal()
                handleDeleteDeal(id)
              }}
            />
          ) : activeView === 'Deals' ? (
            /* DEALS VIEW (list) */
            <>
              <section className="page-heading">
                <div>
                  <h1>Deals</h1>
                  <p className="subcopy">
                    Every deal in one list. Filter by stage, or change a deal’s stage from its row.
                  </p>
                </div>
              </section>

              {/* Deal Metrics Summary */}
              <section className="deal-summary">
                <div>
                  <span className="metric-label">Open deals</span>
                  <strong>{openDealsCount}</strong>
                  <small>In {OPEN_DEAL_STAGES.join(', ').replace(/, ([^,]*)$/, ' or $1')}</small>
                </div>
                <div>
                  <span className="metric-label">Pipeline value</span>
                  <strong className="font-mono tabular-nums">
                    {formatMoney(totalPipelineAmount, currentSettings)}
                  </strong>
                  <small>
                    {deals.length === 0 ? 'No active pipeline' : `Across ${deals.length} deal${deals.length === 1 ? '' : 's'} in total`}
                  </small>
                </div>
                <div>
                  <span className="metric-label">Expected close</span>
                  <strong className="font-mono tabular-nums">
                    {formatMoney(expectedCloseAmount, currentSettings)}
                  </strong>
                  <small>
                    {closingDeals.length} deal{closingDeals.length === 1 ? '' : 's'} closing soon
                  </small>
                </div>
                <div>
                  <span className="metric-label">Close rate</span>
                  <strong>{winRate}</strong>
                  <small>Closed / total</small>
                </div>
              </section>

              <DealList
                deals={deals}
                settings={currentSettings}
                onOpenDeal={openDeal}
                onEditDeal={(deal) => {
                  setEditingDeal(deal)
                  setIsNewDealOpen(true)
                }}
                onAddDealClick={() => setIsNewDealOpen(true)}
                onMoveDealStage={handleMoveDealStage}
                onDeleteDeal={handleDeleteDeal}
                onOpenNotes={openDealNotes}
              />
            </>
          ) : activeView === 'Clients' ? (
            /* CLIENTS VIEW */
            <>
              <section className="page-heading">
                <div>
                  <h1>Clients</h1>
                  <p className="subcopy">
                    Everyone you work with. Click a client to edit their details.
                  </p>
                </div>
                <button
                  className="primary-button"
                  onClick={() => setIsNewContactOpen(true)}
                >
                  <CirclePlus size={17} />
                  <span>Add client</span>
                </button>
              </section>

              <section className="company-summary">
                <div>
                  <span className="metric-label">Total clients</span>
                  <strong>{contacts.length}</strong>
                  <small>People you work with</small>
                </div>
                <div>
                  <span className="metric-label">Active pipeline</span>
                  <strong>
                    {contacts.filter((c) => getContactOpenDealsCount(c) > 0).length}
                  </strong>
                  <small>With at least one open deal</small>
                </div>
                <div>
                  <span className="metric-label">Open deals</span>
                  <strong>{openDealsCount}</strong>
                  <small className="font-mono">
                    {formatMoney(totalPipelineAmount, currentSettings)} in pipeline
                  </small>
                </div>
              </section>

              <section className="panel companies-panel">
                <div className="company-toolbar">
                  <div>
                    <p className="section-kicker">People directory</p>
                    <h2>All clients</h2>
                  </div>
                  <div className="company-tools">
                    <label className="search-field">
                      <Search size={15} />
                      <input
                        value={contactSearch}
                        onChange={(e) => setContactSearch(e.target.value)}
                        placeholder="Search clients"
                      />
                    </label>
                  </div>
                </div>

                <div className="company-table contacts-table">
                  <div className="company-table-head">
                    <span>Client</span>
                    <span>Phone</span>
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
                      <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No clients yet</h3>
                      <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                        Save client founders, project stakeholders, and creative partners.
                      </p>
                      <button
                        type="button"
                        onClick={() => setIsNewContactOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                      >
                        <UserPlus size={13} />
                        <span>Add client</span>
                      </button>
                    </div>
                  ) : (
                    contacts
                      .filter(
                        (c) =>
                          c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                          (c.phone || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                          c.email.toLowerCase().includes(contactSearch.toLowerCase())
                      )
                      .map((contact) => {
                        return (
                          <div
                            className="company-row cursor-pointer hover:bg-[#fafbfc] transition-colors"
                            key={contact.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`Edit ${contact.name}`}
                            onClick={() => {
                              setEditingContact(contact)
                              setIsNewContactOpen(true)
                            }}
                            onKeyDown={(e) => {
                              if (e.target !== e.currentTarget) return
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault()
                                setEditingContact(contact)
                                setIsNewContactOpen(true)
                              }
                            }}
                          >
                            <div className="company-name min-w-0">
                              <span className={`company-avatar shrink-0 ${contact.color}`}>
                                {contact.name.charAt(0)}
                              </span>
                              <div className="min-w-0">
                                <strong className="truncate block" title={contact.name}>{contact.name}</strong>
                              </div>
                            </div>
                            <div className="company-contact">
                              {contact.phone ? (
                                <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()} className="text-[12px] text-[#1c1d1f] hover:underline font-mono">
                                  {contact.phone}
                                </a>
                              ) : (
                                <span className="text-[#8f99a8] text-[11px]">—</span>
                              )}
                            </div>
                            <strong>{getContactOpenDealsCount(contact)}</strong>
                            <span className="last-touch">{contact.lastTouch}</span>
                            <div className="truncate">
                              {contact.email ? (
                                <a
                                  href={`mailto:${contact.email}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="text-[#266df0] hover:underline font-mono text-[11px] truncate block"
                                  title={contact.email}
                                >
                                  {contact.email}
                                </a>
                              ) : (
                                <span className="text-[#8f99a8] text-[11px]">—</span>
                              )}
                            </div>
                            <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                              <RowActionMenu
                                triggerLabel={`More options for ${contact.name}`}
                                items={[
                                  {
                                    label: 'Edit client',
                                    icon: Edit3,
                                    onClick: () => {
                                      setEditingContact(contact)
                                      setIsNewContactOpen(true)
                                    },
                                  },
                                  ...(contact.email
                                    ? [
                                        {
                                          label: 'Send email',
                                          icon: Mail,
                                          onClick: () => {
                                            window.location.href = `mailto:${contact.email}`
                                          },
                                        },
                                      ]
                                    : []),
                                  {
                                    label: 'Create deal for client',
                                    icon: CirclePlus,
                                    onClick: () => {
                                      setPrefilledClient(contact.name)
                                      setIsNewDealOpen(true)
                                    },
                                  },
                                  {
                                    label: 'Delete client',
                                    icon: Trash2,
                                    destructive: true,
                                    divider: true,
                                    onClick: () => {
                                      if (window.confirm(`Are you sure you want to delete client "${contact.name}"?`)) {
                                        handleDeleteContact(contact.id, contact.name)
                                      }
                                    },
                                  },
                                ]}
                              />
                            </div>
                          </div>
                        )
                      })
                  )}

                  {contacts.length > 0 &&
                    contacts.filter(
                      (c) =>
                        c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                        (c.phone || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                        c.email.toLowerCase().includes(contactSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                        No clients matching &ldquo;{contactSearch}&rdquo;
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
                  <h1>Settings</h1>
                  <p className="subcopy">
                    Profile, shortcuts, data export and system status.
                  </p>
                </div>
              </section>

              {/* ATTIO TAB BAR */}
              <div className="tabs mb-8">
                <button
                  type="button"
                  className={settingsTab === 'profile' ? 'tab-active' : ''}
                  onClick={() => setSettingsTab('profile')}
                >
                  General & Profile
                </button>
                <button
                  type="button"
                  className={settingsTab === 'shortcuts' ? 'tab-active' : ''}
                  onClick={() => setSettingsTab('shortcuts')}
                >
                  Keyboard Shortcuts
                </button>
                <button
                  type="button"
                  className={settingsTab === 'export' ? 'tab-active' : ''}
                  onClick={() => setSettingsTab('export')}
                >
                  Data & Portability
                </button>
                <button
                  type="button"
                  className={settingsTab === 'system' ? 'tab-active' : ''}
                  onClick={() => setSettingsTab('system')}
                >
                  System & Deployment
                </button>
              </div>

              {/* TAB 1: GENERAL & PROFILE */}
              {settingsTab === 'profile' && (
                <div className="space-y-8 max-w-4xl">
                  {/* SECTION 1: OPERATOR IDENTITY */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-8 border-b border-[#e4e7ec]">
                    <div className="md:col-span-4">
                      <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Operator Identity</h3>
                      <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                        Your personal operator profile, contact email, and active title shown across client communications and exports.
                      </p>
                    </div>
                    <div className="md:col-span-8">
                      <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-center gap-4 min-w-0">
                            <span className="avatar large shrink-0 font-semibold text-[15px]">
                              {getOperatorInitials(currentSettings.operatorName)}
                            </span>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <strong className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight truncate">
                                  {currentSettings.operatorName}
                                </strong>
                                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[#027a48] bg-[#ecfdf3] border border-[#d1fadf] px-2 py-0.5 rounded-[7px]">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#12b76a]" />
                                  Active
                                </span>
                              </div>
                              <span className="text-[13px] text-[#6f7988] truncate block mt-0.5">
                                {currentSettings.operatorEmail}
                              </span>
                              <div className="mt-2">
                                <span className="inline-flex items-center text-[11px] font-medium text-[#2e3238] bg-[#f4f5f6] border border-[#e4e7ec] px-2.5 py-0.5 rounded-[7px]">
                                  {currentSettings.operatorRole}
                                </span>
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsModalInitialTab('profile')
                              setIsEditSettingsOpen(true)
                            }}
                            className="select-button self-start sm:self-center shrink-0"
                          >
                            <Edit3 size={13} className="text-[#6f7988]" />
                            <span>Edit Profile</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 2: REGIONAL & CURRENCY */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-8 border-b border-[#e4e7ec]">
                    <div className="md:col-span-4">
                      <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Regional & Currency</h3>
                      <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                        Default currency standard, regional number formatting, and workflow momentum methodology.
                      </p>
                    </div>
                    <div className="md:col-span-8">
                      <div className="bg-white border border-[#e4e7ec] rounded-xl divide-y divide-[#f0f1f3] shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px] text-[13px]">
                        <div className="flex items-center justify-between p-4">
                          <div>
                            <span className="text-[#1c1d1f] font-medium block">Default Currency</span>
                            <span className="text-[#6f7988] text-[12px]">Applied to deal pipeline values and revenue rollups</span>
                          </div>
                          <strong className="font-mono text-[#1c1d1f]">
                            {currentSettings.currency} <span className="text-[#8f99a8] font-normal">({currentSettings.currencySymbol.trim()})</span>
                          </strong>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <div>
                            <span className="text-[#1c1d1f] font-medium block">Workspace Locale</span>
                            <span className="text-[#6f7988] text-[12px]">Regional date conventions and numeric grouping</span>
                          </div>
                          <span className="font-mono text-[#505967]">{currentSettings.locale}</span>
                        </div>
                        <div className="flex items-center justify-between p-4">
                          <div>
                            <span className="text-[#1c1d1f] font-medium block">Workflow</span>
                            <span className="text-[#6f7988] text-[12px]">Task and follow-up tracking</span>
                          </div>
                          <span className="text-[#266df0] font-medium">Next Action Prompts</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: WORKSPACE SECURITY */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-4">
                      <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Security</h3>
                      <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                        Control workspace access protection, session security, and lock status.
                      </p>
                    </div>
                    <div className="md:col-span-8">
                      <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div>
                            <div className="flex items-center gap-2">
                              <strong className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">
                                {authRequired ? 'Master Passcode Protected' : 'Open Development Mode'}
                              </strong>
                              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-[7px] border ${
                                authRequired
                                  ? 'text-[#027a48] bg-[#ecfdf3] border-[#d1fadf]'
                                  : 'text-[#6f7988] bg-[#f4f5f6] border-[#e4e7ec]'
                              }`}>
                                <span className={`w-1.5 h-1.5 rounded-full ${authRequired ? 'bg-[#12b76a]' : 'bg-[#9fa1a7]'}`} />
                                {authRequired ? 'Protected' : 'Open Access'}
                              </span>
                            </div>
                            <p className="text-[12px] text-[#6f7988] mt-1">
                              {authRequired
                                ? 'Session active (expires in 30 days)'
                                : 'Workspace is accessible locally without a gate. You can configure a master passcode anytime.'}
                            </p>
                          </div>
                          {authRequired ? (
                            <button
                              type="button"
                              onClick={handleLockWorkspace}
                              className="primary-button text-[12px] py-1.5 px-3 min-h-0 self-start sm:self-center shrink-0"
                            >
                              Lock Workspace
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setSettingsModalInitialTab('profile')
                                setIsEditSettingsOpen(true)
                              }}
                              className="select-button text-[12px] self-start sm:self-center shrink-0"
                            >
                              Configure Passcode
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 4: CALENDAR FEED */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-8 border-t border-[#e4e7ec]">
                    <div className="md:col-span-4">
                      <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Calendar</h3>
                      <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                        Subscribe to your deals’ next actions from any calendar app. Nothing to configure.
                      </p>
                    </div>
                    <div className="md:col-span-8">
                      <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3.5 min-w-0">
                            <div className="w-10 h-10 rounded-[10px] bg-[#f0f4fe] border border-[#d6e4fd] flex items-center justify-center text-[#266df0] shrink-0 mt-0.5">
                              <Calendar size={20} />
                            </div>
                            <div className="min-w-0">
                              <strong className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">
                                Calendar feed (.ics)
                              </strong>
                              <p className="text-[12px] text-[#6f7988] mt-1 leading-normal">
                                Works with Google Calendar, Apple Calendar and phone calendars. Deal pages also have an Add to Google Calendar link.
                              </p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setSettingsModalInitialTab('calendar')
                              setIsEditSettingsOpen(true)
                            }}
                            className="select-button text-[12px] py-1.5 px-3 font-semibold text-[#1c1d1f] cursor-pointer self-start sm:self-center shrink-0"
                          >
                            <span>Get feed link</span>
                            <ChevronRight size={13} className="text-[#6f7988]" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: KEYBOARD SHORTCUTS */}
              {settingsTab === 'shortcuts' && (
                <div className="space-y-6 max-w-4xl">
                  {/* SEARCH & VELOCITY BANNER */}
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Workflow Preferences</h3>
                      <p className="text-[13px] text-[#6f7988] mt-0.5">
                        Execute actions with single keystrokes without reaching for your mouse.
                      </p>
                    </div>
                    <div className="relative min-w-[240px]">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9fa1a7]" />
                      <input
                        type="text"
                        value={shortcutFilter}
                        onChange={(e) => setShortcutFilter(e.target.value)}
                        placeholder="Search shortcuts..."
                        className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e4e7ec] rounded-[10px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0] placeholder:text-[#9fa1a7]"
                      />
                    </div>
                  </div>

                  {/* SHORTCUT GROUPS */}
                  {[
                    {
                      category: 'Global & Quick Capture',
                      items: [
                        { label: 'Universal Command Palette', keys: [modKey, 'K'], note: 'Search deals, clients, views' },
                        { label: 'Quick-add new deal drawer', keys: ['N'], note: 'Instant lead capture slide-over' },
                        { label: 'Quick-add new client', keys: ['C'], note: 'Register a new client' },
                        { label: 'Keyboard shortcut cheat-sheet', keys: ['?'], note: 'Open floating shortcut modal' },
                      ],
                    },
                    {
                      category: 'Deals',
                      items: [
                        { label: 'Move between deals', keys: ['Tab'], note: 'Focus the next deal row' },
                        { label: 'Edit deal', keys: ['↵'], note: 'Edit the focused deal' },
                      ],
                    },
                    {
                      category: 'Workspace Navigation (Go-to)',
                      items: [
                        { label: 'Jump to Home', keys: ['G', 'D'], note: 'Daily overview' },
                        { label: 'Jump to Deals', keys: ['G', 'P'], note: 'All deals by stage' },
                        { label: 'Jump to Clients', keys: ['G', 'U'], note: 'The people you work with' },
                        { label: 'Jump to Settings view', keys: ['G', 'S'], note: 'Workspace preferences' },
                      ],
                    },
                  ]
                    .map((group) => ({
                      ...group,
                      items: group.items.filter((item) =>
                        !shortcutFilter.trim() ||
                        item.label.toLowerCase().includes(shortcutFilter.toLowerCase()) ||
                        item.keys.some((k) => k.toLowerCase().includes(shortcutFilter.toLowerCase())) ||
                        item.note.toLowerCase().includes(shortcutFilter.toLowerCase())
                      ),
                    }))
                    .filter((group) => group.items.length > 0)
                    .map((group, gIdx) => (
                      <div key={gIdx} className="bg-white border border-[#e4e7ec] rounded-xl overflow-hidden shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                        <div className="px-4 py-2.5 bg-[#fafbfc] border-b border-[#e4e7ec]">
                          <span className="text-[12px] font-semibold text-[#1c1d1f]">{group.category}</span>
                        </div>
                        <div className="divide-y divide-[#f0f1f3]">
                          {group.items.map((item, idx) => (
                            <div key={idx} className="flex items-center justify-between px-4 py-3 hover:bg-[#fafbfc] transition-colors">
                              <div className="min-w-0 pr-4">
                                <span className="text-[13px] font-medium text-[#1c1d1f] block truncate">{item.label}</span>
                                <span className="text-[11px] text-[#6f7988] block truncate">{item.note}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {item.keys.map((k, kIdx) => (
                                  <kbd
                                    key={kIdx}
                                    className="px-2 py-0.5 min-w-[22px] text-center text-[11px] font-mono font-semibold text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded-[5px] shadow-2xs"
                                  >
                                    {k}
                                  </kbd>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {/* TAB 3: DATA & PORTABILITY */}
              {settingsTab === 'export' && (
                <div className="space-y-6 max-w-4xl">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Data Ownership & Portability</h3>
                      <p className="text-[13px] text-[#6f7988] mt-0.5">
                        Download complete RFC-4180 unencrypted CSV archives with UTF-8 BOM encoding for direct import into Notion, Excel, or Google Sheets.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        exportDealsCSV(deals, currentSettings.currency)
                        exportContactsCSV(contacts)
                        exportFollowUpsCSV(followUps)
                        addToast('All workspace data exported (3 CSV files)', 'Export')
                      }}
                      className="primary-button text-[12px] py-1.5 px-3 min-h-0 shrink-0"
                    >
                      <Download size={13} />
                      <span>Export All (3 CSVs)</span>
                    </button>
                  </div>

                  <div className="bg-white border border-[#e4e7ec] rounded-xl overflow-hidden shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                    <div className="divide-y divide-[#f0f1f3]">
                      {[
                        {
                          title: 'Deals Pipeline',
                          desc: 'Stages, deal values, next actions, contacts, deliverables',
                          count: deals.length,
                          action: () => {
                            exportDealsCSV(deals, currentSettings.currency)
                            addToast(`Exported ${deals.length} deals to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'People Directory',
                          desc: 'Client names, email addresses, phone numbers, notes, touch timestamps',
                          count: contacts.length,
                          action: () => {
                            exportContactsCSV(contacts)
                            addToast(`Exported ${contacts.length} contacts to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'Follow-up Queue',
                          desc: 'Next actions, scheduled times, urgency indicators, completion states',
                          count: followUps.length,
                          action: () => {
                            exportFollowUpsCSV(followUps)
                            addToast(`Exported ${followUps.length} follow-ups to CSV`, 'CSV')
                          },
                        },
                      ].map((item, idx) => (
                        <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[#fafbfc] transition-colors">
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <strong className="text-[14px] font-semibold text-[#1c1d1f]">{item.title}</strong>
                              <span className="text-[11px] font-mono font-medium text-[#266df0] bg-[#e9f0ff] px-2 py-0.5 rounded-[7px]">
                                {item.count} records
                              </span>
                            </div>
                            <p className="text-[12px] text-[#6f7988] mt-0.5">{item.desc}</p>
                          </div>
                          <button
                            type="button"
                            onClick={item.action}
                            className="select-button self-start sm:self-center shrink-0"
                          >
                            <Download size={13} className="text-[#266df0]" />
                            <span>Download .csv</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* SELF-HOSTED COMPLETE DATABASE BACKUP & RESTORE */}
                  <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px] space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <strong className="text-[15px] font-semibold text-[#1c1d1f]">Database Snapshot (JSON)</strong>
                          <span className="text-[10px] font-mono font-medium text-[#027a48] bg-[#ecfdf3] border border-[#d1fadf] px-2 py-0.5 rounded-[6px]">
                            Recommended for Self-Hosters
                          </span>
                        </div>
                        <p className="text-[12px] text-[#6f7988] mt-1 leading-relaxed">
                          Export or restore a complete self-contained snapshot of all deals, clients, deal notes, follow-ups, and workspace configuration. Perfect for Coolify volume backups or migrating servers.
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2 border-t border-[#f0f1f3] flex-wrap">
                      <a
                        href="/api/backup"
                        download
                        onClick={() => addToast('Downloading complete database snapshot...', 'Backup')}
                        className="primary-button text-[12px] py-1.5 px-3 min-h-0"
                      >
                        <Download size={13} />
                        <span>Download Full Database Backup</span>
                      </a>

                      <label className="select-button cursor-pointer text-[12px] py-1.5 px-3 min-h-0">
                        <Upload size={13} className="text-[#266df0]" />
                        <span>Restore from JSON File</span>
                        <input
                          type="file"
                          accept=".json,application/json"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0]
                            if (!file) return
                            if (!window.confirm('⚠️ Caution: Restoring from a backup will replace current workspace records. Continue?')) {
                              e.target.value = ''
                              return
                            }
                            try {
                              const text = await file.text()
                              const json = JSON.parse(text)
                              const res = await fetch('/api/backup', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(json),
                              })
                              const result = await res.json()
                              if (res.ok && result.success) {
                                addToast('Workspace successfully restored! Reloading data...', 'Restore')
                                await loadData()
                              } else {
                                addToast(result.error || 'Failed to restore workspace', undefined, 'warning')
                              }
                            } catch (err: any) {
                              addToast(`Invalid backup file: ${err.message}`, undefined, 'warning')
                            } finally {
                              e.target.value = ''
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 4: SYSTEM & DEPLOYMENT */}
              {settingsTab === 'system' && (
                <div className="space-y-6 max-w-4xl">
                  <div className="flex items-center justify-between pb-4 border-b border-[#e4e7ec]">
                    <div>
                      <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Deployment & Architecture</h3>
                      <p className="text-[13px] text-[#6f7988] mt-0.5">
                        Unified Next.js 16 full-stack architecture running standalone on Coolify. Zero external latency, minimal RAM footprint.
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-mono font-medium rounded-[7px] border ${
                      dbStatus === 'connected'
                        ? 'text-[#027a48] bg-[#ecfdf3] border-[#d1fadf]'
                        : 'text-[#b42318] bg-[#fef3f2] border-[#fee4e2]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${dbStatus === 'connected' ? 'bg-[#12b76a]' : 'bg-[#f04438]'}`} />
                      {dbStatus === 'connected' ? 'Database Online' : 'Checking Connection'}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-white border border-[#e4e7ec] rounded-xl p-4 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                      <span className="text-[11px] font-medium text-[#6f7988] block mb-1">Database Engine</span>
                      <strong className="text-[14px] text-[#1c1d1f] font-semibold block">PostgreSQL / SQLite (LibSQL)</strong>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Persistent local volume with WAL mode and 5000ms busy timeout.</p>
                    </div>

                    <div className="bg-white border border-[#e4e7ec] rounded-xl p-4 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                      <span className="text-[11px] font-medium text-[#6f7988] block mb-1">Healthcheck Endpoint</span>
                      <a
                        href="/api/health"
                        target="_blank"
                        rel="noreferrer"
                        className="text-[14px] font-semibold text-[#266df0] hover:underline inline-flex items-center gap-1 font-mono"
                      >
                        /api/health <ArrowUpRight size={13} />
                      </a>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Rolling zero-downtime container monitoring for Coolify / Docker.</p>
                    </div>

                    <div className="bg-white border border-[#e4e7ec] rounded-xl p-4 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                      <span className="text-[11px] font-medium text-[#6f7988] block mb-1">Cryptographic Security</span>
                      <strong className="text-[14px] text-[#1c1d1f] font-semibold block">Session Token</strong>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Web Crypto API with HttpOnly SameSite=Lax cookie session validation.</p>
                    </div>

                    <div className="bg-white border border-[#e4e7ec] rounded-xl p-4 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                      <span className="text-[11px] font-medium text-[#6f7988] block mb-1">Software License</span>
                      <strong className="text-[14px] text-[#1c1d1f] font-semibold block">AGPL-3.0 Open Source</strong>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Freelancer CRM v1.0.4 • Personal Workspace.</p>
                    </div>
                  </div>
                </div>
              )}
            </>

          ) : (
            /* HOME VIEW: Today */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow" suppressHydrationWarning>{formattedToday || getFormattedToday()}</p>
                  <h1 suppressHydrationWarning>{greeting}</h1>
                  <p className="subcopy">
                    Today: what’s due, who you’re waiting on, and what needs a next step.
                  </p>
                </div>
              </section>

              <TodayList
                groups={todayGroups}
                onOpenDeal={openDeal}
                onToggleFollowUp={toggleFollowUp}
                onEditFollowUp={setEditingFollowUp}
                onDeleteFollowUp={handleDeleteFollowUp}
                onAddDeal={() => setIsNewDealOpen(true)}
              />
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
        onUpdateDeal={handleUpdateDeal}
      />

      <NotesModal
        deal={deals.find((d) => d.id === notesDealId) ?? null}
        onClose={() => setNotesDealId(null)}
        onSave={handleUpdateDeal}
      />

      {/* SHORTCUTS CHEATSHEET MODAL (?) */}
      <ShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* QUICK ADD / EDIT DEAL MODAL (N) */}
      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={() => {
          setIsNewDealOpen(false)
          setEditingDeal(null)
          setPrefilledClient(undefined)
        }}
        onAddDeal={handleAddDeal}
        clients={contacts}
        initialClientName={prefilledClient}
        dealToEdit={editingDeal}
        onUpdateDeal={handleUpdateDeal}
        settings={currentSettings}
      />

      {/* QUICK ADD / EDIT CONTACT MODAL (C) */}
      <NewContactModal
        isOpen={isNewContactOpen}
        onClose={() => {
          setIsNewContactOpen(false)
          setEditingContact(null)
        }}
        onAddContact={handleAddContact}
        contactToEdit={editingContact}
        onUpdateContact={handleUpdateContact}
      />

      {/* EDIT FOLLOW-UP MODAL */}
      <EditFollowUpModal
        isOpen={!!editingFollowUp}
        onClose={() => setEditingFollowUp(null)}
        followUp={editingFollowUp}
        onUpdateFollowUp={handleUpdateFollowUp}
      />

      {/* EDIT SETTINGS & PREFERENCES MODAL */}
      <EditSettingsModal
        isOpen={isEditSettingsOpen}
        onClose={() => {
          setIsEditSettingsOpen(false)
        }}
        currentSettings={currentSettings}
        onSettingsUpdated={(updated) => {
          setCurrentSettings(updated)
          const firstName = updated.operatorName.trim().split(' ')[0]
          setGreeting(getDynamicGreeting(firstName))
          addToast('Preferences saved successfully')
        }}
        initialTab={settingsModalInitialTab}
        onToast={addToast}
      />

      {/* FLOATING TOAST HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
