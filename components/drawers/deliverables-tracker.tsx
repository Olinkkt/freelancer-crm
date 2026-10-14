'use client'

import React, { useState } from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  ShieldCheck,
  Receipt,
  FileCheck,
  CreditCard,
  Send,
  AlertCircle,
  Calendar,
  Copy,
  Check,
  Sparkles,
  Link2,
} from 'lucide-react'
import { DeliverableItem, InvoiceMilestone, WorkspaceSettings } from '@/lib/crm-types'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'

interface DeliverablesTrackerProps {
  dealTitle: string
  dealValue: string
  rawAmount: number
  deliverables: DeliverableItem[]
  invoices: InvoiceMilestone[]
  onChangeDeliverables: (items: DeliverableItem[]) => void
  onChangeInvoices: (items: InvoiceMilestone[]) => void
  onAutoAdvanceStage?: (stage: 'Won' | 'Paid', reason: string) => void
  onToast?: (message: string) => void
  settings?: WorkspaceSettings
}

export function DeliverablesTracker({
  dealTitle,
  dealValue,
  rawAmount,
  deliverables,
  invoices,
  onChangeDeliverables,
  onChangeInvoices,
  onAutoAdvanceStage,
  onToast,
  settings,
}: DeliverablesTrackerProps) {
  const [newTitle, setNewTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [copiedInvoiceId, setCopiedInvoiceId] = useState<string | null>(null)
  const [isAddingInvoice, setIsAddingInvoice] = useState(false)
  const [newInvoiceLabel, setNewInvoiceLabel] = useState('')
  const [newInvoiceAmount, setNewInvoiceAmount] = useState('')
  const [newInvoiceType, setNewInvoiceType] = useState<InvoiceMilestone['type']>('Deposit')

  // Deliverable calculations
  const totalDeliverables = deliverables.length
  const completedDeliverables = deliverables.filter((d) => d.status === 'Done').length
  const signedOffCount = deliverables.filter((d) => d.clientSignOff).length
  const progressPercent =
    totalDeliverables > 0 ? Math.round((completedDeliverables / totalDeliverables) * 100) : 0

  // Invoice calculations
  const totalBilled = invoices.reduce((acc, inv) => acc + inv.amount, 0)
  const totalPaid = invoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((acc, inv) => acc + inv.amount, 0)

  const handleToggleStatus = (id: string) => {
    const statusCycle: Record<DeliverableItem['status'], DeliverableItem['status']> = {
      Pending: 'In Progress',
      'In Progress': 'Done',
      Done: 'Pending',
    }

    const updated = deliverables.map((item) => {
      if (item.id === id) {
        const nextStatus = statusCycle[item.status]
        return {
          ...item,
          status: nextStatus,
          clientSignOff: nextStatus === 'Done' ? item.clientSignOff : false,
        }
      }
      return item
    })
    onChangeDeliverables(updated)

    // Check if this completed the project (all deliverables done + all invoices paid)
    const allDeliverablesDone = updated.length > 0 && updated.every((d) => d.status === 'Done')
    const allInvoicesPaid = invoices.length > 0 && invoices.every((i) => i.status === 'Paid')
    if (allDeliverablesDone && allInvoicesPaid && onAutoAdvanceStage) {
      onAutoAdvanceStage('Paid', 'All deliverables finished & 100% invoices collected! Project completed')
    }
  }

  const handleToggleSignOff = (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    const updated = deliverables.map((item) => {
      if (item.id === id) {
        return { ...item, clientSignOff: !item.clientSignOff }
      }
      return item
    })
    onChangeDeliverables(updated)
  }

  const handleAddDeliverable = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTitle.trim()) return

    const rand = Math.random().toString(36).substring(2, 7)
    const newItem: DeliverableItem = {
      id: `del-${Date.now()}-${rand}`,
      title: newTitle.trim(),
      status: 'Pending',
      clientSignOff: false,
    }
    onChangeDeliverables([...deliverables, newItem])
    setNewTitle('')
    setIsAdding(false)
  }

  const handleApplyTemplate = (type: 'web' | 'brand' | 'retainer') => {
    let templateItems: string[] = []
    if (type === 'web') {
      templateItems = [
        '1. UX Wireframes & Architecture Approval',
        '2. Interactive Prototype & Frontend Build',
        '3. CMS & Payment Gateway Integration',
        '4. Production Deployment & Domain Handover',
      ]
    } else if (type === 'brand') {
      templateItems = [
        '1. Brand Strategy & Moodboard Direction',
        '2. Logo Suite, Color Palette & Typography',
        '3. Brand Guidelines & Asset Handover',
      ]
    } else if (type === 'retainer') {
      templateItems = [
        '1. Monthly Sprint Planning & Scope Confirmation',
        '2. Priority Feature Delivery & Bug Fixes',
        '3. End-of-month Review & KPI Performance Report',
      ]
    }

    const newItems: DeliverableItem[] = templateItems.map((title, i) => ({
      id: `del-${Date.now()}-${i}`,
      title,
      status: 'Pending',
      clientSignOff: false,
    }))

    onChangeDeliverables([...deliverables, ...newItems])
    if (onToast) {
      onToast(`Applied ${type === 'web' ? 'Web Project' : type === 'brand' ? 'Design' : 'Retainer'} template (${templateItems.length} items)`)
    }
  }

  const handleCopyPaymentLink = (inv: InvoiceMilestone, e: React.MouseEvent) => {
    e.stopPropagation()
    const currency = settings?.currency || OPERATOR_CONFIG.currency
    const fallbackLink = `https://pay.fakturoid.cz/qr?amount=${inv.amount}&vs=${Date.now().toString().slice(-6)}&currency=${currency}`
    const link = inv.paymentLink || fallbackLink
    if (navigator.clipboard) {
      navigator.clipboard.writeText(link)
    }
    setCopiedInvoiceId(inv.id)
    if (onToast) {
      onToast(`Copied payment link for ${inv.label}`)
    }
    setTimeout(() => {
      setCopiedInvoiceId(null)
    }, 2000)
  }

  const handleToggleInvoicePaid = (id: string) => {
    let triggeredStage: 'Won' | 'Paid' | null = null
    let triggeredReason = ''

    const updated = invoices.map((inv) => {
      if (inv.id === id) {
        const isPaid = inv.status === 'Paid'
        const nextStatus = (isPaid ? 'Sent' : 'Paid') as InvoiceMilestone['status']
        if (nextStatus === 'Paid') {
          if (inv.type === 'Deposit') {
            triggeredStage = 'Won'
            triggeredReason = '50% Deposit Received! Project Kicked Off'
          }
        }
        return {
          ...inv,
          status: nextStatus,
          paidAt: isPaid ? undefined : 'Just now',
        }
      }
      return inv
    })

    const allInvoicesPaid = updated.length > 0 && updated.every((x) => x.status === 'Paid')
    const allDeliverablesDone =
      deliverables.length > 0 && deliverables.every((d) => d.status === 'Done')

    // Project is only completed/paid when ALL milestones are completed AND ALL invoices are paid!
    if (allInvoicesPaid && allDeliverablesDone) {
      triggeredStage = 'Paid'
      triggeredReason = 'All deliverables signed off & 100% invoices collected! Project completed'
    }

    onChangeInvoices(updated)
    if (triggeredStage && onAutoAdvanceStage) {
      onAutoAdvanceStage(triggeredStage, triggeredReason)
    }
  }

  const handleGenerate5050Invoices = () => {
    const rawVal = rawAmount || parseInt(dealValue.replace(/[^0-9]/g, '')) || 0
    const half = Math.round(rawVal * 0.5)
    const rest = rawVal - half
    const rand = Math.random().toString(36).substring(2, 7)

    const standardInvoices: InvoiceMilestone[] = [
      {
        id: `inv-deposit-${Date.now()}-${rand}`,
        type: 'Deposit',
        label: '50% Upfront Deposit Invoice',
        amount: half,
        formattedAmount: formatMoney(half, settings),
        percentage: 50,
        status: 'Sent',
        dueDate: 'Kickoff',
      },
      {
        id: `inv-final-${Date.now()}-${rand}`,
        type: 'Final',
        label: '50% Final Handover Invoice',
        amount: rest,
        formattedAmount: formatMoney(rest, settings),
        percentage: 50,
        status: 'Draft',
        dueDate: 'On Completion',
      },
    ]

    onChangeInvoices([...invoices, ...standardInvoices])
    if (onToast) {
      onToast('Generated 50% deposit and 50% final invoice milestones')
    }
  }

  const handleAddCustomInvoice = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newInvoiceLabel.trim()) return

    const numAmt = parseInt(newInvoiceAmount.replace(/[^0-9]/g, '')) || 0
    const rawVal = rawAmount || parseInt(dealValue.replace(/[^0-9]/g, '')) || 1
    const pct = rawVal > 0 ? Math.round((numAmt / rawVal) * 100) : 0
    const rand = Math.random().toString(36).substring(2, 7)

    const newInv: InvoiceMilestone = {
      id: `inv-custom-${Date.now()}-${rand}`,
      type: newInvoiceType,
      label: newInvoiceLabel.trim(),
      amount: numAmt,
      formattedAmount: formatMoney(numAmt, settings),
      percentage: pct,
      status: 'Sent',
      dueDate: newInvoiceType === 'Deposit' ? 'Kickoff' : 'Milestone Delivery',
    }

    onChangeInvoices([...invoices, newInv])
    setNewInvoiceLabel('')
    setNewInvoiceAmount('')
    setIsAddingInvoice(false)
    if (onToast) {
      onToast(`Added invoice: ${newInv.label}`)
    }
  }

  return (
    <div className="space-y-6">
      {/* 1. Deliverables & Scope Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
              Milestone Scope & Deliverables
            </span>
            <span className="text-[12px] font-semibold text-[#1c1d1f]">
              {completedDeliverables} of {totalDeliverables} completed ({progressPercent}%)
            </span>
          </div>

          <button
            type="button"
            onClick={() => setIsAdding(!isAdding)}
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#266df0] hover:text-[#1a55c2] cursor-pointer"
          >
            <Plus size={13} />
            <span>Add item</span>
          </button>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-[#f0f2f5] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-[#266df0] h-full transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Scope Templates Bar */}
        <div className="flex items-center gap-1.5 pt-1 overflow-x-auto pb-1 text-[10px]">
          <span className="text-[#8f99a8] font-medium flex items-center gap-1 shrink-0">
            <Sparkles size={11} className="text-[#266df0]" />
            Templates:
          </span>
          <button
            type="button"
            onClick={() => handleApplyTemplate('web')}
            className="px-2 py-0.5 rounded-[6px] bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#505967] hover:text-[#1c1d1f] font-medium transition-colors shrink-0 cursor-pointer"
          >
            + Web Build (4 milestones)
          </button>
          <button
            type="button"
            onClick={() => handleApplyTemplate('brand')}
            className="px-2 py-0.5 rounded-[6px] bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#505967] hover:text-[#1c1d1f] font-medium transition-colors shrink-0 cursor-pointer"
          >
            + Brand & Identity (3)
          </button>
          <button
            type="button"
            onClick={() => handleApplyTemplate('retainer')}
            className="px-2 py-0.5 rounded-[6px] bg-[#f0f2f5] hover:bg-[#e4e7ec] text-[#505967] hover:text-[#1c1d1f] font-medium transition-colors shrink-0 cursor-pointer"
          >
            + Monthly Retainer (3)
          </button>
        </div>

        {/* Deliverables List */}
        <div className="space-y-1.5">
          {deliverables.map((item) => (
            <div
              key={item.id}
              onClick={() => handleToggleStatus(item.id)}
              className="group flex items-center justify-between p-2.5 rounded-[9px] bg-[#fafbfc] hover:bg-[#f3f6fc] border border-[#edf0f3] hover:border-[#bad0fa] transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <button
                  type="button"
                  className="shrink-0 text-[#6f7988] group-hover:text-[#266df0]"
                  title={`Status: ${item.status}. Click to cycle.`}
                >
                  {item.status === 'Done' ? (
                    <CheckCircle2 size={16} className="text-[#3b9b6d]" />
                  ) : item.status === 'In Progress' ? (
                    <Clock size={16} className="text-[#266df0]" />
                  ) : (
                    <Circle size={16} className="text-[#b5bdc9]" />
                  )}
                </button>
                <span
                  className={`text-[12px] font-medium truncate ${
                    item.status === 'Done'
                      ? 'text-[#8f99a8] line-through'
                      : 'text-[#1c1d1f]'
                  }`}
                >
                  {item.title}
                </span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0 ml-2">
                <span
                  className={`px-1.5 py-0.5 text-[9px] font-mono font-semibold rounded-[5px] uppercase ${
                    item.status === 'Done'
                      ? 'bg-[#e7f6ee] text-[#166534]'
                      : item.status === 'In Progress'
                      ? 'bg-[#e9f0ff] text-[#1d4ed8]'
                      : 'bg-[#f0f2f5] text-[#374151]'
                  }`}
                >
                  {item.status}
                </span>

                {/* Client sign-off chip */}
                <button
                  type="button"
                  onClick={(e) => handleToggleSignOff(item.id, e)}
                  title="Client sign-off flag for downstream portal"
                  className={`px-1.5 py-0.5 rounded-[5px] text-[10px] flex items-center gap-1 border transition-colors ${
                    item.clientSignOff
                      ? 'bg-[#f0eaff] border-[#d8bbf8] text-[#6d28d9] font-semibold'
                      : 'bg-white border-[#e4e7ec] text-[#4b5563] hover:border-[#9ca3af]'
                  }`}
                >
                  <ShieldCheck size={11} />
                  <span>{item.clientSignOff ? 'Signed off' : 'Sign-off'}</span>
                </button>
              </div>
            </div>
          ))}

          {/* Add Deliverable Form */}
          {isAdding && (
            <form onSubmit={handleAddDeliverable} className="flex gap-2 pt-1">
              <input
                type="text"
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g. Design token documentation..."
                className="flex-1 px-3 py-1.5 text-[12px] border border-[#266df0] rounded-[8px] focus:outline-none focus:ring-1 focus:ring-[#266df0]"
              />
              <button
                type="submit"
                className="px-3 py-1 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px]"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => setIsAdding(false)}
                className="px-2 py-1 text-[11px] text-[#6f7988] hover:text-[#1c1d1f]"
              >
                Cancel
              </button>
            </form>
          )}
        </div>
      </div>

      {/* 2. Deposit & Milestone Invoices Section */}
      <div className="space-y-3 pt-4 border-t border-[#f0f1f3]">
        <div className="flex items-center justify-between">
          <div>
            <span className="block text-[10px] font-bold uppercase tracking-wider text-[#8f99a8]">
              Deposit & Commercial Invoices
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-[13px] font-bold font-mono text-[#1c1d1f]">
                {formatMoney(totalPaid, settings)} paid
              </span>
              <span className="text-[11px] text-[#8f99a8] font-mono">
                of {dealValue}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[6px] bg-[#f0f2f5] text-[#505967]">
              {Math.round((totalPaid / (rawAmount || 1)) * 100)}% collected
            </span>
            <button
              type="button"
              onClick={() => setIsAddingInvoice(!isAddingInvoice)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#266df0] hover:text-[#1a55c2] cursor-pointer"
            >
              <Plus size={13} />
              <span>Add invoice</span>
            </button>
          </div>
        </div>

        {/* Add Custom Invoice Form */}
        {isAddingInvoice && (
          <form onSubmit={handleAddCustomInvoice} className="p-3 bg-[#f8faff] border border-[#d6e3fc] rounded-[10px] space-y-2.5">
            <div className="text-[11px] font-semibold text-[#1c1d1f]">Add Invoice Milestone</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                autoFocus
                value={newInvoiceLabel}
                onChange={(e) => setNewInvoiceLabel(e.target.value)}
                placeholder="Invoice label (e.g. 50% Deposit)"
                className="px-2.5 py-1.5 text-[12px] border border-[#e4e7ec] rounded-[7px] bg-white focus:outline-none focus:border-[#266df0]"
              />
              <input
                type="text"
                value={newInvoiceAmount}
                onChange={(e) => setNewInvoiceAmount(e.target.value)}
                placeholder="Amount (e.g. 25000)"
                className="px-2.5 py-1.5 text-[12px] border border-[#e4e7ec] rounded-[7px] bg-white focus:outline-none focus:border-[#266df0]"
              />
              <select
                value={newInvoiceType}
                onChange={(e) => setNewInvoiceType(e.target.value as InvoiceMilestone['type'])}
                className="px-2.5 py-1.5 text-[12px] border border-[#e4e7ec] rounded-[7px] bg-white focus:outline-none text-[#505967]"
              >
                <option value="Deposit">Deposit</option>
                <option value="Progress">Progress</option>
                <option value="Final">Final Handover</option>
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsAddingInvoice(false)}
                className="px-2.5 py-1 text-[11px] text-[#6f7988] hover:text-[#1c1d1f] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newInvoiceLabel.trim()}
                className="px-3 py-1 bg-[#266df0] hover:bg-[#1a55c2] disabled:opacity-40 text-white text-[11px] font-semibold rounded-[7px] cursor-pointer"
              >
                Add Invoice
              </button>
            </div>
          </form>
        )}

        {/* Invoices List / Empty State */}
        {invoices.length === 0 ? (
          <div className="p-4 rounded-[10px] bg-[#fafbfc] border border-dashed border-[#d0d5dd] text-center space-y-2">
            <Receipt size={20} className="mx-auto text-[#8f99a8]" />
            <p className="text-[12px] font-medium text-[#1c1d1f]">No invoices tracked yet</p>
            <p className="text-[11px] text-[#6f7988]">Generate standard 50/50 milestones or create a custom billing schedule.</p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleGenerate5050Invoices}
                className="px-3 py-1.5 bg-[#266df0] hover:bg-[#1a55c2] text-white text-[11px] font-semibold rounded-[7px] cursor-pointer"
              >
                + Generate 50/50 Deposit & Final
              </button>
              <button
                type="button"
                onClick={() => setIsAddingInvoice(true)}
                className="px-3 py-1.5 bg-white border border-[#e4e7ec] hover:bg-[#f7f8fa] text-[#1c1d1f] text-[11px] font-medium rounded-[7px] cursor-pointer"
              >
                + Custom Invoice
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {invoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3 bg-[#fafbfc] border border-[#edf0f3] rounded-[10px] flex items-center justify-between gap-2"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-semibold text-[#1c1d1f] truncate">
                      {inv.label}
                    </span>
                    <span
                      className={`px-1.5 py-0.2 rounded-[5px] text-[9px] font-mono font-semibold uppercase ${
                        inv.status === 'Paid'
                          ? 'bg-[#e7f6ee] text-[#166534]'
                          : inv.status === 'Sent'
                          ? 'bg-[#e9f0ff] text-[#1d4ed8]'
                          : 'bg-[#f0f2f5] text-[#374151]'
                      }`}
                    >
                      {inv.status}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-[11px] text-[#6f7988]">
                    <span className="font-mono font-bold text-[#1c1d1f]">
                      {inv.formattedAmount}
                    </span>
                    {inv.dueDate && <span>Due: {inv.dueDate}</span>}
                    {inv.paidAt && <span className="text-[#3b9b6d]">Paid: {inv.paidAt}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => handleCopyPaymentLink(inv, e)}
                    title="Copy payment link / QR code URL"
                    className="p-1.5 rounded-[7px] text-[#6f7988] hover:text-[#1c1d1f] bg-white border border-[#e4e7ec] hover:border-[#cad0d9] transition-colors cursor-pointer"
                  >
                    {copiedInvoiceId === inv.id ? (
                      <Check size={13} className="text-[#3b9b6d]" />
                    ) : (
                      <Link2 size={13} />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleInvoicePaid(inv.id)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-[7px] border transition-all cursor-pointer ${
                      inv.status === 'Paid'
                        ? 'bg-[#f0f2f5] text-[#505967] border-[#dce0e8] hover:bg-[#e4e7ec]'
                        : 'bg-[#232529] text-white border-[#232529] hover:bg-[#101113] shadow-xs'
                    }`}
                  >
                    {inv.status === 'Paid' ? 'Mark Unpaid' : 'Mark as Paid'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
