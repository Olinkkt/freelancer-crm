'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2,
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
} from 'lucide-react'
import { Deal, DealStage, DeliverableItem, InvoiceMilestone, Activity } from '@/lib/crm-types'
import { ScratchpadEditor } from './scratchpad-editor'
import { DeliverablesTracker } from './deliverables-tracker'
import { MarkdownFormatter } from '../ui/markdown-formatter'

interface DealDetailDrawerProps {
  deal: Deal | null
  isOpen: boolean
  onClose: () => void
  onUpdateDeal: (deal: Deal) => void
  onDeleteDeal?: (id: string) => void
  onSyncTodos?: (todos: string[], companyName?: string) => void
  activities?: Activity[]
  onAddActivity?: (activity: Omit<Activity, 'id'>) => void
}

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Scope', 'Quote sent', 'Negotiation', 'Won']

export function DealDetailDrawer({
  deal,
  isOpen,
  onClose,
  onUpdateDeal,
  onDeleteDeal,
  onSyncTodos,
  activities = [],
  onAddActivity,
}: DealDetailDrawerProps) {
  const [currentDeal, setCurrentDeal] = useState<Deal | null>(deal)
  const [activeTab, setActiveTab] = useState<'overview' | 'deliverables'>('overview')
  const [notes, setNotes] = useState('')
  const [newMeetingTitle, setNewMeetingTitle] = useState('')
  const [newMeetingType, setNewMeetingType] = useState<Activity['type']>('Meeting')
  const [isDraftingNote, setIsDraftingNote] = useState(false)
  const [expandedActivityIds, setExpandedActivityIds] = useState<Record<string, boolean>>({})

  useEffect(() => {
    setCurrentDeal(deal)
    if (deal) {
      setNotes(deal.notes || '')
    }
  }, [deal])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !currentDeal) return null

  const handleStageChange = (newStage: DealStage) => {
    const updated: Deal = {
      ...currentDeal,
      stage: newStage,
      probability: newStage === 'Won' ? '100%' : currentDeal.probability,
      color: 'blue',
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

            <div className="flex items-center gap-1">
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
                      {currentDeal.value}
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
                  <div className="grid grid-cols-3 gap-1.5">
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

                {/* Mandatory Next Action (GTD Rule) */}
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

                {/* Contact Information */}
                <div className="space-y-2 pt-2 border-t border-[#f0f1f3]">
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
                    Primary Contact
                  </span>
                  <div className="p-3 bg-[#fafbfc] border border-[#edf0f3] rounded-[12px] flex items-center justify-between">
                    <div>
                      <div className="text-[13px] font-semibold text-[#1c1d1f]">
                        {currentDeal.contactName || currentDeal.company}
                      </div>
                      <div className="text-[11px] text-[#6f7988]">
                        {currentDeal.contactEmail || `contact@${currentDeal.company.toLowerCase().replace(/\s+/g, '')}.cz`}
                      </div>
                    </div>
                    <a
                      href={`mailto:${currentDeal.contactEmail || 'client@example.cz'}`}
                      className="w-8 h-8 rounded-[10px] bg-white border border-[#e4e7ec] text-[#266df0] hover:bg-[#e9f0ff] flex items-center justify-center transition-colors"
                      title="Send email"
                    >
                      <Mail size={15} />
                    </a>
                  </div>
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
                      <span>{isDraftingNote ? 'Cancel' : 'Log New Note'}</span>
                    </button>
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
                  invoices={currentDeal.invoices || []}
                  onChangeDeliverables={handleChangeDeliverables}
                  onChangeInvoices={handleChangeInvoices}
                />
              </div>
            )}
          </div>

          {/* Drawer Footer */}
          <div className="p-4 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between">
            {onDeleteDeal && (
              <button
                onClick={() => {
                  onDeleteDeal(currentDeal.id)
                  onClose()
                }}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-[#d73a49] hover:text-[#b31d28] p-1.5 rounded-[8px]"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={() => handleStageChange('Won')}
                disabled={currentDeal.stage === 'Won'}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#232529] text-[11px] font-medium rounded-[10px] transition-colors disabled:opacity-50"
              >
                <CheckCircle2 size={14} className="text-[#3b9b6d]" />
                <span>{currentDeal.stage === 'Won' ? 'Won' : 'Mark as Won'}</span>
              </button>
              <button
                onClick={onClose}
                className="px-3.5 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[10px] shadow-xs transition-colors"
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
