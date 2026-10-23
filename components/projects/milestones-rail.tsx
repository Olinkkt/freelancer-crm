'use client'

import React, { useState, useMemo } from 'react'
import {
  Check,
  CheckCircle2,
  Clock,
  Plus,
  DollarSign,
  FileText,
  Activity as ActivityIcon,
  ChevronRight,
  MoreVertical,
  Calendar,
} from 'lucide-react'
import type { Milestone, Invoice, Project, ProjectMoney, ProjectDetail } from '@/lib/projects/types'
import { InvoiceRow } from './invoice-row'
import { formatMinor } from '@/lib/projects/money'
import { formatRelativeDate, localToday } from '@/lib/projects/dates'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'
import { OPERATOR_CONFIG } from '@/lib/config'

interface MilestonesRailProps {
  project: Project
  milestones: Milestone[]
  invoices: Invoice[]
  money: ProjectMoney
  activities: any[]
  isRailFocused: boolean
  isReadOnly?: boolean
  onFocusRail: () => void
  onOpenInvoiceSheet: (invoice?: Invoice) => void
  onOpenNewMilestone: () => void
  onOpenBrief: () => void
  onSetMilestoneStatus: (id: string, status: 'open' | 'delivered' | 'approved') => void
  onSetInvoiceStatus: (id: string, status: 'draft' | 'sent' | 'paid' | 'void') => void
  onDeleteMilestone: (id: string) => void
  onDeleteInvoice: (id: string) => void
  onEditMilestone: (milestone: Milestone) => void
}

