'use client'

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Building2,
  Calendar,
  AlertCircle,
  Check,
  Banknote,
  Clock,
  Mail,
  Phone,
  Trash2,
  ExternalLink,
  Edit3,
  ListTodo,
  FileText,
  Plus,
  PhoneCall,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Sparkles,
} from 'lucide-react'
import {
  Deal,
  DealStage,
  Activity,
  FollowUpItem,
  Contact,
} from '@/lib/crm-types'
import {
  fetchDealByIdAction,
  updateDealAction,
  deleteDealAction,
  moveDealStageAction,
  fetchDealActivitiesAction,
  logActivityAction,
  deleteActivityAction,
  updateActivityAction,
  syncTodosAction,
} from '@/app/actions/crm'
import { getAuthStatus } from '@/app/actions/auth'
import { formatDealValue } from '@/lib/config'
import { DeliverablesTracker } from '@/components/drawers/deliverables-tracker'
import { ScratchpadEditor } from '@/components/drawers/scratchpad-editor'
import { MarkdownFormatter } from '@/components/ui/markdown-formatter'
import { ToastHUD, ToastHUDItem } from '@/components/ui/toast-hud'
import { LogCallModal } from '@/components/modals/log-call-modal'
import { EditFollowUpModal } from '@/components/modals/edit-follow-up-modal'

const STAGES: DealStage[] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Paid',
]

