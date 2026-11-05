'use client'

import { formatDue, isOverdue } from '@/lib/due-date'
import React, { useMemo, useState } from 'react'
import { Search, CirclePlus, ExternalLink, Edit3, Trash2, Clock, WalletCards } from 'lucide-react'
import { Deal, DealStage, DEAL_STAGES, WorkspaceSettings } from '@/lib/crm-types'
import { RowActionMenu } from '@/components/ui/row-action-menu'
import { formatDealValue } from '@/lib/config'

interface DealListProps {
  deals: Deal[]
  onOpenDeal: (deal: Deal) => void
  onAddDealClick: () => void
  onMoveDealStage: (dealId: string, newStage: DealStage) => void
  onDeleteDeal?: (dealId: string) => void
  onEditDeal?: (deal: Deal) => void
  settings?: WorkspaceSettings
}

type StageFilter = 'All' | DealStage

const stageRank = (stage: DealStage) => {
  const i = DEAL_STAGES.indexOf(stage)
  return i === -1 ? DEAL_STAGES.length : i
}

/** Deals as a single list. Stage is a field you filter by and change per row. */
export function DealList({
  deals,
  onOpenDeal,
  onAddDealClick,
  onMoveDealStage,
  onDeleteDeal,
  onEditDeal,
  settings,
}: DealListProps) {
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<StageFilter>('All')

  const countByStage = useMemo(() => {
    const counts = new Map<DealStage, number>()
    for (const d of deals) counts.set(d.stage, (counts.get(d.stage) || 0) + 1)
    return counts
  }, [deals])

  const visibleDeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals
      .filter((d) => stageFilter === 'All' || d.stage === stageFilter)
      .filter(
        (d) =>
          !q ||
          d.title.toLowerCase().includes(q) ||
          d.contactName.toLowerCase().includes(q) ||
          (d.next || '').toLowerCase().includes(q)
      )
      // Stable sort: pipeline order, newest first within a stage (input is newest first)
      .map((d, i) => ({ d, i }))
      .sort((a, b) => stageRank(a.d.stage) - stageRank(b.d.stage) || a.i - b.i)
      .map(({ d }) => d)
  }, [deals, query, stageFilter])

  const filters: { key: StageFilter; label: string; count: number }[] = [
    { key: 'All', label: 'All', count: deals.length },
    ...DEAL_STAGES.map((s) => ({ key: s as StageFilter, label: s, count: countByStage.get(s) || 0 })),
  ]

  return (
    <section className="panel deals-list-panel">
      <div className="deals-list-toolbar">
        <label className="search-field">
          <Search size={15} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals" />
        </label>
        {/* With no deals, the empty state's "Add first deal" is the only add button */}
        {deals.length > 0 && (
          <button type="button" className="primary-button" onClick={onAddDealClick}>
            <CirclePlus size={16} />
            <span>New deal</span>
            <kbd className="ml-1 px-1 bg-[#3a3e45] text-white rounded text-[10px] font-mono">N</kbd>
          </button>
        )}
      </div>

      <div className="tabs deals-stage-filter" role="tablist" aria-label="Filter by stage">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            role="tab"
            aria-selected={stageFilter === f.key}
            className={stageFilter === f.key ? 'tab-active' : ''}
            onClick={() => setStageFilter(f.key)}
          >
            {f.label} <span className="text-[#8f99a8] font-mono">{f.count}</span>
          </button>
        ))}
      </div>

      <div className="deals-list">
        <div className="deals-list-head">
          <span>Deal</span>
          <span>Stage</span>
          <span>Value</span>
          <span>Next action</span>
          <span />
        </div>

        {deals.length === 0 ? (
          <div className="py-12 px-4 text-center">
            <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
              <WalletCards size={18} />
            </div>
            <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No deals yet</h3>
            <p className="text-[11px] text-[#8f99a8] mb-3">Add a deal for one of your clients.</p>
            <button
              type="button"
              onClick={onAddDealClick}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] cursor-pointer"
            >
              <CirclePlus size={13} />
              <span>Add first deal</span>
            </button>
          </div>
        ) : visibleDeals.length === 0 ? (
          <div className="py-8 text-center text-[#8f99a8] text-[12px]">No deals match this filter.</div>
        ) : (
          visibleDeals.map((deal) => (
            <div
              key={deal.id}
              className="deals-list-row"
              role="button"
              tabIndex={0}
              aria-label={`Open ${deal.title}`}
              onClick={() => onOpenDeal(deal)}
              onKeyDown={(e) => {
                if (e.target !== e.currentTarget) return
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onOpenDeal(deal)
                }
              }}
            >
              <div className="deal-title min-w-0">
                <span className={`deal-avatar shrink-0 ${deal.color}`}>{deal.contactName.charAt(0)}</span>
                <div className="min-w-0">
                  <strong className="truncate block" title={deal.title}>
                    {deal.title}
                  </strong>
                  <span className="truncate block" title={deal.contactName}>
                    {deal.contactName}
                  </span>
                </div>
              </div>

              <div onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <select
                  aria-label={`Stage for ${deal.title}`}
                  value={deal.stage}
                  onChange={(e) => onMoveDealStage(deal.id, e.target.value as DealStage)}
                  className="stage-select"
                >
                  {DEAL_STAGES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <strong className="font-mono tabular-nums">{formatDealValue(deal.value, settings)}</strong>

              <div className="deals-list-next min-w-0">
                {deal.stage === 'Paid' || !deal.next ? (
                  <span className="text-[#8f99a8]">—</span>
                ) : (
                  <>
                    <span className="truncate block text-[#1c1d1f]" title={deal.next}>
                      {deal.next}
                    </span>
                    {deal.nextDueDate && (
                      <span
                        className={`flex items-center gap-1 text-[11px] ${
                          isOverdue(deal.nextDueDate) ? 'text-[#d92d20] font-semibold' : 'text-[#8f99a8]'
                        }`}
                      >
                        <Clock size={11} />
                        <span className="truncate">{formatDue(deal.nextDueDate)}</span>
                      </span>
                    )}
                  </>
                )}
              </div>

              <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                <RowActionMenu
                  triggerLabel={`Options for ${deal.title}`}
                  items={[
                    { label: 'Open deal', icon: ExternalLink, onClick: () => onOpenDeal(deal) },
                    {
                      label: 'Edit deal',
                      icon: Edit3,
                      onClick: () => (onEditDeal ? onEditDeal(deal) : onOpenDeal(deal)),
                    },
                    ...(onDeleteDeal
                      ? [
                          {
                            label: 'Delete deal',
                            icon: Trash2,
                            destructive: true,
                            divider: true,
                            onClick: () => onDeleteDeal(deal.id),
                          },
                        ]
                      : []),
                  ]}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  )
}