export function MilestonesRail({
  project,
  milestones,
  invoices,
  money,
  activities,
  isRailFocused,
  isReadOnly = false,
  onFocusRail,
  onOpenInvoiceSheet,
  onOpenNewMilestone,
  onOpenBrief,
  onSetMilestoneStatus,
  onSetInvoiceStatus,
  onDeleteMilestone,
  onDeleteInvoice,
  onEditMilestone,
}: MilestonesRailProps) {
  const [selectedRailType, setSelectedRailType] = useState<'milestone' | 'invoice'>('milestone')
  const [selectedRailId, setSelectedRailId] = useState<string | null>(null)
  const today = localToday()

  // Sorted items
  const sortedMilestones = useMemo(
    () => [...milestones].sort((a, b) => a.position - b.position),
    [milestones]
  )
  const sortedInvoices = useMemo(
    () => [...invoices].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    [invoices]
  )

  // Rail navigation shortcuts (active when isRailFocused)
  const allRailItems = useMemo(() => {
    return [
      ...sortedMilestones.map((m) => ({ type: 'milestone' as const, id: m.id, item: m })),
      ...sortedInvoices.map((inv) => ({ type: 'invoice' as const, id: inv.id, item: inv })),
    ]
  }, [sortedMilestones, sortedInvoices])

  const currentIndex = allRailItems.findIndex(
    (x) => x.type === selectedRailType && x.id === selectedRailId
  )

  const selectNext = () => {
    if (allRailItems.length === 0) return
    if (currentIndex === -1 || currentIndex >= allRailItems.length - 1) {
      setSelectedRailType(allRailItems[0].type)
      setSelectedRailId(allRailItems[0].id)
    } else {
      setSelectedRailType(allRailItems[currentIndex + 1].type)
      setSelectedRailId(allRailItems[currentIndex + 1].id)
    }
  }

  const selectPrev = () => {
    if (allRailItems.length === 0) return
    if (currentIndex <= 0) {
      setSelectedRailType(allRailItems[allRailItems.length - 1].type)
      setSelectedRailId(allRailItems[allRailItems.length - 1].id)
    } else {
      setSelectedRailType(allRailItems[currentIndex - 1].type)
      setSelectedRailId(allRailItems[currentIndex - 1].id)
    }
  }

  // Keyboard bindings
  useShortcut('rail.down', selectNext, { enabled: isRailFocused })
  useShortcut('rail.up', selectPrev, { enabled: isRailFocused })

  useShortcut(
    'rail.deliver',
    () => {
      if (!isReadOnly && selectedRailType === 'milestone' && selectedRailId) {
        onSetMilestoneStatus(selectedRailId, 'delivered')
      }
    },
    { enabled: isRailFocused && !isReadOnly && selectedRailType === 'milestone' }
  )

  useShortcut(
    'rail.approve',
    () => {
      if (!isReadOnly && selectedRailType === 'milestone' && selectedRailId) {
        onSetMilestoneStatus(selectedRailId, 'approved')
      }
    },
    { enabled: isRailFocused && !isReadOnly && selectedRailType === 'milestone' }
  )

  useShortcut(
    'rail.markSent',
    () => {
      if (!isReadOnly && selectedRailType === 'invoice' && selectedRailId) {
        onSetInvoiceStatus(selectedRailId, 'sent')
      }
    },
    { enabled: isRailFocused && !isReadOnly && selectedRailType === 'invoice' }
  )

  useShortcut(
    'rail.markPaid',
    () => {
      if (!isReadOnly && selectedRailType === 'invoice' && selectedRailId) {
        onSetInvoiceStatus(selectedRailId, 'paid')
      }
    },
    { enabled: isRailFocused && !isReadOnly && selectedRailType === 'invoice' }
  )

  useShortcut(
    'rail.void',
    () => {
      if (!isReadOnly && selectedRailType === 'invoice' && selectedRailId) {
        onSetInvoiceStatus(selectedRailId, 'void')
      }
    },
    { enabled: isRailFocused && !isReadOnly && selectedRailType === 'invoice' }
  )

  useShortcut(
    'rail.edit',
    () => {
      if (selectedRailType === 'milestone' && selectedRailId) {
        const m = sortedMilestones.find((x) => x.id === selectedRailId)
        if (m) onEditMilestone(m)
      } else if (selectedRailType === 'invoice' && selectedRailId) {
        const inv = sortedInvoices.find((x) => x.id === selectedRailId)
        if (inv) onOpenInvoiceSheet(inv)
      }
    },
    { enabled: isRailFocused }
  )

  useShortcut(
    'rail.delete',
    () => {
      if (!isReadOnly && selectedRailType === 'milestone' && selectedRailId) {
        onDeleteMilestone(selectedRailId)
      } else if (!isReadOnly && selectedRailType === 'invoice' && selectedRailId) {
        onDeleteInvoice(selectedRailId)
      }
    },
    { enabled: isRailFocused && !isReadOnly }
  )

  useShortcut('project.newInvoice', () => onOpenInvoiceSheet(), { enabled: !isReadOnly })
  useShortcut('project.newMilestone', onOpenNewMilestone, { enabled: !isReadOnly })
  useShortcut('project.focusBrief', onOpenBrief, { enabled: true })

  // Percentage calculations
  const budget = money.budgetMinor || 0
  const invoicedPct = budget > 0 ? Math.round((money.invoicedMinor / budget) * 100) : null
  const paidPct = budget > 0 ? Math.round((money.paidMinor / budget) * 100) : null

  return (
    <div
      onClick={onFocusRail}
      className={`p-4 rounded-xl bg-white dark:bg-slate-800/80 border transition-all text-xs space-y-6 ${
        isRailFocused
          ? 'border-blue-400 dark:border-blue-600/80 shadow-md ring-1 ring-blue-500/30'
          : 'border-slate-200 dark:border-slate-700/80 shadow-sm'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-700/60">
        <div className="flex items-center gap-2">
          <h2 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
            Milestones & Money
          </h2>
          {isRailFocused && (
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
          )}
        </div>
        <kbd className="px-1 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-500">
          G R
        </kbd>
      </div>

      {/* Milestones List */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>MILESTONES</span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={onOpenNewMilestone}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              title="Add milestone (Shift+M)"
            >
              <Plus size={11} />
              <span>Add</span>
            </button>
          )}
        </div>

        <div className="space-y-1">
          {sortedMilestones.map((m) => {
            const isSelected =
              isRailFocused && selectedRailType === 'milestone' && selectedRailId === m.id
            const isApproved = m.status === 'approved'
            const isDelivered = m.status === 'delivered'

            return (
              <div
                key={m.id}
                onClick={(e) => {
                  e.stopPropagation()
                  setSelectedRailType('milestone')
                  setSelectedRailId(m.id)
                }}
                onDoubleClick={() => onEditMilestone(m)}
                className={`group flex items-center justify-between p-2 rounded-lg transition-colors cursor-pointer select-none ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/50'
                    : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <span className="shrink-0">
                    {isApproved ? (
                      <Check size={13} className="text-emerald-500" />
                    ) : isDelivered ? (
                      <span className="text-blue-500 text-xs">●</span>
                    ) : (
                      <span className="text-slate-300 dark:text-slate-600 text-xs">○</span>
                    )}
                  </span>
                  <span
                    className={`truncate font-medium ${
                      isApproved
                        ? 'text-slate-500 dark:text-slate-400'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    {m.title}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0 text-[11px]">
                  {m.dueDate && (
                    <span className="text-slate-400">
                      {formatRelativeDate(m.dueDate, today)}
                    </span>
                  )}
                  <span
                    className={`capitalize font-medium ${
                      isApproved
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : isDelivered
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-slate-400'
                    }`}
                  >
                    {m.status}
                  </span>
                </div>
              </div>
            )
          })}

          {sortedMilestones.length === 0 && (
            <div className="py-2 text-slate-400 dark:text-slate-500 italic text-[11px]">
              No milestones yet
            </div>
          )}
        </div>
      </div>

      {/* Money & Invoices Section */}
      <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-750">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
          <span>FINANCES</span>
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => onOpenInvoiceSheet()}
              className="text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-0.5"
              title="Add invoice (I)"
            >
              <Plus size={11} />
              <span>Invoice</span>
              <kbd className="px-1 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 rounded ml-0.5">
                I
              </kbd>
            </button>
          )}
        </div>

        {/* Money Summary Table */}
        <div className="space-y-1.5 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-700/60 text-xs">
          {money.budgetMinor !== null && (
            <div className="flex justify-between text-slate-600 dark:text-slate-300">
              <span>Budget</span>
              <span className="font-mono font-medium">
                {formatMinor(money.budgetMinor, project.currency, {
                  currency: project.currency,
                  currencySymbol: project.currency === 'EUR' ? '€' : '$',
                  locale: OPERATOR_CONFIG.locale || 'en-US',
                })}
              </span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Invoiced</span>
            <span className="font-mono font-medium">
              {formatMinor(money.invoicedMinor, project.currency, {
                currency: project.currency,
                currencySymbol: project.currency === 'EUR' ? '€' : '$',
                locale: OPERATOR_CONFIG.locale || 'en-US',
              })}
              {invoicedPct !== null && (
                <span className="text-[10px] text-slate-400 ml-1">({invoicedPct}%)</span>
              )}
            </span>
          </div>
          <div className="flex justify-between text-slate-600 dark:text-slate-300">
            <span>Paid</span>
            <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
              {formatMinor(money.paidMinor, project.currency, {
                currency: project.currency,
                currencySymbol: project.currency === 'EUR' ? '€' : '$',
                locale: OPERATOR_CONFIG.locale || 'en-US',
              })}
              {paidPct !== null && (
                <span className="text-[10px] text-slate-400 ml-1">({paidPct}%)</span>
              )}
            </span>
          </div>
        </div>

        {/* Invoices List */}
        <div className="space-y-1">
          {sortedInvoices.map((inv) => (
            <InvoiceRow
              key={inv.id}
              invoice={inv}
              isSelected={
                isRailFocused && selectedRailType === 'invoice' && selectedRailId === inv.id
              }
              isReadOnly={isReadOnly}
              onSelect={() => {
                setSelectedRailType('invoice')
                setSelectedRailId(inv.id)
              }}
              onEdit={() => onOpenInvoiceSheet(inv)}
              onMarkSent={() => onSetInvoiceStatus(inv.id, 'sent')}
              onMarkPaid={() => onSetInvoiceStatus(inv.id, 'paid')}
              onVoid={() => onSetInvoiceStatus(inv.id, 'void')}
              onDelete={() => onDeleteInvoice(inv.id)}
            />
          ))}

          {sortedInvoices.length === 0 && (
            <div className="py-2 text-slate-400 dark:text-slate-500 italic text-[11px]">
              No invoices yet
            </div>
          )}
        </div>
      </div>

      {/* Brief Link */}
      <div className="pt-2 border-t border-slate-100 dark:border-slate-750">
        <button
          type="button"
          onClick={onOpenBrief}
          className="w-full flex items-center justify-between p-2 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-slate-800/40 dark:hover:bg-slate-800 transition-colors text-slate-700 dark:text-slate-200"
        >
          <div className="flex items-center gap-2">
            <FileText size={13} className="text-blue-500" />
            <span className="font-semibold text-xs">Project Brief</span>
          </div>
          <div className="flex items-center gap-1.5">
            <kbd className="px-1 text-[9px] font-mono bg-white dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 text-slate-500">
              G B
            </kbd>
            <ChevronRight size={13} className="text-slate-400" />
          </div>
        </button>
      </div>

      {/* Activity Preview */}
      {activities && activities.length > 0 && (
        <div className="pt-2 border-t border-slate-100 dark:border-slate-750 space-y-1.5">
          <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            <span>RECENT ACTIVITY</span>
            <ActivityIcon size={11} />
          </div>
          <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/30 border border-slate-100 dark:border-slate-700/50 space-y-1 text-[11px]">
            <div className="font-medium text-slate-700 dark:text-slate-300 truncate">
              {activities[0].title || activities[0].type}
            </div>
            <div className="text-[10px] text-slate-400 flex items-center justify-between">
              <span>{activities[0].type}</span>
              <span>{activities[0].date || activities[0].createdAt?.slice(0, 10)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