export default function DealProjectPage() {
  const params = useParams()
  const router = useRouter()
  const dealIdOrSlug = Array.isArray(params?.id) ? params.id[0] : (params?.id as string)

  const [deal, setDeal] = useState<Deal | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  // Sub-tabs in main view
  const [activeTab, setActiveTab] = useState<'deliverables' | 'scratchpad' | 'timeline'>('deliverables')

  // Modals & Drafting state
  const [isLogCallOpen, setIsLogCallOpen] = useState(false)
  const [isDraftingNote, setIsDraftingNote] = useState(false)
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingType, setNewMeetingType] = useState<Activity['type']>('Meeting')
  const [draftNotes, setDraftNotes] = useState('')
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({})

  // Quick edit for next action
  const [isEditingNextAction, setIsEditingNextAction] = useState(false)
  const [nextActionText, setNextActionText] = useState('')
  const [nextActionDate, setNextActionDate] = useState('')

  // Toast HUD state
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

  // Load deal and its timeline
  const loadDeal = useCallback(async () => {
    if (!dealIdOrSlug) return
    try {
      setIsLoading(true)
      const data = await fetchDealByIdAction(dealIdOrSlug)
      if (!data) {
        setNotFound(true)
        return
      }
      setDeal(data)
      setNextActionText(data.next || '')
      setNextActionDate(data.nextDueDate || 'Tomorrow, 10:00')

      const acts = await fetchDealActivitiesAction(data.id)
      setActivities(acts)
    } catch (err: any) {
      console.error('Failed to load deal project:', err)
      addToast(err?.message || 'Error loading project', undefined, 'warning')
    } finally {
      setIsLoading(false)
    }
  }, [dealIdOrSlug, addToast])

  useEffect(() => {
    loadDeal()
  }, [loadDeal])

  // Update Deal helper
  const handleUpdateDeal = async (updated: Deal) => {
    setDeal(updated)
    try {
      await updateDealAction(updated)
      addToast('Project updated')
    } catch (err: any) {
      addToast(err?.message || 'Failed to save changes', undefined, 'warning')
    }
  }

  // Stage Change helper
  const handleStageChange = async (newStage: DealStage) => {
    if (!deal) return
    const isWon = newStage === 'Won'
    const isPaid = newStage === 'Paid'
    const updated: Deal = {
      ...deal,
      stage: newStage,
      probability: isWon || isPaid ? '100%' : newStage === 'Proposal' ? '70%' : newStage === 'Qualified' ? '40%' : '20%',
      next: isPaid ? 'Request testimonial & case study review' : deal.next,
      nextDueDate: isPaid ? 'In 3 days' : deal.nextDueDate,
    }
    setDeal(updated)
    addToast(`Shifted stage to ${newStage}`)
    try {
      await moveDealStageAction(deal.id, newStage)
    } catch (err: any) {
      addToast(err?.message || 'Failed to move stage', undefined, 'warning')
    }
  }

  // Save Next Action
  const handleSaveNextAction = async () => {
    if (!deal) return
    const updated: Deal = {
      ...deal,
      next: nextActionText.trim() || 'Follow up on progress',
      nextDueDate: nextActionDate.trim() || 'Tomorrow, 10:00',
    }
    setDeal(updated)
    setIsEditingNextAction(false)
    try {
      await updateDealAction(updated)
      addToast('Next action updated', 'GTD')
    } catch (err: any) {
      addToast(err?.message || 'Failed to save next action', undefined, 'warning')
    }
  }

  // Save meeting note from drafting scratchpad
  const handleSaveDraftNote = async () => {
    if (!deal || !newMeetingTitle.trim() || !draftNotes.trim()) return

    const newActivity: Omit<Activity, 'id'> = {
      dealId: deal.id,
      title: newMeetingTitle.trim(),
      type: newMeetingType,
      person: deal.contactName || deal.company,
      company: deal.company,
      date: 'Today, Just now',
      status: 'Completed',
      summary: draftNotes.trim(),
      notes: draftNotes.trim(),
      color: 'blue',
    }

    try {
      const res = await logActivityAction(newActivity, undefined, deal.id)
      setActivities((prev) => [res.activity, ...prev])
      setIsDraftingNote(false)
      setDraftNotes('')
      setNewMeetingTitle('')
      addToast(`Logged ${newMeetingType.toLowerCase()}: "${newActivity.title}"`)
    } catch (err: any) {
      addToast(err?.message || 'Failed to save note', undefined, 'warning')
    }
  }

  // Toggle checklist item inside markdown note
  const handleToggleMarkdownCheck = async (activityId: string, itemText: string, currentChecked: boolean) => {
    const act = activities.find((a) => a.id === activityId)
    if (!act || !act.notes) return

    const lines = act.notes.split('\n')
    const updatedLines = lines.map((line: string) => {
      if (line.includes(itemText)) {
        if (currentChecked) {
          return line.replace(/-\s*\[x\]/i, '- [ ]')
        } else {
          return line.replace(/-\s*\[\s*\]/, '- [x]')
        }
      }
      return line
    })

    const updatedNotes = updatedLines.join('\n')
    const updatedAct: Activity = { ...act, notes: updatedNotes, summary: updatedNotes }
    setActivities((prev) => prev.map((a) => (a.id === activityId ? updatedAct : a)))

    try {
      await updateActivityAction(updatedAct)
      addToast(currentChecked ? 'Task marked incomplete' : 'Task marked done!')
    } catch (err: any) {
      addToast('Failed to save task update', undefined, 'warning')
    }
  }

  // Sync action items from Scratchpad to GTD follow-ups
  const handleSyncTodos = async (todos: string[]) => {
    if (!deal) return
    try {
      await syncTodosAction(todos, deal.company, deal.id)
      addToast(`Synced ${todos.length} action item${todos.length > 1 ? 's' : ''} to Follow-ups`, 'GTD')
    } catch (err: any) {
      addToast(err?.message || 'Failed to sync follow-ups', undefined, 'warning')
    }
  }

  // Delete Deal
  const handleDeleteDeal = async () => {
    if (!deal) return
    if (!window.confirm(`Are you sure you want to delete "${deal.title}"? This cannot be undone.`)) return
    try {
      await deleteDealAction(deal.id)
      addToast('Deal deleted')
      router.push('/')
    } catch (err: any) {
      addToast(err?.message || 'Failed to delete deal', undefined, 'warning')
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 rounded-full border-2 border-[#2563eb] border-t-transparent animate-spin" />
        <p className="text-xs text-[#8f99a8] font-mono">Loading project workspace...</p>
      </div>
    )
  }

  if (notFound || !deal) {
    return (
      <div className="min-h-screen bg-[#f7f8fa] flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f0f2f5] text-[#8f99a8] flex items-center justify-center mx-auto mb-3">
          <AlertCircle size={22} />
        </div>
        <h2 className="text-[16px] font-bold text-[#1c1d1f] mb-1">Project Not Found</h2>
        <p className="text-[12px] text-[#6f7988] max-w-sm mx-auto mb-4">
          This deal or project workspace may have been removed or moved to another account.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-medium rounded-[8px] transition-colors"
        >
          <ArrowLeft size={13} />
          <span>Return to Dashboard</span>
        </Link>
      </div>
    )
  }

  const contactEmail = deal.contactEmail || `contact@${deal.company.toLowerCase().replace(/[^a-z0-9]/g, '')}.cz`
  const totalDeliverables = deal.deliverables?.length || 0
  const doneDeliverables = deal.deliverables?.filter((d) => d.status === 'Done').length || 0
  const progressPercent = totalDeliverables > 0 ? Math.round((doneDeliverables / totalDeliverables) * 100) : 0

  const modalDeals = useMemo(() => [deal], [deal])
  const modalContacts = useMemo<Contact[]>(() => [
    {
      id: 'primary-contact',
      name: deal.contactName || deal.company,
      email: deal.contactEmail || contactEmail || '',
      company: deal.company,
      role: '',
      deals: 1,
      lastTouch: 'Today',
      color: deal.color || 'blue',
    },
  ], [deal, contactEmail])

  return (
    <div className="min-h-screen bg-[#f7f8fa] text-[#1c1d1f] flex flex-col">
      <ToastHUD toasts={toasts} onDismiss={dismissToast} />

      {/* TOP HEADER & BREADCRUMBS */}
      <header className="sticky top-0 z-30 bg-white border-b border-[#e4e7ec] px-4 sm:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Breadcrumb path */}
          <div className="flex items-center gap-2 text-[12px]">
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-[#6f7988] hover:text-[#1c1d1f] font-medium transition-colors"
            >
              <ArrowLeft size={13} />
              <span>Workspace</span>
            </Link>
            <span className="text-[#a4acb9]">/</span>
            <Link
              href="/?view=Deals"
              className="text-[#6f7988] hover:text-[#1c1d1f] font-medium transition-colors"
            >
              Deals
            </Link>
            <span className="text-[#a4acb9]">/</span>
            <strong className="text-[#1c1d1f] font-semibold truncate max-w-xs sm:max-w-md">
              {deal.title}
            </strong>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsLogCallOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-[#e4e7ec] hover:bg-[#f7f8fa] text-[#232529] text-[12px] font-medium rounded-[8px] transition-colors cursor-pointer"
            >
              <PhoneCall size={13} />
              <span>Log interaction</span>
            </button>
            <button
              type="button"
              onClick={handleDeleteDeal}
              className="p-1.5 text-[#8f99a8] hover:text-[#ef4444] rounded-[8px] transition-colors cursor-pointer"
              title="Delete deal"
            >
              <Trash2 size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* HERO / PROJECT STATUS BAR */}
      <div className="bg-white border-b border-[#e4e7ec] px-4 sm:px-8 py-6">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 rounded-[6px] bg-[#f0f2f5] text-[#232529] text-[11px] font-semibold uppercase tracking-wider">
                  {deal.company}
                </span>
                <span className="text-[#6f7988] text-[12px]">•</span>
                <span className="text-[12px] text-[#6f7988]">
                  Created {new Date(deal.createdAt || Date.now()).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <h1 className="text-[24px] sm:text-[28px] font-bold text-[#1c1d1f] tracking-tight">
                {deal.title}
              </h1>
            </div>

            {/* Financial Value & Win Probability */}
            <div className="flex items-baseline md:items-end flex-col gap-1">
              <div className="flex items-baseline gap-3">
                <span className="text-[28px] sm:text-[32px] font-bold font-mono tabular-nums text-[#1c1d1f] tracking-tight">
                  {formatDealValue(deal.value)}
                </span>
                <span className="px-2.5 py-0.5 text-[12px] font-mono font-medium rounded-[7px] bg-[#e9f0ff] text-[#266df0]">
                  {deal.probability} win prob.
                </span>
              </div>
              <div className="text-[11px] text-[#6f7988]">
                Pipeline Stage: <strong className="text-[#1c1d1f]">{deal.stage}</strong>
              </div>
            </div>
          </div>

          {/* Pipeline Stage Buttons */}
          <div className="pt-2 border-t border-[#f0f2f5] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] font-semibold text-[#8f99a8] uppercase tracking-wider mr-1">
                Stage:
              </span>
              {STAGES.map((s) => (
                <button
                  key={s}
                  onClick={() => handleStageChange(s)}
                  className={`px-3 py-1.5 rounded-[8px] text-[12px] font-medium transition-all border cursor-pointer ${
                    deal.stage === s
                      ? 'bg-[#232529] text-white border-[#232529] shadow-xs'
                      : 'bg-white text-[#505967] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>

            {/* Deliverables progress summary */}
            {totalDeliverables > 0 && (
              <div className="flex items-center gap-2 text-[12px]">
                <span className="text-[#6f7988]">Milestones:</span>
                <span className="font-mono font-semibold text-[#1c1d1f]">
                  {doneDeliverables}/{totalDeliverables} ({progressPercent}%)
                </span>
                <div className="w-24 bg-[#e4e7ec] h-1.5 rounded-full overflow-hidden ml-1">
                  <div
                    className="bg-[#266df0] h-full transition-all duration-300"
                    style={{ width: `${progressPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WORKSPACE MAIN BODY: 2-COLUMN COCKPIT */}
      <main className="max-w-7xl mx-auto w-full px-4 sm:px-8 py-8 flex-1">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* LEFT COLUMN: PM EXECUTION COCKPIT (65% / 8 Cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* View Tabs */}
            <div className="bg-white border border-[#e4e7ec] rounded-[14px] p-1.5 flex items-center gap-1 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab('deliverables')}
                className={`flex-1 py-2 text-[12px] font-semibold rounded-[9px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'deliverables'
                    ? 'bg-[#232529] text-white shadow-xs'
                    : 'text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#f4f5f7]'
                }`}
              >
                <ListTodo size={14} />
                <span>Scope & Deliverables ({totalDeliverables})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('scratchpad')}
                className={`flex-1 py-2 text-[12px] font-semibold rounded-[9px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'scratchpad'
                    ? 'bg-[#232529] text-white shadow-xs'
                    : 'text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#f4f5f7]'
                }`}
              >
                <FileText size={14} />
                <span>Project Brief & Scratchpad</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('timeline')}
                className={`flex-1 py-2 text-[12px] font-semibold rounded-[9px] flex items-center justify-center gap-2 transition-all cursor-pointer ${
                  activeTab === 'timeline'
                    ? 'bg-[#232529] text-white shadow-xs'
                    : 'text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#f4f5f7]'
                }`}
              >
                <MessageSquare size={14} />
                <span>Meeting Notes ({activities.length})</span>
              </button>
            </div>

            {/* TAB CONTENT: 1. Deliverables & Milestones */}
            {activeTab === 'deliverables' && (
              <div className="bg-white border border-[#e4e7ec] rounded-[14px] p-6 shadow-2xs space-y-6">
                <DeliverablesTracker
                  dealTitle={deal.title}
                  dealValue={deal.value}
                  rawAmount={deal.rawAmount || parseInt(deal.value.replace(/[^0-9]/g, '')) || 0}
                  deliverables={deal.deliverables || []}
                  invoices={deal.invoices || []}
                  onChangeDeliverables={(updatedDel) => {
                    handleUpdateDeal({ ...deal, deliverables: updatedDel })
                  }}
                  onChangeInvoices={(updatedInv) => {
                    handleUpdateDeal({ ...deal, invoices: updatedInv })
                  }}
                  onAutoAdvanceStage={(stage, reason) => {
                    handleStageChange(stage)
                    addToast(reason)
                  }}
                  onToast={(msg) => addToast(msg)}
                />
              </div>
            )}

            {/* TAB CONTENT: 2. Project Brief & Scratchpad */}
            {activeTab === 'scratchpad' && (
              <div className="bg-white border border-[#e4e7ec] rounded-[14px] p-6 shadow-2xs space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
                  <div>
                    <h3 className="text-[14px] font-bold text-[#1c1d1f]">Project Brief & Working Specs</h3>
                    <p className="text-[12px] text-[#6f7988]">
                      Use slash commands (<code className="font-mono text-[#266df0]">/scope</code>, <code className="font-mono text-[#266df0]">/call</code>, <code className="font-mono text-[#266df0]">/todo</code>) to draft scope and sync tasks to GTD follow-ups.
                    </p>
                  </div>
                </div>

                <ScratchpadEditor
                  notes={deal.notes || ''}
                  onChangeNotes={(newNotes) => {
                    handleUpdateDeal({ ...deal, notes: newNotes })
                  }}
                  onSyncTodos={(todos) => handleSyncTodos(todos)}
                  dealContext={{
                    title: deal.title,
                    company: deal.company,
                    contactName: deal.contactName,
                    value: deal.value,
                  }}
                />
              </div>
            )}

            {/* TAB CONTENT: 3. Meeting Notes & Timeline Feed */}
            {activeTab === 'timeline' && (
              <div className="bg-white border border-[#e4e7ec] rounded-[14px] p-6 shadow-2xs space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-[#f0f2f5]">
                  <div>
                    <h3 className="text-[14px] font-bold text-[#1c1d1f]">Timeline & Meeting Notes</h3>
                    <p className="text-[12px] text-[#6f7988]">
                      Touchpoint log for client calls, scoping decisions, and action items.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (!isDraftingNote) {
                        setNewMeetingTitle(`${deal.company} sync`)
                        setDraftNotes('')
                        setIsDraftingNote(true)
                      } else {
                        setIsDraftingNote(false)
                      }
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-[#266df0] bg-[#e9f0ff] hover:bg-[#d8e5ff] rounded-[8px] transition-colors cursor-pointer"
                  >
                    <Plus size={13} />
                    <span>{isDraftingNote ? 'Cancel' : '+ New Meeting Note'}</span>
                  </button>
                </div>

                {/* Drafting scratchpad box */}
                {isDraftingNote && (
                  <div className="p-4 bg-[#fafbfc] border border-[#d6e3fc] rounded-[12px] space-y-3 animate-in fade-in duration-150">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={newMeetingTitle}
                        onChange={(e) => setNewMeetingTitle(e.target.value)}
                        placeholder="Meeting title (e.g. Scope Approval, Weekly Sync)"
                        className="flex-1 px-3 py-1.5 text-[12px] font-semibold border border-[#e4e7ec] rounded-[8px] bg-white focus:outline-none focus:border-[#266df0]"
                      />
                      <select
                        value={newMeetingType}
                        onChange={(e) => setNewMeetingType(e.target.value as Activity['type'])}
                        className="px-2.5 py-1.5 text-[11px] font-medium border border-[#e4e7ec] rounded-[8px] bg-white focus:outline-none text-[#505967]"
                      >
                        <option value="Meeting">Meeting</option>
                        <option value="Call">Call</option>
                        <option value="Note">Note</option>
                        <option value="Follow-up">Follow-up</option>
                      </select>
                    </div>

                    <ScratchpadEditor
                      notes={draftNotes}
                      onChangeNotes={(text) => setDraftNotes(text)}
                      dealContext={{
                        title: deal.title,
                        company: deal.company,
                        contactName: deal.contactName,
                        value: deal.value,
                      }}
                    />

                    <div className="flex justify-end gap-2 pt-2 border-t border-[#edf0f3]">
                      <button
                        type="button"
                        onClick={() => setIsDraftingNote(false)}
                        className="px-3 py-1.5 text-[11px] font-medium text-[#6f7988] hover:text-[#1c1d1f] cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleSaveDraftNote}
                        disabled={!newMeetingTitle.trim() || !draftNotes.trim()}
                        className="px-3.5 py-1.5 bg-[#266df0] hover:bg-[#1f5ad1] disabled:opacity-40 text-white text-[11px] font-semibold rounded-[7px] cursor-pointer"
                      >
                        Save Note to Timeline
                      </button>
                    </div>
                  </div>
                )}

                {/* Timeline Items List */}
                {activities.length === 0 ? (
                  <div className="py-12 text-center text-[#8f99a8]">
                    <MessageSquare size={24} className="mx-auto mb-2 opacity-50" />
                    <p className="text-[13px] font-medium text-[#1c1d1f]">No recorded meetings yet</p>
                    <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mt-0.5">
                      Keep track of scoping calls, client decisions, and follow-ups.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activities.map((act) => {
                      const isExpanded = expandedActivityIds[act.id] !== false
                      return (
                        <div
                          key={act.id}
                          className="p-4 bg-[#fafbfc] border border-[#edf0f3] rounded-[12px] space-y-2.5 transition-all"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-[#e9f0ff] text-[#266df0] text-[10px] font-bold flex items-center justify-center">
                                {act.type[0]}
                              </span>
                              <div>
                                <h4 className="text-[13px] font-semibold text-[#1c1d1f]">{act.title}</h4>
                                <div className="text-[11px] text-[#8f99a8]">
                                  {act.date} • {act.person}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                setExpandedActivityIds((prev) => ({
                                  ...prev,
                                  [act.id]: !isExpanded,
                                }))
                              }}
                              className="text-[11px] text-[#6f7988] hover:text-[#1c1d1f] font-medium cursor-pointer"
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </button>
                          </div>

                          {act.notes && isExpanded && (
                            <div className="pt-2 border-t border-[#edf0f3] text-[12px]">
                              <MarkdownFormatter
                                content={act.notes}
                                onToggleCheck={(text: string, checked: boolean) => {
                                  handleToggleMarkdownCheck(act.id, text, checked)
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: CLIENT, INVOICING & NEXT ACTION (35% / 4 Cols) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. MANDATORY NEXT ACTION (GTD RULE) */}
            <div className="bg-white border border-[#d6e3fc] rounded-[14px] p-5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
                  <AlertCircle size={14} />
                  <span>Mandatory Next Action (GTD)</span>
                </div>
                {!isEditingNextAction && (
                  <button
                    type="button"
                    onClick={() => setIsEditingNextAction(true)}
                    className="text-[11px] text-[#266df0] hover:underline font-medium cursor-pointer"
                  >
                    Edit
                  </button>
                )}
              </div>

              {isEditingNextAction ? (
                <div className="space-y-2 pt-1 animate-in fade-in duration-150">
                  <input
                    type="text"
                    value={nextActionText}
                    onChange={(e) => setNextActionText(e.target.value)}
                    placeholder="e.g. Send formal quote & deposit link"
                    className="w-full px-3 py-1.5 text-[12px] border border-[#e4e7ec] rounded-[8px] focus:outline-none focus:border-[#266df0]"
                  />
                  <input
                    type="text"
                    value={nextActionDate}
                    onChange={(e) => setNextActionDate(e.target.value)}
                    placeholder="e.g. Tomorrow, 10:00"
                    className="w-full px-3 py-1.5 text-[12px] border border-[#e4e7ec] rounded-[8px] focus:outline-none focus:border-[#266df0]"
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setIsEditingNextAction(false)}
                      className="px-2.5 py-1 text-[11px] text-[#6f7988] hover:text-[#1c1d1f] cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveNextAction}
                      className="px-3 py-1 bg-[#266df0] hover:bg-[#1f5ad1] text-white text-[11px] font-semibold rounded-[7px] cursor-pointer"
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-[#f8faff] border border-[#e2ecfd] rounded-[10px] space-y-1">
                  <p className="text-[13px] font-semibold text-[#1c1d1f]">
                    {deal.next || 'No next action scheduled'}
                  </p>
                  <div className="flex items-center gap-1.5 text-[11px] text-[#6f7988]">
                    <Clock size={12} className="text-[#266df0]" />
                    <span>{deal.nextDueDate || 'Pending schedule'}</span>
                  </div>
                </div>
              )}
            </div>

            {/* 2. CLIENT ACCOUNT & PRIMARY STAKEHOLDER */}
            <div className="bg-white border border-[#e4e7ec] rounded-[14px] p-5 shadow-2xs space-y-4">
              <h3 className="text-[13px] font-bold text-[#1c1d1f] uppercase tracking-wider text-[#8f99a8]">
                Client & Stakeholder
              </h3>

              <div className="p-3.5 bg-[#fafbfc] border border-[#edf0f3] rounded-[12px] space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-[14px] font-bold text-[#1c1d1f]">
                      {deal.contactName || deal.company}
                    </h4>
                    <p className="text-[11px] text-[#6f7988]">{deal.company}</p>
                  </div>
                  <span className="w-8 h-8 rounded-full bg-[#f0f2f5] text-[#232529] text-[11px] font-bold flex items-center justify-center">
                    {deal.company[0]}
                  </span>
                </div>

                <div className="space-y-2 pt-2 border-t border-[#edf0f3] text-[12px]">
                  {/* Email Link */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#8f99a8] flex items-center gap-1.5">
                      <Mail size={13} /> Email:
                    </span>
                    <a
                      href={`mailto:${contactEmail}`}
                      className="font-medium text-[#266df0] hover:underline truncate max-w-[180px]"
                      title={`Send email to ${contactEmail}`}
                    >
                      {contactEmail}
                    </a>
                  </div>

                  {/* Company Directory Link */}
                  <div className="flex items-center justify-between">
                    <span className="text-[#8f99a8] flex items-center gap-1.5">
                      <Building2 size={13} /> Account:
                    </span>
                    <Link
                      href="/?view=Companies"
                      className="font-medium text-[#505967] hover:text-[#1c1d1f]"
                    >
                      {deal.company}
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODALS */}
      {isLogCallOpen && (
        <LogCallModal
          isOpen={isLogCallOpen}
          onClose={() => setIsLogCallOpen(false)}
          initialDealId={deal.id}
          deals={modalDeals}
          contacts={modalContacts}
          prefilledCompany={deal.company}
          onSaveActivity={async (newAct: Omit<Activity, 'id'>, newFollowUp?: Omit<FollowUpItem, 'id'>) => {
            try {
              const res = await logActivityAction(newAct, newFollowUp, deal.id)
              setActivities((prev) => [res.activity, ...prev])
              setIsLogCallOpen(false)
              addToast(`Logged interaction for ${deal.company}`)
            } catch (err: any) {
              addToast(err?.message || 'Failed to log call', undefined, 'warning')
            }
          }}
        />
      )}
    </div>
  )
}
