'use client'

import React, { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  X,
  Building2,
  Calendar,
  AlertCircle,
  Check,
  Banknote,
  Clock,
  Mail,
  Send,
  Trash2,
  ChevronRight,
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
import { Deal, DealStage, STAGE_DEFAULT_PROBABILITIES, DeliverableItem, InvoiceMilestone, Activity, WorkspaceSettings } from '@/lib/crm-types'
import { ScratchpadEditor } from './scratchpad-editor'
import { DeliverablesTracker } from './deliverables-tracker'
import { MarkdownFormatter } from '../ui/markdown-formatter'
import { formatDealValue, formatMoney } from '@/lib/config'

interface DealDetailDrawerProps {
  deal: Deal | null
  isOpen: boolean
  onClose: () => void
  onUpdateDeal: (deal: Deal) => void
  onDeleteDeal?: (id: string) => void
  onSyncTodos?: (todos: string[], companyName?: string) => void
  activities?: Activity[]
  onAddActivity?: (activity: Omit<Activity, 'id'>) => void
  onOpenLogCallModal?: () => void
  onToast?: (message: string) => void
  settings?: WorkspaceSettings
}

const STAGES: DealStage[] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Paid',
]

export function DealDetailDrawer({
  deal,
  isOpen,
  onClose,
  onUpdateDeal,
  onDeleteDeal,
  onSyncTodos,
  activities = [],
  onAddActivity,
  onOpenLogCallModal,
  onToast,
  settings,
}: DealDetailDrawerProps) {
  const router = useRouter()
  const [currentDeal, setCurrentDeal] = useState<Deal | null>(deal)
  const [activeTab, setActiveTab] = useState<'overview' | 'deliverables'>('overview')
  const [notes, setNotes] = useState('')
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingType, setNewMeetingType] = useState<Activity['type']>('Meeting')
  const [isDraftingNote, setIsDraftingNote] = useState(false)
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({})
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

  useEffect(() => {
    setCurrentDeal(deal)
    setIsConfirmingDelete(false)
    if (deal) {
      setNotes(deal.notes || '')
    }
  }, [deal])

  useEffect(() => {
    if (!isOpen) {
      setIsConfirmingDelete(false)
    }
  }, [isOpen])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
      if (
        (e.key === 'l' || e.key === 'L') &&
        isOpen &&
        !e.metaKey &&
        !e.ctrlKey &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable &&
        onOpenLogCallModal
      ) {
        e.preventDefault()
        onOpenLogCallModal()
        return
      }
      if (
        (e.key === 'o' || e.key === 'O') &&
        isOpen &&
        currentDeal &&
        !['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName) &&
        !(e.target as HTMLElement)?.isContentEditable
      ) {
        e.preventDefault()
        router.push(`/deals/${currentDeal.id}`)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose, currentDeal, router, onOpenLogCallModal])

  const dealInvoices = React.useMemo(() => {
    if (!currentDeal) return []
    if (currentDeal.invoices && currentDeal.invoices.length > 0) {
      return currentDeal.invoices
    }
    return []
  }, [currentDeal?.id, currentDeal?.invoices])

  if (!isOpen || !currentDeal) return null

  const handleStageChange = (newStage: DealStage) => {
    const isClosed = newStage === 'Won' || newStage === 'Paid'
    const isPaid = newStage === 'Paid'
    const isWon = newStage === 'Won'

    // Do NOT automatically alter invoice statuses when moving stages
    const updatedInvoices = currentDeal.invoices || []

    // Smart next action sync
    let nextAction = currentDeal.next
    let nextDueDate = currentDeal.nextDueDate
    if (isWon) {
      if (!nextAction || nextAction.toLowerCase().includes('proposal') || nextAction.toLowerCase().includes('deposit')) {
        nextAction = 'Kickoff meeting & design sprint'
        nextDueDate = 'Tomorrow, 10:00'
      }
    } else if (isPaid) {
      nextAction = 'Request testimonial & case study review'
      nextDueDate = 'In 3 days'
    }

    const updated: Deal = {
      ...currentDeal,
      stage: newStage,
      probability: STAGE_DEFAULT_PROBABILITIES[newStage],
      color: isClosed ? 'green' : (currentDeal.color || 'blue'),
      next: nextAction,
      nextDueDate: nextDueDate,
      invoices: updatedInvoices,
    }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
  }

  const handleSaveNotes = (updatedNotes: string) => {
    const updated = { ...currentDeal, notes: updatedNotes }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
  }

  const handleChangeDeliverables = (newDeliverables: DeliverableItem[]) => {
    const updated = { ...currentDeal, deliverables: newDeliverables }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
  }

  const handleChangeInvoices = (newInvoices: InvoiceMilestone[]) => {
    const updated = { ...currentDeal, invoices: newInvoices }
    setCurrentDeal(updated)
    onUpdateDeal(updated)
  }

  const dealActivities = activities.filter(
    (a) => a.dealId === currentDeal.id || a.company === currentDeal.company
  )

  const handleCreateMeetingActivity = () => {
    if (!notes.trim()) return

    if (onAddActivity) {
      const now = new Date()
      const timeStr = 'Today, ' + now.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })

      onAddActivity({
        dealId: currentDeal.id,
        type: newMeetingType,
        title: newMeetingTitle.trim() || `${newMeetingType} Note`,
        person: currentDeal.contactName || currentDeal.company,
        company: currentDeal.company,
        date: timeStr,
        status: 'Completed',
        color: currentDeal.color || 'blue',
        summary: notes.trim(),
      })
    }

    // Also update deal's latest note
    handleSaveNotes(notes.trim())
    setNotes('')
    setNewMeetingTitle('')
    setIsDraftingNote(false)
  }

  const toggleExpandActivity = (id: string) => {
    setExpandedActivityIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <div
      className="fixed inset-0 z-50 overflow-hidden bg-[#10141c]/30 backdrop-blur-xs transition-opacity animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="absolute inset-y-0 right-0 max-w-full flex pl-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-screen max-w-md bg-white border-l border-[#e4e7ec] shadow-2xl flex flex-col h-full animate-in slide-in-from-right duration-200">
          {/* Topbar of Drawer */}
          <div className="p-5 border-b border-[#edf0f3] flex items-center justify-between bg-[#fafbfc]">
            <div className="flex items-center gap-2.5">
              <span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[12px] font-semibold bg-[#e9f0ff] text-[#266df0] shrink-0">
                {currentDeal.company.charAt(0)}
              </span>
              <div>
                <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f99a8] block">
                  Opportunity Drawer
                </span>
                <span className="text-[13px] font-semibold text-[#1c1d1f]">
                  {currentDeal.company}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <Link
                href={`/deals/${currentDeal.id}`}
                title="Open full project workspace (O)"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-semibold text-[#1c1d1f] bg-white hover:bg-[#f0f2f5] rounded-[7px] border border-[#dce0e8] hover:border-[#cbd0d8] transition-colors cursor-pointer mr-1"
              >
                <ExternalLink size={12} className="text-[#266df0]" />
                <span className="hidden sm:inline">Workspace</span>
                <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] font-mono text-[#8f99a8] bg-[#f4f5f6] border border-[#e4e7ec] rounded-[4px]">
                  O
                </kbd>
              </Link>
              {onOpenLogCallModal && (
                <button
                  type="button"
                  onClick={onOpenLogCallModal}
                  title="Quick Log Call or Meeting Note (L)"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#266df0] bg-[#e9f0ff] hover:bg-[#d8e5ff] rounded-[7px] border border-[#d6e3fc] transition-colors cursor-pointer mr-1"
                >
                  <PhoneCall size={12} />
                  <span>Log (L)</span>
                </button>
              )}
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono text-[#8f99a8] bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] mr-1">
                ESC
              </kbd>
              <button
                onClick={onClose}
                className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* Sub-navigation Tabs */}
          <div className="flex items-center px-6 border-b border-[#edf0f3] bg-[#fafbfc] gap-4 text-[12px]">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'overview'
                  ? 'border-[#266df0] text-[#266df0] font-semibold'
                  : 'border-transparent text-[#6f7988] hover:text-[#1c1d1f]'
              }`}
            >
              <FileText size={13} />
              <span>Overview & Notes</span>
              {dealActivities.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-[#e9f0ff] text-[#266df0] font-bold">
                  {dealActivities.length}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('deliverables')}
              className={`py-2.5 font-medium border-b-2 flex items-center gap-1.5 transition-colors cursor-pointer ${
                activeTab === 'deliverables'
                  ? 'border-[#266df0] text-[#266df0] font-semibold'
                  : 'border-transparent text-[#6f7988] hover:text-[#1c1d1f]'
              }`}
            >
              <ListTodo size={13} />
              <span>Scope & Deliverables</span>
              {(currentDeal.deliverables?.length ?? 0) > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-mono bg-[#e9f0ff] text-[#266df0] font-bold">
                  {currentDeal.deliverables?.length}
                </span>
              )}
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {activeTab === 'overview' ? (
              <>
                {/* Title & Value */}
                <div>
                  <h1 className="text-[20px] font-bold text-[#1c1d1f] tracking-tight leading-snug">
                    {currentDeal.title}
                  </h1>
                  <div className="mt-3 flex items-baseline gap-3">
                    <span className="text-[26px] font-bold font-mono tabular-nums text-[#1c1d1f] tracking-tight">
                      {formatDealValue(currentDeal.value)}
                    </span>
                    <span className="px-2 py-0.5 text-[11px] font-medium rounded-[7px] bg-[#f0f2f5] text-[#232529] font-mono">
                      {currentDeal.probability} prob.
                    </span>
                  </div>
                </div>

                {/* Stage Selector */}
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                    Pipeline Stage
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                    {STAGES.map((s) => (
                      <button
                        key={s}
                        onClick={() => handleStageChange(s)}
                        className={`py-1.5 px-2 rounded-[10px] text-[11px] font-medium transition-all border text-center cursor-pointer ${
                          currentDeal.stage === s
                            ? 'bg-[#232529] text-white border-[#232529] shadow-xs'
                            : 'bg-white text-[#505967] border-[#e4e7ec] hover:bg-[#f7f8fa]'
                        }`}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Active Project Cockpit (Won = Active Working Stage) */}
                {currentDeal.stage === 'Won' && (
                  <div className="p-4 bg-[#f0f5ff] border border-[#c3d9ff] rounded-[12px] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
                        <Sparkles size={14} />
                        <span>Active Project Execution</span>
                      </div>
                      <span className="text-[10px] font-semibold text-[#266df0] bg-[#e1edff] px-2 py-0.5 rounded-[7px]">
                        In Progress
                      </span>
                    </div>

                    {/* Deliverables Progress */}
                    <div className="text-[12px] text-[#2c3f60] flex items-center justify-between">
                      <span>Deliverables:</span>
                      <strong className="font-semibold text-[#1c1d1f]">
                        {currentDeal.deliverables?.filter((d) => d.status === 'Done').length || 0} of{' '}
                        {currentDeal.deliverables?.length || 0} complete
                      </strong>
                    </div>

                    {/* Invoices Status */}
                    <div className="text-[12px] text-[#2c3f60] flex items-center justify-between">
                      <span>Invoices:</span>
                      <strong className="font-semibold text-[#1c1d1f]">
                        {currentDeal.invoices?.filter((i) => i.status === 'Paid').length || 0} of{' '}
                        {currentDeal.invoices?.length || 0} collected
                      </strong>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-[#d6e4ff] h-1.5 rounded-full overflow-hidden">
                      <div
                        className="bg-[#266df0] h-full transition-all duration-300"
                        style={{
                          width: `${
                            currentDeal.deliverables && currentDeal.deliverables.length > 0
                              ? Math.round(
                                  (currentDeal.deliverables.filter((d) => d.status === 'Done').length /
                                    currentDeal.deliverables.length) *
                                    100
                                )
                              : 0
                          }%`,
                        }}
                      />
                    </div>

                    {(() => {
                      const totalDel = currentDeal.deliverables?.length || 0
                      const doneDel = currentDeal.deliverables?.filter((d) => d.status === 'Done').length || 0
                      const totalInv = currentDeal.invoices?.length || 0
                      const paidInv = currentDeal.invoices?.filter((i) => i.status === 'Paid').length || 0
                      const isReadyToComplete =
                        totalDel > 0 && doneDel === totalDel && totalInv > 0 && paidInv === totalInv

                      return (
                        <div className="space-y-2 pt-1">
                          {!isReadyToComplete && (
                            <p className="text-[11px] text-[#556987] bg-white/70 p-2 rounded-[8px] border border-[#dce8fc]">
                              💡 To mark as completed: all {totalDel || 'milestone'} deliverables must be marked Done and all {totalInv || 'billing'} invoices must be marked Paid.
                            </p>
                          )}

                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setActiveTab('deliverables')}
                              className="px-2.5 py-1.5 bg-white hover:bg-[#f5f8ff] text-[#266df0] border border-[#b8d2fe] text-[11px] font-semibold rounded-[8px] shadow-2xs transition-colors cursor-pointer"
                            >
                              Manage Milestones & Invoices →
                            </button>

                            {isReadyToComplete ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const updated: Deal = {
                                    ...currentDeal,
                                    stage: 'Paid',
                                    probability: '100%',
                                    next: 'Request testimonial & case study review',
                                    nextDueDate: 'In 3 days',
                                  }
                                  setCurrentDeal(updated)
                                  onUpdateDeal(updated)
                                  if (onToast) {
                                    onToast(`🎉 All milestones done & invoices paid! Project Completed.`)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-[#16a34a] hover:bg-[#15803d] text-white text-[11px] font-semibold rounded-[8px] shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Check size={12} strokeWidth={2.5} />
                                <span>Mark Project as Completed & Paid</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  if (
                                    !window.confirm(
                                      `Mark all ${totalDel} deliverables as Done and all ${totalInv} invoices as Paid to complete this project?`
                                    )
                                  ) {
                                    return
                                  }
                                  const allDel = (currentDeal.deliverables || []).map((d) => ({
                                    ...d,
                                    status: 'Done' as const,
                                    clientSignOff: true,
                                  }))
                                  const allInv = (currentDeal.invoices || []).map((inv) => ({
                                    ...inv,
                                    status: 'Paid' as const,
                                    paidAt: inv.paidAt || 'Just now',
                                  }))
                                  const updated: Deal = {
                                    ...currentDeal,
                                    stage: 'Paid',
                                    probability: '100%',
                                    deliverables: allDel,
                                    invoices: allInv,
                                    next: 'Request testimonial & case study review',
                                    nextDueDate: 'In 3 days',
                                  }
                                  setCurrentDeal(updated)
                                  onUpdateDeal(updated)
                                  if (onToast) {
                                    onToast(`🎉 All deliverables marked done & invoices paid! Project completed.`)
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-white hover:bg-[#edf5ee] text-[#1f7a47] border border-[#a2e3b9] text-[11px] font-semibold rounded-[8px] shadow-2xs transition-colors cursor-pointer inline-flex items-center gap-1"
                              >
                                <Check size={12} />
                                <span>Settle & Complete All</span>
                              </button>
                            )}
                          </div>
                        </div>
                      )
                    })()}
                  </div>
                )}

                {/* Mandatory Next Action (GTD Rule) */}
                {currentDeal.stage !== 'Paid' && currentDeal.next ? (
                  <div className="p-4 bg-[#f8faff] border border-[#d6e3fc] rounded-[12px] space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#266df0] uppercase tracking-wider">
                        <AlertCircle size={14} />
                        <span>Mandatory Next Action</span>
                      </div>
                      <span className="text-[10px] font-medium text-[#266df0] bg-[#e9f0ff] px-2 py-0.5 rounded-[7px]">
                        {currentDeal.nextDueDate || 'Scheduled'}
                      </span>
                    </div>
                    <p className="text-[13px] font-semibold text-[#1c1d1f]">{currentDeal.next}</p>
                  </div>
                ) : currentDeal.stage !== 'Paid' ? (
                  /* GTD Alert: Missing next action! */
                  <div className="p-3 bg-[#fff9f0] border border-[#fedf89] rounded-[12px] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={15} className="text-[#b54708] shrink-0" />
                      <div>
                        <span className="text-[12px] font-bold text-[#b54708] block">No Next Action Scheduled</span>
                        <span className="text-[11px] text-[#7a2e0e]">Deals without clear next steps stall.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const updated = {
                          ...currentDeal,
                          next: 'Follow up regarding next milestone',
                          nextDueDate: 'Tomorrow, 10:00',
                        }
                        setCurrentDeal(updated)
                        onUpdateDeal(updated)
                      }}
                      className="px-2 py-1 bg-white hover:bg-[#fff6ed] text-[#b54708] border border-[#fec84b] text-[11px] font-semibold rounded-[7px] cursor-pointer"
                    >
                      + Set Quick Next Action
                    </button>
                  </div>
                ) : null}

                {/* Post-Delivery High-Leverage Follow-Up Prompts */}
                {currentDeal.stage === 'Paid' && (
                  <div className="p-4 bg-[#eaf8f0] border border-[#b8eccb] rounded-[12px] space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#1f7a47] uppercase tracking-wider">
                        <Check size={14} />
                        <span>Project Completed & 100% Paid</span>
                      </div>
                      <span className="text-[10px] font-medium text-[#1f7a47] bg-[#d5f4e2] px-2 py-0.5 rounded-[7px]">
                        Post-Delivery
                      </span>
                    </div>
                    <p className="text-[12px] text-[#234d34]">
                      Turn this finished project into referrals and recurring revenue:
                    </p>
                    <div className="flex items-center gap-2 flex-wrap pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          const updated = {
                            ...currentDeal,
                            next: 'Request testimonial & case study review',
                            nextDueDate: 'In 3 days',
                          }
                          setCurrentDeal(updated)
                          onUpdateDeal(updated)
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-[#f3fbf6] text-[#1f7a47] border border-[#a2e3b9] text-[11px] font-semibold rounded-[8px] shadow-2xs transition-colors cursor-pointer"
                      >
                        + Request Testimonial (in 3 days)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const updated = {
                            ...currentDeal,
                            next: `Pitch monthly maintenance retainer (${formatMoney(8000, settings)}/mo)`,
                            nextDueDate: 'In 14 days',
                          }
                          setCurrentDeal(updated)
                          onUpdateDeal(updated)
                        }}
                        className="px-2.5 py-1.5 bg-white hover:bg-[#f3fbf6] text-[#1f7a47] border border-[#a2e3b9] text-[11px] font-semibold rounded-[8px] shadow-2xs transition-colors cursor-pointer"
                      >
                        + Pitch Monthly Retainer (in 14 days)
                      </button>
                    </div>
                  </div>
                )}

                {/* Contact Information */}
                <div className="space-y-2 pt-2 border-t border-[#f0f1f3]">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                    Primary Contact
                  </span>
                  {(() => {
                    const contactEmail = currentDeal.contactEmail?.trim()

                    return (
                      <div className="p-3 bg-[#fafbfc] border border-[#edf0f3] rounded-[12px] flex items-center justify-between">
                        <div>
                          <div className="text-[13px] font-semibold text-[#1c1d1f]">
                            {currentDeal.contactName || currentDeal.company}
                          </div>
                          <div className="text-[11px] text-[#6f7988]">
                            {contactEmail || 'No email specified'}
                          </div>
                        </div>
                        {contactEmail ? (
                          <a
                            href={`mailto:${contactEmail}`}
                            className="w-8 h-8 rounded-[10px] bg-white border border-[#e4e7ec] text-[#266df0] hover:bg-[#e9f0ff] flex items-center justify-center transition-colors"
                            title={`Send email to ${contactEmail}`}
                          >
                            <Mail size={15} />
                          </a>
                        ) : (
                          <span
                            className="w-8 h-8 rounded-[10px] bg-white border border-[#e4e7ec] text-[#a4acb9] flex items-center justify-center cursor-not-allowed"
                            title="No email on record"
                          >
                            <Mail size={15} />
                          </span>
                        )}
                      </div>
                    )
                  })()}
                </div>

                {/* MULTI-MEETING NOTES & TIMELINE STREAM (Option 2) */}
                <div className="space-y-3 pt-2 border-t border-[#f0f1f3]">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                        Meeting Notes & Timeline Feed
                      </span>
                      <span className="text-[11px] text-[#6f7988]">
                        {dealActivities.length} recorded interaction{dealActivities.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {onOpenLogCallModal && (
                        <button
                          type="button"
                          onClick={onOpenLogCallModal}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-[#505967] hover:text-[#1c1d1f] bg-[#f0f2f5] hover:bg-[#e4e7ec] rounded-[7px] transition-colors cursor-pointer"
                        >
                          <PhoneCall size={11} />
                          <span>Quick Log (L)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (!isDraftingNote) {
                            setNewMeetingTitle(`${currentDeal.company} sync`)
                            setNotes('')
                            setIsDraftingNote(true)
                          } else {
                            setIsDraftingNote(false)
                            setNotes('')
                          }
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-[#266df0] bg-[#e9f0ff] hover:bg-[#d8e5ff] rounded-[7px] transition-colors cursor-pointer"
                      >
                        <Plus size={12} />
                        <span>{isDraftingNote ? 'Cancel' : 'Scratchpad'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Active Drafting Scratchpad */}
                  {isDraftingNote && (
                    <div className="p-3.5 bg-[#fafbfc] border border-[#d6e3fc] rounded-[12px] space-y-3 animate-in fade-in duration-150">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={newMeetingTitle}
                          onChange={(e) => setNewMeetingTitle(e.target.value)}
                          placeholder="Meeting title (e.g. Kickoff Sync, Feedback Call)"
                          className="flex-1 px-3 py-1.5 text-[12px] font-semibold border border-[#e4e7ec] rounded-[8px] bg-white focus:outline-none focus:border-[#266df0]"
                        />

                        <select
                          value={newMeetingType}
                          onChange={(e) => setNewMeetingType(e.target.value as Activity['type'])}
                          className="px-2 py-1.5 text-[11px] font-medium border border-[#e4e7ec] rounded-[8px] bg-white focus:outline-none text-[#505967]"
                        >
                          <option value="Meeting">Meeting</option>
                          <option value="Call">Call</option>
                          <option value="Note">Note</option>
                          <option value="Follow-up">Follow-up</option>
                        </select>
                      </div>

                      <ScratchpadEditor
                        notes={notes}
                        onChangeNotes={setNotes}
                        onSyncTodos={(todos) => {
                          if (onSyncTodos) {
                            onSyncTodos(todos, currentDeal.company)
                          }
                        }}
                        dealContext={{
                          title: currentDeal.title,
                          company: currentDeal.company,
                          contactName: currentDeal.contactName,
                          value: currentDeal.value,
                        }}
                      />

                      <div className="flex justify-end gap-2 pt-1 border-t border-[#edf0f3]">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDraftingNote(false)
                            setNotes('')
                          }}
                          className="px-2.5 py-1 text-[11px] text-[#6f7988] hover:text-[#1c1d1f]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateMeetingActivity}
                          disabled={!notes.trim()}
                          className="px-3 py-1.5 bg-[#232529] hover:bg-[#101113] disabled:opacity-50 text-white text-[11px] font-medium rounded-[8px] shadow-xs cursor-pointer"
                        >
                          Save Meeting Note
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Past Meeting Logs List */}
                  <div className="space-y-2">
                    {dealActivities.map((act) => {
                      const isExpanded = expandedActivityIds[act.id] ?? true // default expanded
                      return (
                        <div
                          key={act.id}
                          className="rounded-[10px] border border-[#edf0f3] bg-[#fafbfc] overflow-hidden transition-all"
                        >
                          <div
                            onClick={() => toggleExpandActivity(act.id)}
                            className="p-3 flex items-center justify-between cursor-pointer hover:bg-[#f4f6f9] transition-colors"
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span className="w-6 h-6 rounded-[6px] bg-white border border-[#e4e7ec] flex items-center justify-center text-[#266df0] shrink-0">
                                {act.type === 'Call' ? (
                                  <PhoneCall size={12} />
                                ) : (
                                  <MessageSquare size={12} />
                                )}
                              </span>
                              <div className="min-w-0">
                                <h4 className="text-[12px] font-semibold text-[#1c1d1f] truncate">
                                  {act.title}
                                </h4>
                                <span className="text-[10px] text-[#8f99a8]">{act.date}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="px-1.5 py-0.2 rounded-[5px] text-[9px] font-mono font-semibold uppercase bg-white border border-[#e4e7ec] text-[#6f7988]">
                                {act.type}
                              </span>
                              {isExpanded ? (
                                <ChevronUp size={14} className="text-[#8f99a8]" />
                              ) : (
                                <ChevronDown size={14} className="text-[#8f99a8]" />
                              )}
                            </div>
                          </div>

                          {isExpanded && act.summary && (
                            <div className="px-3.5 pb-3.5 pt-2 border-t border-[#f0f2f5] bg-white">
                              <MarkdownFormatter content={act.summary} />
                            </div>
                          )}
                        </div>
                      )
                    })}

                    {dealActivities.length === 0 && !isDraftingNote && (
                      <div className="p-4 text-center border border-dashed border-[#dce0e8] rounded-[10px] text-[11px] text-[#8f99a8]">
                        <p>No meeting notes logged yet for this deal.</p>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDraftingNote(true)
                            setNewMeetingTitle(`${currentDeal.company} sync`)
                            setNotes('')
                          }}
                          className="mt-1 text-[#266df0] font-semibold hover:underline"
                        >
                          + Log first meeting note
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              /* DELIVERABLES & INVOICES TAB (Section 3.5) */
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-[#f8faff] border border-[#d6e3fc] rounded-[10px] text-[12px]">
                  <div className="flex items-center gap-2 text-[#1c1d1f]">
                    <Sparkles size={14} className="text-[#266df0] shrink-0" />
                    <span className="text-[11px] text-[#505967]">
                      Need a full-screen view for scope, specs & invoices?
                    </span>
                  </div>
                  <Link
                    href={`/deals/${currentDeal.id}`}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#266df0] hover:underline shrink-0"
                  >
                    <span>Open Workspace</span>
                    <ExternalLink size={11} />
                  </Link>
                </div>

                <div>
                  <h2 className="text-[16px] font-bold text-[#1c1d1f] tracking-tight">
                    {currentDeal.title}
                  </h2>
                  <p className="text-[11px] text-[#6f7988]">
                    Manage project milestones, deliverables, and billing status for {currentDeal.company}.
                  </p>
                </div>

                <DeliverablesTracker
                  dealTitle={currentDeal.title}
                  dealValue={currentDeal.value}
                  rawAmount={currentDeal.rawAmount}
                  deliverables={currentDeal.deliverables || []}
                  invoices={dealInvoices}
                  onChangeDeliverables={handleChangeDeliverables}
                  onChangeInvoices={handleChangeInvoices}
                  onAutoAdvanceStage={(stage) => handleStageChange(stage)}
                  onToast={onToast}
                  settings={settings}
                />
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between gap-3">
            <div>
              {onDeleteDeal && (
                isConfirmingDelete ? (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteDeal(currentDeal.id)
                        setIsConfirmingDelete(false)
                        onClose()
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-white bg-[#dc2626] hover:bg-[#b91c1c] rounded-[8px] shadow-xs transition-colors cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Confirm Delete</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-2.5 py-1.5 text-[11px] font-medium text-[#64748b] hover:text-[#334155] hover:bg-[#f1f5f9] rounded-[8px] transition-colors cursor-pointer"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium text-[#dc2626] hover:text-[#b91c1c] bg-[#fef2f2] hover:bg-[#fee2e2] border border-[#fecaca] rounded-[8px] transition-colors cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>Delete</span>
                  </button>
                )
              )}
            </div>
            <div className="ml-auto flex items-center gap-1.5 flex-wrap">
              {currentDeal.stage !== 'Won' && currentDeal.stage !== 'Paid' && (
                <button
                  type="button"
                  onClick={() => handleStageChange('Won')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#232529] text-[11px] font-medium rounded-[10px] transition-colors cursor-pointer"
                >
                  <Check size={13} className="text-[#3b9b6d]" />
                  <span>Mark Won</span>
                </button>
              )}
              {currentDeal.stage !== 'Paid' && (
                <button
                  type="button"
                  onClick={() => handleStageChange('Paid')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#232529] text-[11px] font-medium rounded-[10px] transition-colors cursor-pointer"
                >
                  <Banknote size={13} className="text-[#059669]" />
                  <span>Mark Paid</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[10px] shadow-xs transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
