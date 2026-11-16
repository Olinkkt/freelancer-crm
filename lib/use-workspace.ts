'use client'

import { useCallback, useEffect, useState } from 'react'
import { OPERATOR_CONFIG } from '@/lib/config'
import { Contact, Deal, DealStage, DeliverableItem, FollowUpItem, WorkspaceSettings } from '@/lib/crm-types'
import { INITIAL_CONTACTS, INITIAL_DEALS, INITIAL_FOLLOW_UPS } from '@/lib/crm-data'
import type { ToastHUDItem } from '@/components/ui/toast-hud'
import {
  fetchWorkspaceData,
  createDealAction,
  updateDealAction,
  deleteDealAction,
  moveDealStageAction,
  updateDealChecklistAction,
  createContactAction,
  updateContactAction,
  deleteContactAction,
  deleteFollowUpAction,
  updateFollowUpAction,
  toggleFollowUpAction,
} from '@/app/actions/crm'
import { getAuthStatus, logoutOperator } from '@/app/actions/auth'

type AddToast = (message: string, shortcut?: string, type?: ToastHUDItem['type']) => void

/**
 * The whole workspace on the client: it is loaded once, changed optimistically,
 * then replaced with what the server action returns (or rolled back if it fails).
 */
export function useWorkspace(addToast: AddToast) {
  // CRM Data State
  const [deals, setDeals] = useState<Deal[]>(INITIAL_DEALS)
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS)
  const [followUps, setFollowUps] = useState<FollowUpItem[]>(INITIAL_FOLLOW_UPS)
  const [completedFollowUps, setCompletedFollowUps] = useState<string[]>([])

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

  const loadData = useCallback(async () => {
    try {
      const auth = await getAuthStatus()
      setAuthRequired(auth.required)
      setIsAuthenticated(auth.authenticated)
      setIsSetupComplete(auth.isSetupComplete)

      if (auth.settings) {
        setCurrentSettings(auth.settings)
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
      }
    } catch (err: any) {
      console.error('Failed to load workspace data:', err)
      addToast('Error loading workspace data', undefined, 'warning')
    } finally {
      setIsLoading(false)
    }
  }, [addToast])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Saving a deal under a new client name creates that client on the server;
  // pull the client list again so it shows up without a reload
  const refreshContactsIfNew = async (contactId?: string) => {
    if (!contactId || contacts.some((c) => c.id === contactId)) return
    try {
      const data = await fetchWorkspaceData()
      setContacts(data.contacts)
    } catch {
      // The deal is saved; the client list catches up on the next load
    }
  }

  const handleAddDeal = async (dealData: Omit<Deal, 'id'>) => {
    try {
      const newDeal = await createDealAction(dealData)
      setDeals((prev) => [newDeal, ...prev])
      void refreshContactsIfNew(newDeal.contactId)
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
    const previous = deals.find((d) => d.id === updated.id)
    setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
    try {
      const saved = await updateDealAction(updated)
      setDeals((prev) => prev.map((d) => (d.id === saved.id ? saved : d)))
      void refreshContactsIfNew(saved.contactId)
      if (!opts?.silent) addToast(`Deal "${saved.title}" updated`)
    } catch (err: any) {
      // Nothing was saved: put back what the server still has
      if (previous) setDeals((prev) => prev.map((d) => (d === updated ? previous : d)))
      addToast(err?.message || 'Failed to update deal', undefined, 'warning')
    }
  }

  // Update Contact
  const handleUpdateContact = async (updated: Contact) => {
    const previous = contacts.find((c) => c.id === updated.id)
    setContacts((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
    try {
      const saved = await updateContactAction(updated)
      setContacts((prev) => prev.map((c) => (c.id === saved.id ? saved : c)))
      // The server copies the name and email onto the client's deals; mirror that here
      setDeals((prev) =>
        prev.map((d) =>
          d.contactId === saved.id ? { ...d, contactName: saved.name, contactEmail: saved.email || undefined } : d
        )
      )
      addToast(`Client "${saved.name}" updated`)
    } catch (err: any) {
      if (previous) setContacts((prev) => prev.map((c) => (c === updated ? previous : c)))
      addToast(err?.message || 'Failed to update client', undefined, 'warning')
    }
  }

  // Update Follow-up
  const handleUpdateFollowUp = async (updated: FollowUpItem) => {
    setFollowUps((prev) => prev.map((f) => (f.id === updated.id ? updated : f)))
    try {
      const saved = await updateFollowUpAction(updated)
      setFollowUps((prev) => prev.map((f) => (f.id === saved.id ? saved : f)))
      addToast('Follow-up updated')
    } catch (err: any) {
      addToast(err?.message || 'Failed to update follow-up', undefined, 'warning')
    }
  }

  // Delete Deal
  const handleDeleteDeal = async (id: string) => {
    const index = deals.findIndex((d) => d.id === id)
    const removed = deals[index]
    setDeals((prev) => prev.filter((d) => d.id !== id))
    try {
      await deleteDealAction(id)
      addToast('Deal deleted')
    } catch (err: any) {
      // The delete failed, so the deal still exists: show it again
      if (removed) {
        setDeals((prev) => (prev.some((d) => d.id === id) ? prev : [...prev.slice(0, index), removed, ...prev.slice(index)]))
      }
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
    const previousStage = deals.find((d) => d.id === dealId)?.stage
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, stage: newStage } : d)))
    addToast(newStage === 'Closed' ? 'Deal closed: contract signed, PM starts' : `Moved deal to ${newStage}`)

    try {
      const updated = await moveDealStageAction(dealId, newStage)
      if (updated) {
        setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)))
      }
    } catch (err: any) {
      if (previousStage) {
        setDeals((prev) => prev.map((d) => (d.id === dealId && d.stage === newStage ? { ...d, stage: previousStage } : d)))
      }
      addToast(err?.message || 'Failed to move deal stage', undefined, 'warning')
    }
  }

  const handleChecklistChange = async (dealId: string, items: DeliverableItem[]) => {
    const previousItems = deals.find((d) => d.id === dealId)?.deliverables
    setDeals((prev) => prev.map((d) => (d.id === dealId ? { ...d, deliverables: items } : d)))
    try {
      await updateDealChecklistAction(dealId, items)
    } catch (err: any) {
      // Only undo this edit; a later one may already be on screen
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId && d.deliverables === items ? { ...d, deliverables: previousItems } : d))
      )
      addToast(err?.message || 'Failed to save board', undefined, 'warning')
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

  return {
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
  }
}
