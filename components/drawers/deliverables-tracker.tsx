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
} from 'lucide-react'
import { DeliverableItem, InvoiceMilestone } from '@/lib/crm-types'

interface DeliverablesTrackerProps {
  dealTitle: string
  dealValue: string
  rawAmount: number
  deliverables: DeliverableItem[]
  invoices: InvoiceMilestone[]
  onChangeDeliverables: (items: DeliverableItem[]) => void
  onChangeInvoices: (items: InvoiceMilestone[]) => void
}

export function DeliverablesTracker({
  dealTitle,
  dealValue,
  rawAmount,
  deliverables,
  invoices,
  onChangeDeliverables,
  onChangeInvoices,
}: DeliverablesTrackerProps) {
  const [newTitle, setNewTitle] = useState('')
  const [isAdding, setIsAdding] = useState(false)

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

    const newItem: DeliverableItem = {
      id: `del-${Date.now()}`,
      title: newTitle.trim(),
      status: 'Pending',
      clientSignOff: false,
    }
    onChangeDeliverables([...deliverables, newItem])
    setNewTitle('')
    setIsAdding(false)
  }

  const handleToggleInvoicePaid = (id: string) => {
    const updated = invoices.map((inv) => {
      if (inv.id === id) {
        const isPaid = inv.status === 'Paid'
        return {
          ...inv,
          status: (isPaid ? 'Sent' : 'Paid') as InvoiceMilestone['status'],
          paidAt: isPaid ? undefined : 'Just now',
        }
      }
      return inv
    })
    onChangeInvoices(updated)
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
                      ? 'bg-[#e7f6ee] text-[#3b9b6d]'
                      : item.status === 'In Progress'
                      ? 'bg-[#e9f0ff] text-[#266df0]'
                      : 'bg-[#f4f5f6] text-[#8f99a8]'
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
                      ? 'bg-[#f0eaff] border-[#d8bbf8] text-[#805ad5] font-semibold'
                      : 'bg-white border-[#e4e7ec] text-[#9fa1a7] hover:border-[#cad0d9]'
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
                {totalPaid.toLocaleString('cs-CZ').replace(/\s/g, ' ')} Kč paid
              </span>
              <span className="text-[11px] text-[#8f99a8] font-mono">
                of {dealValue}
              </span>
            </div>
          </div>
          <span className="px-2 py-0.5 text-[10px] font-mono font-semibold rounded-[6px] bg-[#f0f2f5] text-[#505967]">
            {Math.round((totalPaid / (rawAmount || 1)) * 100)}% collected
          </span>
        </div>

        {/* Invoices List */}
        <div className="space-y-2">
          {invoices.map((inv) => (
            <div
              key={inv.id}
              className="p-3 bg-[#fafbfc] border border-[#edf0f3] rounded-[10px] flex items-center justify-between"
            >
              <div className="space-y-0.5 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[12px] font-semibold text-[#1c1d1f] truncate">
                    {inv.label}
                  </span>
                  <span
                    className={`px-1.5 py-0.2 rounded-[5px] text-[9px] font-mono font-semibold uppercase ${
                      inv.status === 'Paid'
                        ? 'bg-[#e7f6ee] text-[#3b9b6d]'
                        : inv.status === 'Sent'
                        ? 'bg-[#e9f0ff] text-[#266df0]'
                        : 'bg-[#f4f5f6] text-[#8f99a8]'
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
          ))}
        </div>
      </div>
    </div>
  )
}
