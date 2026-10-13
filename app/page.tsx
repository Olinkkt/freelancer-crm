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
  Search,
  Settings2,
  Users,
  WalletCards,
  Clock,
  Sparkles,
  PhoneCall,
  UserPlus,
  Keyboard,
  Download,
  Trash2,
  Mail,
  Banknote,
  CheckCircle2,
  Edit3,
} from 'lucide-react'
import {
  exportDealsCSV,
  exportCompaniesCSV,
  exportContactsCSV,
  exportActivitiesCSV,
  exportFollowUpsCSV,
} from '@/lib/csv-export'
import { getFormattedToday, getDynamicGreeting } from '@/lib/date-utils'
import { OPERATOR_CONFIG, formatMoney, getOperatorInitials } from '@/lib/config'
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
import { NewCompanyModal } from '@/components/modals/new-company-modal'
import { LogCallModal } from '@/components/modals/log-call-modal'
import { EditFollowUpModal } from '@/components/modals/edit-follow-up-modal'
import { EditSettingsModal } from '@/components/modals/edit-settings-modal'
import { DealDetailDrawer } from '@/components/drawers/deal-detail-drawer'
import { DealKanban } from '@/components/deals/deal-kanban'
import { ToastHUD, ToastHUDItem } from '@/components/ui/toast-hud'
import { MarkdownFormatter } from '@/components/ui/markdown-formatter'
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
  createCompanyAction,
  updateCompanyAction,
  deleteContactAction,
  setPrimaryContactAction,
  deleteCompanyAction,
  deleteActivityAction,
  updateActivityAction,
  deleteFollowUpAction,
  updateFollowUpAction,
  logActivityAction,
  toggleFollowUpAction,
  syncTodosAction,
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
  // Navigation & View State
  const [activeView, setActiveView] = useState<string>('Dashboard')
  const [activeTab, setActiveTab] = useState<string>('Overview')

  // Dynamic Dashboard Date & Greeting
  const [formattedToday, setFormattedToday] = useState<string>('')
  const [greeting, setGreeting] = useState<string>(`Good morning, ${OPERATOR_CONFIG.firstName}.`)

  useEffect(() => {
    setFormattedToday(getFormattedToday())
    setGreeting(getDynamicGreeting(OPERATOR_CONFIG.firstName))
  }, [])

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
  const [isNewCompanyOpen, setIsNewCompanyOpen] = useState(false)
  const [isLogCallOpen, setIsLogCallOpen] = useState(false)
  const [selectedDeal, setSelectedDeal] = useState<Deal | null>(null)
  const [isDealDrawerOpen, setIsDealDrawerOpen] = useState(false)
  const [prefilledCompany, setPrefilledCompany] = useState<string | undefined>(undefined)

  // Editing state for entities
  const [editingDeal, setEditingDeal] = useState<Deal | null>(null)
  const [editingCompany, setEditingCompany] = useState<Company | null>(null)
  const [editingContact, setEditingContact] = useState<Contact | null>(null)
  const [editingActivity, setEditingActivity] = useState<Activity | null>(null)
  const [editingFollowUp, setEditingFollowUp] = useState<FollowUpItem | null>(null)
  const [isEditSettingsOpen, setIsEditSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<'profile' | 'shortcuts' | 'export' | 'system'>('profile')
  const [shortcutFilter, setShortcutFilter] = useState('')

  // Floating Toasts / HUD
  const [toasts, setToasts] = useState<ToastHUDItem[]>([])
  const toastCounterRef = useRef(0)

  const addToast = useCallback((message: string, shortcut?: string, type: ToastHUDItem['type'] = 'success') => {
    toastCounterRef.current += 1
    const rand = Math.random().toString(36).substring(2, 7)
    const id = `toast-${Date.now()}-${toastCounterRef.current}-${rand}`
    setToasts((prev) => [...prev, { id, message, shortcut, type }])
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id))
    }, 3200)
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
        setCompanies(data.companies)
        setContacts(data.contacts)
        setActivities(data.activities)
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
  const handleAddDeal = async (dealData: Omit<Deal, 'id'>) => {
    try {
      const newDeal = await createDealAction(dealData)
      setDeals((prev) => [newDeal, ...prev])
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
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
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
      addToast(`Added contact "${newContact.name}"`, 'C')
    } catch (err: any) {
      addToast(err?.message || 'Failed to create contact', undefined, 'warning')
    }
  }

  // Create Company Handler
  const handleAddCompany = async (companyData: Omit<Company, 'id'>) => {
    try {
      const newCompany = await createCompanyAction(companyData)
      setCompanies((prev) => [newCompany, ...prev])
      addToast(`Added company "${newCompany.name}"`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to create company', undefined, 'warning')
    }
  }

  // Log Activity Handler with unified Deal and Scratchpad sync
  const handleLogActivity = async (
    activityData: Omit<Activity, 'id'>,
    followUpData?: Omit<FollowUpItem, 'id'>,
    dealId?: string
  ) => {
    const targetDealId = dealId || activityData.dealId
    try {
      const result = await logActivityAction(activityData, followUpData, targetDealId)
      setActivities((prev) => [result.activity, ...prev])

      if (result.followUp) {
        setFollowUps((prev) => [result.followUp!, ...prev])
      }

      if (result.updatedDeal) {
        setDeals((prev) =>
          prev.map((d) => (d.id === result.updatedDeal!.id ? result.updatedDeal! : d))
        )
        if (selectedDeal?.id === result.updatedDeal.id) {
          setSelectedDeal(result.updatedDeal)
        }
      }

      const linkedDeal = deals.find((d) => d.id === targetDealId)
      const toastMsg = linkedDeal
        ? `Logged ${result.activity.type} & synced to ${linkedDeal.title}`
        : `Logged ${result.activity.type} with ${result.activity.person}`
      addToast(toastMsg, 'L')
    } catch (err: any) {
      addToast(err?.message || 'Failed to log activity', undefined, 'warning')
    }
  }

  // Update Deal in list
  const handleUpdateDeal = async (updated: Deal) => {
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    if (selectedDeal?.id === updated.id) {
      setSelectedDeal(updated)
    }
    try {
      const saved = await updateDealAction(updated)
      setDeals((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
      if (selectedDeal?.id === saved.id) {
        setSelectedDeal(saved)
      }
      addToast(`Deal "${saved.title}" updated`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update deal', undefined, 'warning')
    }
  }

  // Update Company
  const handleUpdateCompany = async (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    try {
      const saved = await updateCompanyAction(updated)
      setCompanies((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      addToast(`Company "${saved.name}" updated`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update company', undefined, 'warning')
    }
  }

  // Update Contact
  const handleUpdateContact = async (updated: Contact) => {
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    try {
      const saved = await updateContactAction(updated)
      setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
      addToast(`Contact "${saved.name}" updated`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to update contact', undefined, 'warning')
    }
  }

  // Update Activity
  const handleUpdateActivity = async (updated: Activity) => {
    setActivities((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
    try {
      const saved = await updateActivityAction(updated)
      setActivities((prev) => prev.map((a) => (a.id === saved.id ? saved : a)))
      addToast('Activity updated')
    } catch (err: any) {
      addToast(err?.message || 'Failed to update activity', undefined, 'warning')
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
  const handleSyncTodos = async (todos: string[], companyName: string = 'Workspace') => {
    try {
      const newItems = await syncTodosAction(todos, companyName, selectedDeal?.id)
      setFollowUps((prev) => [...newItems, ...prev])
      addToast(`Synced ${todos.length} action item${todos.length > 1 ? 's' : ''} to Follow-ups`, 'GTD')
    } catch (err: any) {
      addToast(err?.message || 'Failed to sync follow-up items', undefined, 'warning')
    }
  }

  // Delete Deal
  const handleDeleteDeal = async (id: string) => {
    setDeals((prev) => prev.filter((d) => d.id !== id))
    if (selectedDeal?.id === id) {
      setIsDealDrawerOpen(false)
      setSelectedDeal(null)
    }
    try {
      await deleteDealAction(id)
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
      addToast('Deal deleted')
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete deal', undefined, 'warning')
    }
  }

  // Delete Company
  const handleDeleteCompany = async (id: string, name: string) => {
    setCompanies((prev) => prev.filter((c) => c.id !== id))
    addToast(`Company "${name}" deleted`)
    try {
      await deleteCompanyAction(id)
      const workspace = await fetchWorkspaceData()
      setDeals(workspace.deals)
      setContacts(workspace.contacts)
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete company', undefined, 'warning')
    }
  }

  // Delete Contact
  const handleDeleteContact = async (id: string, name: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id))
    addToast(`Contact "${name}" deleted`)
    try {
      await deleteContactAction(id)
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete contact', undefined, 'warning')
    }
  }

  // Set Primary Contact for Company
  const handleSetPrimaryContact = async (contact: Contact) => {
    try {
      await setPrimaryContactAction(contact.company, contact.id)
      const workspace = await fetchWorkspaceData()
      setCompanies(workspace.companies)
      addToast(`Set ${contact.name} as primary contact for ${contact.company}`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to set primary contact', undefined, 'warning')
    }
  }

  // Delete Activity
  const handleDeleteActivity = async (id: string, title: string) => {
    setActivities((prev) => prev.filter((a) => a.id !== id))
    addToast(`Activity "${title}" deleted`)
    try {
      await deleteActivityAction(id)
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete activity', undefined, 'warning')
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
    const isClosed = newStage === 'Won' || newStage === 'Paid'
    const isPaid = newStage === 'Paid'
    const isWon = newStage === 'Won'

    setDeals((prev) =>
      prev.map((d) => {
        if (d.id === dealId) {
          return {
            ...d,
            stage: newStage,
            probability: isClosed ? '100%' : d.probability,
            color: isClosed ? 'green' : 'blue',
            next: isPaid ? 'Request testimonial & case study review' : isWon ? 'Kickoff meeting & design sprint' : d.next,
            nextDueDate: isPaid ? 'In 3 days' : isWon ? 'Tomorrow, 10:00' : d.nextDueDate,
          }
        }
        return d
      })
    )

    if (isPaid) {
      const deal = deals.find((d) => d.id === dealId)
      if (deal) {
        const toComplete = followUps
          .filter((f) => f.company === deal.company && !completedFollowUps.includes(f.id))
          .map((f) => f.id)
        if (toComplete.length > 0) {
          setCompletedFollowUps((prev) => [...new Set([...prev, ...toComplete])])
        }
      }
      addToast('Project completed & 100% paid!')
    } else if (isWon) {
      addToast('Deal Won! Active client project started.')
    } else {
      addToast(`Moved deal to ${newStage}`)
    }

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
  const totalPipelineAmount = deals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  const openDealsCount = deals.filter((d) => d.stage !== 'Won' && d.stage !== 'Paid').length
  const closingDeals = deals.filter((d) => d.stage === 'Proposal')
  const expectedCloseAmount = closingDeals.reduce(
    (sum, d) => sum + (d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0),
    0
  )
  const activeProjectsCount = deals.filter(
    (d) => d.stage === 'Won'
  ).length
  const dueTodayFollowUpsCount = followUps.filter(
    (f) => f.day.toLowerCase() === 'today' && !completedFollowUps.includes(f.id)
  ).length
  const winRate =
    deals.length > 0
      ? `${Math.round((deals.filter((d) => d.stage === 'Won' || d.stage === 'Paid').length / deals.length) * 100)}%`
      : '0%'

  const pipelineStagesSummary: { label: DealStage; count: number; amount: string }[] = [
    'Lead',
    'Qualified',
    'Proposal',
    'Won',
    'Paid',
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
        onSetupComplete={(newSettings) => {
          setCurrentSettings(newSettings)
          setIsSetupComplete(true)
          setIsAuthenticated(true)
          loadData()
          addToast(`Welcome to your cockpit, ${newSettings.operatorName}!`)
        }}
      />
    )
  }

  // 2. OPERATOR LOCK GATE
  if (authRequired && !isAuthenticated) {
    return (
      <OperatorGate
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

            <button className="avatar" title={currentSettings.operatorName}>
              {getOperatorInitials(currentSettings.operatorName)}
            </button>
          </div>
        </header>

        {/* VIEW CONTAINER */}
        <div className="content-wrap">
          {activeView === 'Deals' ? (
            /* DEALS & PIPELINE VIEW (Kanban Board) */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow">Sales workspace</p>
                  <h1>Deals & Pipeline</h1>
                  <p className="subcopy">
                    Visual stage progression and keyboard navigation across your active opportunities.
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
                onEditDeal={(deal) => {
                  setEditingDeal(deal)
                  setIsNewDealOpen(true)
                }}
                onAddDealClick={() => setIsNewDealOpen(true)}
                onMoveDealStage={handleMoveDealStage}
                onDeleteDeal={handleDeleteDeal}
                onLogInteraction={(deal) => {
                  setSelectedDeal(deal)
                  setIsLogCallOpen(true)
                }}
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
                            <div className="flex items-center justify-end gap-1">
                              {activity.summary && (
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
                              )}
                              <RowActionMenu
                                triggerLabel={`More options for ${activity.title}`}
                                items={[
                                  {
                                    label: 'Edit activity',
                                    icon: Edit3,
                                    onClick: () => {
                                      setEditingActivity(activity)
                                      setIsLogCallOpen(true)
                                    },
                                  },
                                  ...(associatedDeal
                                    ? [
                                        {
                                          label: `Open deal (${associatedDeal.title})`,
                                          icon: FileText,
                                          onClick: () => {
                                            setSelectedDeal(associatedDeal)
                                            setIsDealDrawerOpen(true)
                                          },
                                        },
                                      ]
                                    : []),
                                  {
                                    label: 'Log interaction',
                                    icon: PhoneCall,
                                    onClick: () => {
                                      setIsLogCallOpen(true)
                                    },
                                  },
                                  {
                                    label: 'Delete activity',
                                    icon: Trash2,
                                    destructive: true,
                                    divider: true,
                                    onClick: () => handleDeleteActivity(activity.id, activity.title),
                                  },
                                ]}
                              />
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
                      .map((contact) => {
                        const comp = companies.find(
                          (c) => c.name.trim().toLowerCase() === contact.company.trim().toLowerCase()
                        )
                        const isPrimary = comp ? comp.contact === contact.name : false

                        return (
                          <div className="company-row" key={contact.id}>
                            <div className="company-name">
                              <span className={`company-avatar ${contact.color}`}>
                                {contact.name.charAt(0)}
                              </span>
                              <div>
                                <strong>{contact.name}</strong>
                                {contact.role && <span>{contact.role}</span>}
                              </div>
                            </div>
                            <div className="company-contact">
                              <strong className="text-[13px] font-semibold text-[#1c1d1f]">{contact.company}</strong>
                            </div>
                            <strong>{contact.deals}</strong>
                            <span className="last-touch">{contact.lastTouch}</span>
                            <div className="truncate">
                              {contact.email ? (
                                <a
                                  href={`mailto:${contact.email}`}
                                  className="text-[#266df0] hover:underline font-mono text-[11px] truncate block"
                                  title={contact.email}
                                >
                                  {contact.email}
                                </a>
                              ) : (
                                <span className="text-[#8f99a8] text-[11px]">—</span>
                              )}
                            </div>
                            <div className="flex justify-end">
                              <RowActionMenu
                                triggerLabel={`More options for ${contact.name}`}
                                items={[
                                  {
                                    label: 'Edit contact',
                                    icon: Edit3,
                                    onClick: () => {
                                      setEditingContact(contact)
                                      setIsNewContactOpen(true)
                                    },
                                  },
                                  ...(!isPrimary && contact.company
                                    ? [
                                        {
                                          label: 'Make primary contact',
                                          icon: CheckCircle2,
                                          onClick: () => handleSetPrimaryContact(contact),
                                        },
                                      ]
                                    : []),
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
                                    label: 'Create deal for contact',
                                    icon: CirclePlus,
                                    onClick: () => {
                                      setPrefilledCompany(contact.company)
                                      setIsNewDealOpen(true)
                                    },
                                  },
                                  {
                                    label: 'Log interaction',
                                    icon: PhoneCall,
                                    onClick: () => {
                                      setPrefilledCompany(contact.company)
                                      setIsLogCallOpen(true)
                                    },
                                  },
                                  {
                                    label: 'Delete contact',
                                    icon: Trash2,
                                    destructive: true,
                                    divider: true,
                                    onClick: () => handleDeleteContact(contact.id, contact.name),
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
                  onClick={() => setIsNewCompanyOpen(true)}
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
                        Companies are registered automatically as you log deals and contacts, or you can add one directly.
                      </p>
                      <div className="flex items-center justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsNewCompanyOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                        >
                          <Building2 size={13} />
                          <span>Add company</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsNewDealOpen(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#dce0e5] hover:bg-[#f5f7fa] text-[#1c1d1f] text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
                        >
                          <CirclePlus size={13} />
                          <span>Add opportunity (N)</span>
                        </button>
                      </div>
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
                            {comp.contact ? (
                              <div className="min-w-0">
                                <strong className="truncate block">{comp.contact}</strong>
                                {comp.email && (
                                  <span className="truncate block font-mono text-[11px] text-[#8f99a8] mt-0.5" title={comp.email}>
                                    {comp.email}
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-[#8f99a8] text-[11px]">—</span>
                            )}
                          </div>
                          <strong>{comp.deals}</strong>
                          <strong className="font-mono tabular-nums">{comp.value}</strong>
                          <span className={`status-pill ${comp.status.toLowerCase()}`}>
                            {comp.status}
                          </span>
                          <RowActionMenu
                            triggerLabel={`More options for ${comp.name}`}
                            items={[
                              {
                                label: 'Edit company',
                                icon: Edit3,
                                onClick: () => {
                                  setEditingCompany(comp)
                                  setIsNewCompanyOpen(true)
                                },
                              },
                              {
                                label: 'Add deal for company',
                                icon: CirclePlus,
                                onClick: () => {
                                  setPrefilledCompany(comp.name)
                                  setIsNewDealOpen(true)
                                },
                              },
                              {
                                label: 'Add contact for company',
                                icon: UserPlus,
                                onClick: () => {
                                  setPrefilledCompany(comp.name)
                                  setIsNewContactOpen(true)
                                },
                              },
                              {
                                label: 'Log interaction',
                                icon: PhoneCall,
                                onClick: () => {
                                  setPrefilledCompany(comp.name)
                                  setIsLogCallOpen(true)
                                },
                              },
                              ...(comp.email
                                ? [
                                    {
                                      label: 'Send email',
                                      icon: Mail,
                                      onClick: () => {
                                        window.location.href = `mailto:${comp.email}`
                                      },
                                    },
                                  ]
                                : []),
                              {
                                label: 'Delete company',
                                icon: Trash2,
                                destructive: true,
                                divider: true,
                                onClick: () => handleDeleteCompany(comp.id, comp.name),
                              },
                            ]}
                          />
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
                    Operator cockpit preferences, velocity controls, data portability, and deployment architecture.
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
                            onClick={() => setIsEditSettingsOpen(true)}
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
                            <span className="text-[#1c1d1f] font-medium block">Workflow Engine</span>
                            <span className="text-[#6f7988] text-[12px]">David Allen Getting Things Done paradigm</span>
                          </div>
                          <span className="text-[#266df0] font-medium">GTD Mandatory Next Action</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* SECTION 3: WORKSPACE SECURITY */}
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
                    <div className="md:col-span-4">
                      <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Security & Gatekeeper</h3>
                      <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                        Control workspace access protection, cryptographic session tokens, and lock status.
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
                                ? 'Cryptographic HMAC-SHA256 session token active with 30-day rolling expiration.'
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
                              onClick={() => setIsEditSettingsOpen(true)}
                              className="select-button text-[12px] self-start sm:self-center shrink-0"
                            >
                              Configure Passcode
                            </button>
                          )}
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
                      <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Linear Velocity Controls</h3>
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
                        { label: 'Universal Command Palette', keys: ['Ctrl+K'], note: 'Search deals, contacts, views' },
                        { label: 'Quick-add new deal drawer', keys: ['N'], note: 'Instant lead capture slide-over' },
                        { label: 'Quick-add new contact drawer', keys: ['C'], note: 'Register new client contact' },
                        { label: 'Quick-log call / meeting note', keys: ['L'], note: 'Log notes and next actions' },
                        { label: 'Keyboard shortcut cheat-sheet', keys: ['?'], note: 'Open floating shortcut modal' },
                      ],
                    },
                    {
                      category: 'Kanban Pipeline Velocity',
                      items: [
                        { label: 'Navigate Kanban stage columns', keys: ['←', '→'], note: 'Shift active column focus' },
                        { label: 'Select deal card in column', keys: ['↑', '↓'], note: 'Navigate deal cards' },
                        { label: 'Cycle forward through deals', keys: ['Tab'], note: 'Fast linear card cycling' },
                        { label: 'Inspect deal (slide-over drawer)', keys: ['↵'], note: 'Open full deal inspector' },
                        { label: 'Shift deal stage left / right', keys: ['[', ']'], note: 'Advance or revert stage' },
                      ],
                    },
                    {
                      category: 'Workspace Navigation (Go-to)',
                      items: [
                        { label: 'Jump to Dashboard overview', keys: ['G', 'D'], note: 'Daily executive brief' },
                        { label: 'Jump to Deals pipeline', keys: ['G', 'P'], note: 'Kanban stages and values' },
                        { label: 'Jump to Companies directory', keys: ['G', 'C'], note: 'Client account rollups' },
                        { label: 'Jump to Contacts directory', keys: ['G', 'T'], note: 'People touch history' },
                        { label: 'Jump to Activities log', keys: ['G', 'A'], note: 'Audited interactions' },
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
                        exportDealsCSV(deals)
                        exportCompaniesCSV(companies)
                        exportContactsCSV(contacts)
                        exportActivitiesCSV(activities)
                        exportFollowUpsCSV(followUps)
                        addToast('All workspace data exported (5 CSV files)', 'Export')
                      }}
                      className="primary-button text-[12px] py-1.5 px-3 min-h-0 shrink-0"
                    >
                      <Download size={13} />
                      <span>Export All (5 CSVs)</span>
                    </button>
                  </div>

                  <div className="bg-white border border-[#e4e7ec] rounded-xl overflow-hidden shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                    <div className="divide-y divide-[#f0f1f3]">
                      {[
                        {
                          title: 'Deals Pipeline',
                          desc: 'Stages, deal values, probability, next actions, contacts, deliverables',
                          count: deals.length,
                          action: () => {
                            exportDealsCSV(deals)
                            addToast(`Exported ${deals.length} deals to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'Accounts & Companies',
                          desc: 'Company directory, client types, primary contacts, deal counts, pipeline values',
                          count: companies.length,
                          action: () => {
                            exportCompaniesCSV(companies)
                            addToast(`Exported ${companies.length} companies to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'People Directory',
                          desc: 'Contact names, email addresses, phone numbers, roles, touch timestamps',
                          count: contacts.length,
                          action: () => {
                            exportContactsCSV(contacts)
                            addToast(`Exported ${contacts.length} contacts to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'Activity History',
                          desc: 'Meeting notes, call summaries, status audits, linked deal references',
                          count: activities.length,
                          action: () => {
                            exportActivitiesCSV(activities)
                            addToast(`Exported ${activities.length} activities to CSV`, 'CSV')
                          },
                        },
                        {
                          title: 'GTD Follow-up Queue',
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
                      <strong className="text-[14px] text-[#1c1d1f] font-semibold block">HMAC-SHA256 Token</strong>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Web Crypto API with HttpOnly SameSite=Lax cookie session validation.</p>
                    </div>

                    <div className="bg-white border border-[#e4e7ec] rounded-xl p-4 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                      <span className="text-[11px] font-medium text-[#6f7988] block mb-1">Software License</span>
                      <strong className="text-[14px] text-[#1c1d1f] font-semibold block">AGPL-3.0 Open Source</strong>
                      <p className="text-[12px] text-[#8f99a8] mt-1">Freelancer CRM v1.0.4 • Solo Operator Personal Cockpit.</p>
                    </div>
                  </div>
                </div>
              )}
            </>

          ) : (
            /* DASHBOARD / OVERVIEW VIEW */
            <>
              <section className="page-heading">
                <div>
                  <p className="eyebrow" suppressHydrationWarning>{formattedToday || getFormattedToday()}</p>
                  <h1 suppressHydrationWarning>{greeting}</h1>
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
                            <RowActionMenu
                              triggerLabel={`Options for ${item.action}`}
                              items={[
                                {
                                  label: 'Edit follow-up',
                                  icon: Edit3,
                                  onClick: () => setEditingFollowUp(item),
                                },
                                {
                                  label: done ? 'Mark incomplete' : 'Mark complete',
                                  icon: Check,
                                  onClick: () => toggleFollowUp(item.id),
                                },
                                {
                                  label: `Log interaction (${item.company})`,
                                  icon: PhoneCall,
                                  onClick: () => {
                                    setPrefilledCompany(item.company)
                                    setIsLogCallOpen(true)
                                  },
                                },
                                {
                                  label: 'Delete follow-up',
                                  icon: Trash2,
                                  destructive: true,
                                  divider: true,
                                  onClick: () => handleDeleteFollowUp(item.id),
                                },
                              ]}
                            />
                          </div>
                        )
                      })
                    )}
                  </div>
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
                            deal.stage === 'Proposal' ||
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
                            {deal.stage === 'Paid' || !deal.next ? (
                              <span className="text-[#8f99a8]">—</span>
                            ) : (
                              <>
                                <Clock size={12} className="text-[#266df0]" />
                                <span>{deal.next}</span>
                              </>
                            )}
                          </span>
                          <RowActionMenu
                            triggerLabel={`More options for ${deal.title}`}
                            items={[
                              {
                                label: 'Edit deal',
                                icon: Edit3,
                                onClick: () => {
                                  setEditingDeal(deal)
                                  setIsNewDealOpen(true)
                                },
                              },
                              {
                                label: 'Open deal drawer',
                                icon: FileText,
                                onClick: () => {
                                  setSelectedDeal(deal)
                                  setIsDealDrawerOpen(true)
                                },
                              },
                              {
                                label: 'Log interaction',
                                icon: PhoneCall,
                                onClick: () => {
                                  setSelectedDeal(deal)
                                  setIsLogCallOpen(true)
                                },
                              },
                              ...(deal.stage !== 'Won' && deal.stage !== 'Paid'
                                ? [
                                    {
                                      label: 'Mark as Won',
                                      icon: Check,
                                      onClick: () => handleMoveDealStage(deal.id, 'Won'),
                                    },
                                  ]
                                : []),
                              ...(deal.stage !== 'Paid'
                                ? [
                                    {
                                      label: 'Mark as Paid',
                                      icon: Banknote,
                                      onClick: () => handleMoveDealStage(deal.id, 'Paid'),
                                    },
                                  ]
                                : []),
                              {
                                label: 'Delete deal',
                                icon: Trash2,
                                destructive: true,
                                divider: true,
                                onClick: () => handleDeleteDeal(deal.id),
                              },
                            ]}
                          />
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

      {/* QUICK ADD / EDIT DEAL MODAL (N) */}
      <NewDealModal
        isOpen={isNewDealOpen}
        onClose={() => {
          setIsNewDealOpen(false)
          setEditingDeal(null)
          setPrefilledCompany(undefined)
        }}
        onAddDeal={handleAddDeal}
        companies={companies}
        initialCompany={prefilledCompany}
        dealToEdit={editingDeal}
        onUpdateDeal={handleUpdateDeal}
      />

      {/* QUICK ADD / EDIT CONTACT MODAL (C) */}
      <NewContactModal
        isOpen={isNewContactOpen}
        onClose={() => {
          setIsNewContactOpen(false)
          setEditingContact(null)
          setPrefilledCompany(undefined)
        }}
        onAddContact={handleAddContact}
        companies={companies}
        initialCompany={prefilledCompany}
        contactToEdit={editingContact}
        onUpdateContact={handleUpdateContact}
      />

      {/* QUICK ADD / EDIT COMPANY MODAL */}
      <NewCompanyModal
        isOpen={isNewCompanyOpen}
        onClose={() => {
          setIsNewCompanyOpen(false)
          setEditingCompany(null)
        }}
        onAddCompany={handleAddCompany}
        companyToEdit={editingCompany}
        onUpdateCompany={handleUpdateCompany}
      />

      {/* QUICK LOG CALL / EDIT INTERACTION MODAL (L) */}
      <LogCallModal
        isOpen={isLogCallOpen}
        onClose={() => {
          setIsLogCallOpen(false)
          setEditingActivity(null)
        }}
        onLogActivity={handleLogActivity}
        companies={companies}
        contacts={contacts}
        deals={deals}
        initialDealId={selectedDeal?.id}
        activityToEdit={editingActivity}
        onUpdateActivity={handleUpdateActivity}
      />

      {/* EDIT FOLLOW-UP MODAL */}
      <EditFollowUpModal
        isOpen={!!editingFollowUp}
        onClose={() => setEditingFollowUp(null)}
        followUp={editingFollowUp}
        onUpdateFollowUp={handleUpdateFollowUp}
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
        onToast={(msg) => addToast(msg)}
      />

      {/* EDIT SETTINGS & PREFERENCES MODAL */}
      <EditSettingsModal
        isOpen={isEditSettingsOpen}
        onClose={() => setIsEditSettingsOpen(false)}
        currentSettings={currentSettings}
        onSettingsUpdated={(updated) => {
          setCurrentSettings(updated)
          const firstName = updated.operatorName.trim().split(' ')[0]
          setGreeting(getDynamicGreeting(firstName))
          addToast('Preferences saved successfully')
        }}
      />

      {/* FLOATING TOAST HUD */}
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />
    </div>
  )
}
