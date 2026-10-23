'use client'

import React from 'react'
import {
  CheckCircle2,
  Circle,
  Clock,
  Receipt,
  FileCheck,
  AlertCircle,
  Calendar,
} from 'lucide-react'
import { DeliverableItem, InvoiceMilestone, WorkspaceSettings } from '@/lib/crm-types'
import { formatMoney, OPERATOR_CONFIG } from '@/lib/config'

interface DeliverablesTrackerProps {
  dealTitle: string
  dealValue: string
  rawAmount: number
  deliverables: DeliverableItem[]
  invoices: InvoiceMilestone[]
  onChangeDeliverables?: (items: DeliverableItem[]) => void
  onChangeInvoices?: (items: InvoiceMilestone[]) => void
  onAutoAdvanceStage?: (stage: any, reason: string) => void
  onToast?: (message: string) => void
  settings?: WorkspaceSettings
}

export function DeliverablesTracker({
  dealTitle,
  dealValue,
  rawAmount,
  deliverables = [],
  invoices = [],
  settings,
}: DeliverablesTrackerProps) {
  const fallback = settings || OPERATOR_CONFIG

  const totalDel = deliverables.length
  const completedDel = deliverables.filter((d) => d.status === 'Done').length
  const delPercent = totalDel > 0 ? Math.round((completedDel / totalDel) * 100) : 0

  const totalInvAmt = invoices.reduce((sum, i) => sum + (Number(i.amount) || 0), 0)
  const paidInvAmt = invoices
    .filter((inv) => String(inv.status).toLowerCase() === 'paid')
    .reduce((sum, inv) => sum + (Number(inv.amount) || 0), 0)
  const paidPercent = totalInvAmt > 0 ? Math.round((paidInvAmt / totalInvAmt) * 100) : 0

  return (
    <div className="space-y-6">
      {/* Read-only Migration Banner */}
      <div className="p-3.5 bg-[#fff8eb] border border-[#fedf89] rounded-[10px] text-[12px] text-[#b54708] flex items-center gap-2">
        <AlertCircle size={15} className="shrink-0 text-[#f79009]" />
        <span className="font-medium">
          Scope and invoices are moving to Projects. This view is read-only.
        </span>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-3.5 bg-[#f8faff] border border-[#dce8fc] rounded-[10px]">
          <div className="flex items-center justify-between text-[11px] text-[#6f7988]">
            <span className="font-semibold uppercase tracking-wider text-[#266df0]">
              Deliverables Progress
            </span>
            <span className="font-mono font-medium text-[#1c1d1f]">
              {completedDel} / {totalDel} ({delPercent}%)
            </span>
          </div>
          <div className="w-full bg-[#e9f0ff] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#266df0] h-full transition-all duration-300"
              style={{ width: `${delPercent}%` }}
            />
          </div>
        </div>

        <div className="p-3.5 bg-[#f8fbf9] border border-[#d1fadf] rounded-[10px]">
          <div className="flex items-center justify-between text-[11px] text-[#6f7988]">
            <span className="font-semibold uppercase tracking-wider text-[#059669]">
              Collected Revenue
            </span>
            <span className="font-mono font-medium text-[#1c1d1f]">
              {formatMoney(paidInvAmt, fallback)} / {formatMoney(totalInvAmt || rawAmount, fallback)} ({paidPercent}%)
            </span>
          </div>
          <div className="w-full bg-[#d1fadf] h-1.5 rounded-full overflow-hidden mt-2">
            <div
              className="bg-[#10b981] h-full transition-all duration-300"
              style={{ width: `${paidPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Deliverables List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#1c1d1f] flex items-center gap-1.5">
            <FileCheck size={14} className="text-[#266df0]" />
            <span>Milestone Deliverables</span>
          </h4>
        </div>

        {deliverables.length === 0 ? (
          <p className="text-[12px] text-[#6f7988] italic py-2">No deliverables recorded.</p>
        ) : (
          <div className="divide-y divide-[#f0f1f3] border border-[#e9ebef] rounded-[10px] overflow-hidden bg-white">
            {deliverables.map((item, idx) => {
              const isDone = item.status === 'Done'
              return (
                <div key={item.id || idx} className="p-3 flex items-center justify-between gap-3 text-[12px]">
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isDone ? (
                      <CheckCircle2 size={16} className="text-[#10b981] shrink-0" />
                    ) : (
                      <Circle size={16} className="text-[#98a2b3] shrink-0" />
                    )}
                    <span className={`truncate font-medium ${isDone ? 'line-through text-[#6f7988]' : 'text-[#1c1d1f]'}`}>
                      {item.title}
                    </span>
                  </div>
                  {item.dueDate && (
                    <span className="text-[11px] font-mono text-[#6f7988] shrink-0 flex items-center gap-1">
                      <Calendar size={12} />
                      {item.dueDate}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invoices List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-[12px] font-bold uppercase tracking-wider text-[#1c1d1f] flex items-center gap-1.5">
            <Receipt size={14} className="text-[#059669]" />
            <span>Invoices & Milestones</span>
          </h4>
        </div>

        {invoices.length === 0 ? (
          <p className="text-[12px] text-[#6f7988] italic py-2">No invoices recorded.</p>
        ) : (
          <div className="divide-y divide-[#f0f1f3] border border-[#e9ebef] rounded-[10px] overflow-hidden bg-white">
            {invoices.map((inv, idx) => {
              const isPaid = String(inv.status).toLowerCase() === 'paid'
              return (
                <div key={inv.id || idx} className="p-3 flex items-center justify-between gap-3 text-[12px]">
                  <div className="min-w-0">
                    <div className="font-medium text-[#1c1d1f] truncate">{inv.label}</div>
                    <div className="text-[11px] text-[#6f7988] font-mono">
                      {formatMoney(inv.amount, fallback)}
                      {inv.dueDate ? ` • Due: ${inv.dueDate}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-medium ${
                      isPaid
                        ? 'bg-[#eaf8f0] text-[#1f7a47] border border-[#b8eccb]'
                        : 'bg-[#f0f2f5] text-[#475467] border border-[#d0d5dd]'
                    }`}
                  >
                    {inv.status}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
