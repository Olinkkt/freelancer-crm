'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CirclePlus,
  LayoutDashboard,
  Search,
  Settings2,
  Users,
  WalletCards,
} from 'lucide-react'
import { getFormattedToday, getDynamicGreeting } from '@/lib/date-utils'
import { parseMoneyInput, formatMoney, getOperatorInitials } from '@/lib/config'
import { Deal, Contact, FollowUpItem, OPEN_DEAL_STAGES, isPmStage } from '@/lib/crm-types'
import { useModKey } from '@/lib/use-mod-key'
import {
  CommandPalette,
  PaletteActionType,
} from '@/components/command-palette/command-palette'
import { NotesModal } from '@/components/modals/notes-modal'
import { ShortcutsModal } from '@/components/modals/shortcuts-modal'
import { NewDealModal } from '@/components/modals/new-deal-modal'
import { NewContactModal } from '@/components/modals/new-contact-modal'
import { ContactPreviewModal } from '@/components/modals/contact-preview-modal'
import { EditFollowUpModal } from '@/components/modals/edit-follow-up-modal'
import { useShortcuts } from '@/lib/use-shortcuts'
import { ShortcutId, bindingLabel, eventToStep, hasModifier } from '@/lib/shortcuts'
import { EditSettingsModal } from '@/components/modals/edit-settings-modal'
import { DealList } from '@/components/deals/deal-list'
import { DealDetail } from '@/components/deals/deal-detail'
import { TodayList, buildToday, buildUpcoming } from '@/components/home/today-list'
import { ProjectsOverview, buildProjects } from '@/components/home/projects-overview'
import { ToastHUD, ToastHUDItem } from '@/components/ui/toast-hud'
import { OperatorGate } from '@/components/auth/operator-gate'
import { SetupWizard } from '@/components/auth/setup-wizard'
import { ClientsView } from '@/components/views/clients-view'
import { SettingsView } from '@/components/views/settings-view'
import { useWorkspace } from '@/lib/use-workspace'


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
  const shortcuts = useShortcuts()
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

  /** Search text of the Clients view (set by the palette when you pick a client) */
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
  const [previewContact, setPreviewContact] = useState<Contact | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpItem | null>(null)
  const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false)
  const [settingsModalInitialTab, setSettingsModalInitialTab] = useState<'profile' | 'calendar'>('profile')

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

  const {
    deals,
    contacts,
    followUps,
    completedFollowUps,
    isLoading,
    authRequired,
    isAuthenticated,
    setIsAuthenticated,
    isSetupComplete,
    setIsSetupComplete,
    currentSettings,
    setCurrentSettings,
    loadData,
    handleAddDeal,
    handleAddContact,
    handleUpdateDeal,
    handleUpdateContact,
    handleUpdateFollowUp,
    handleDeleteDeal,
    handleDeleteContact,
    handleDeleteFollowUp,
    handleMoveDealStage,
    handleChecklistChange,
    toggleFollowUp,
    handleLockWorkspace,
  } = useWorkspace(addToast)

  // Greeting follows the operator's name, including after it is edited in Settings
  useEffect(() => {
    if (!currentSettings.isClaimed) return
    setGreeting(getDynamicGreeting(currentSettings.operatorName.trim().split(' ')[0]))
  }, [currentSettings])

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

      const step = eventToStep(e)
      if (!step) return

      // Palette toggle works anywhere, even inside fields
      if (step === shortcuts.palette) {
        e.preventDefault()
        setIsPaletteOpen((prev) => !prev)
        return
      }

      // Inside a field, only shortcuts with Ctrl/⌘/Alt may fire
      if (isInput && !hasModifier(step)) return

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

      const actions: Partial<Record<ShortcutId, () => void>> = {
        help: () => setIsShortcutsOpen(true),
        newDeal: () => {
          setIsNewDealOpen(true)
          addToast('Quick Capture Deal', bindingLabel(shortcuts.newDeal, modKey))
        },
        newClient: () => {
          setIsNewContactOpen(true)
          addToast('Quick Capture Client', bindingLabel(shortcuts.newClient, modKey))
        },
        goHome: () => goTo('Home', 'goHome'),
        goDeals: () => goTo('Deals', 'goDeals'),
        goClients: () => goTo('Clients', 'goClients'),
        goSettings: () => goTo('Settings', 'goSettings'),
      }
      const goTo = (view: string, id: ShortcutId) => {
        setActiveView(view)
        addToast(`Navigated to ${view}`, bindingLabel(shortcuts[id], modKey))
      }
      const ids = Object.keys(actions) as ShortcutId[]

      // Second key of a chord
      const first = pendingChordRef.current
      if (first) {
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
        pendingChordRef.current = null
        const hit = ids.find((id) => shortcuts[id] === `${first} ${step}`)
        if (hit) {
          e.preventDefault()
          actions[hit]?.()
          return
        }
      }

      // Single-key shortcut
      const single = ids.find((id) => shortcuts[id] === step)
      if (single) {
        e.preventDefault()
        actions[single]?.()
        return
      }

      // First key of a chord
      if (ids.some((id) => shortcuts[id].startsWith(`${step} `))) {
        e.preventDefault()
        pendingChordRef.current = step
        if (chordTimeoutRef.current) clearTimeout(chordTimeoutRef.current)
        chordTimeoutRef.current = setTimeout(() => {
          pendingChordRef.current = null
        }, 1200)
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
    shortcuts,
    modKey,
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
  // Compute metrics
  const openDeals = deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage))
  const totalPipelineAmount = openDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseMoneyInput(d.value)),
    0
  )
  const getContactOpenDealsCount = (contact: Contact) =>
    openDeals.filter((d) => d.contactId === contact.id).length

  const closingDeals = deals.filter((d) => d.stage === 'Proposal')
  const expectedCloseAmount = closingDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseMoneyInput(d.value)),
    0
  )
  // Closed = contract signed, so every PM stage (Closed…Completed) counts as closed
  const wonDealsCount = deals.filter((d) => isPmStage(d.stage)).length
  const winRate = deals.length > 0 ? `${Math.round((wonDealsCount / deals.length) * 100)}%` : '0%'

  const todayGroups = buildToday(deals, followUps, completedFollowUps)
  const projectRows = buildProjects(deals)

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
              title={`Search workspace (${bindingLabel(shortcuts.palette, modKey)})`}
            >
              <Search size={14} />
              <span>Search workspace...</span>
              <span className="search-shortcut">{bindingLabel(shortcuts.palette, modKey)}</span>
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
              onChecklistChange={handleChecklistChange}
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
                {deals.length > 0 && (
                  <button className="primary-button" onClick={() => setIsNewDealOpen(true)}>
                    <CirclePlus size={17} />
                    <span>New deal</span>
                  </button>
                )}
              </section>

              {/* Deal Metrics Summary */}
              <section className="deal-summary">
                <div>
                  <span className="metric-label">Open deals</span>
                  <strong>{openDeals.length}</strong>
                  <small>In {OPEN_DEAL_STAGES.join(', ').replace(/, ([^,]*)$/, ' or $1')}</small>
                </div>
                <div>
                  <span className="metric-label">Pipeline value</span>
                  <strong className="tabular-nums">
                    {formatMoney(totalPipelineAmount, currentSettings)}
                  </strong>
                  <small>
                    {deals.length === 0 ? 'No active pipeline' : `Across ${deals.length} deal${deals.length === 1 ? '' : 's'} in total`}
                  </small>
                </div>
                <div>
                  <span className="metric-label">Expected close</span>
                  <strong className="tabular-nums">
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
            <ClientsView
              contacts={contacts}
              openDeals={openDeals}
              pipelineAmount={totalPipelineAmount}
              settings={currentSettings}
              search={contactSearch}
              onSearchChange={setContactSearch}
              onAddClient={() => setIsNewContactOpen(true)}
              onPreviewClient={setPreviewContact}
              onEditClient={(contact) => {
                setEditingContact(contact)
                setIsNewContactOpen(true)
              }}
              onCreateDeal={(contact) => {
                setPrefilledClient(contact.name)
                setIsNewDealOpen(true)
              }}
              onDeleteClient={handleDeleteContact}
            />
          ) : activeView === 'Settings' ? (
            /* SETTINGS VIEW */
            <SettingsView
              settings={currentSettings}
              authRequired={authRequired}
              deals={deals}
              contacts={contacts}
              followUps={followUps}
              addToast={addToast}
              onLock={handleLockWorkspace}
              onEditSettings={(tab) => {
                setSettingsModalInitialTab(tab)
                setIsEditSettingsOpen(true)
              }}
              onRestored={loadData}
            />

          ) : (
            /* HOME VIEW: Today */
            <>
              <section className="home-heading">
                <h1 suppressHydrationWarning>{greeting}</h1>
                <p className="eyebrow" suppressHydrationWarning>{formattedToday || getFormattedToday()}</p>
              </section>

              <div className="home-grid">
                <TodayList
                  groups={todayGroups}
                  onOpenDeal={openDeal}
                  onToggleFollowUp={toggleFollowUp}
                  onEditFollowUp={setEditingFollowUp}
                  onDeleteFollowUp={handleDeleteFollowUp}
                  onAddDeal={() => setIsNewDealOpen(true)}
                  upcoming={buildUpcoming(deals)}
                />
                <ProjectsOverview rows={projectRows} onOpenDeal={openDeal} onAddDeal={() => setIsNewDealOpen(true)} />
              </div>

              <footer className="home-footer">
                <button type="button" className="home-pipeline" onClick={() => setActiveView('Deals')}>
                  {OPEN_DEAL_STAGES.map((stage) => `${deals.filter((d) => d.stage === stage).length} ${stage.toLowerCase()}`).join(' · ')}
                </button>
                <button type="button" className="text-button" onClick={() => setIsNewDealOpen(true)}>
                  + New deal
                </button>
                <span className="home-hint">⌘K</span>
              </footer>
            </>
          )}
        </div>
      </main>

      {/* COMMAND PALETTE */}
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

      <ContactPreviewModal
        contact={previewContact}
        openDealsCount={previewContact ? getContactOpenDealsCount(previewContact) : 0}
        onClose={() => setPreviewContact(null)}
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
