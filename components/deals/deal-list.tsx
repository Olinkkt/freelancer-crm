'use client'

import { formatDue, isOverdue } from '@/lib/due-date'
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Search, CirclePlus, ExternalLink, Edit3, Trash2, Clock, WalletCards, FileText, ArrowRight, Check } from 'lucide-react'
import { Deal, DealStage, DEAL_STAGES, DEAL_STAGE_HINTS, OPEN_DEAL_STAGES, PM_STAGES, isPmStage, nextDealStage, WorkspaceSettings } from '@/lib/crm-types'
import { RowActionMenu } from '@/components/ui/row-action-menu'
import { formatDealValue } from '@/lib/config'

interface DealListProps {
  deals: Deal[]
  onOpenDeal: (deal: Deal) => void
  onAddDealClick: () => void
  onMoveDealStage: (dealId: string, newStage: DealStage) => void
  onDeleteDeal?: (dealId: string) => void
  onEditDeal?: (deal: Deal) => void
  /** Open this deal's notes (⌘K scratchpad) */
  onOpenNotes?: (deal: Deal) => void
  settings?: WorkspaceSettings
}

/** Deals is the CRM list: one tab per open stage, and every signed deal under "In PM" */
type StageFilter = 'All' | 'PM' | DealStage

const FILTER_HINTS: Partial<Record<StageFilter, string>> = {
  ...DEAL_STAGE_HINTS,
  PM: `Contract signed: ${PM_STAGES.join(' · ')}`,
}

const stageRank = (stage: DealStage) => {
  const i = DEAL_STAGES.indexOf(stage)
  return i === -1 ? DEAL_STAGES.length : i
}

/** Deals as a single list. Stage is a field you filter by; change it from the row menu. */
export function DealList({
  deals,
  onOpenDeal,
  onAddDealClick,
  onMoveDealStage,
  onDeleteDeal,
  onEditDeal,
  onOpenNotes,
  settings,
}: DealListProps) {
  const [query, setQuery] = useState('')
  const [stageFilter, setStageFilter] = useState<StageFilter>('All')
  // Only fade rows after a tab click, not when the view first mounts
  const [filterTouched, setFilterTouched] = useState(false)
  const tabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null)

  const countByStage = useMemo(() => {
    const counts = new Map<DealStage, number>()
    for (const d of deals) counts.set(d.stage, (counts.get(d.stage) || 0) + 1)
    return counts
  }, [deals])

  const visibleDeals = useMemo(() => {
    const q = query.trim().toLowerCase()
    return deals
      .filter((d) => stageFilter === 'All' || (stageFilter === 'PM' ? isPmStage(d.stage) : d.stage === stageFilter))
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
    ...OPEN_DEAL_STAGES.map((s) => ({ key: s as StageFilter, label: s, count: countByStage.get(s) || 0 })),
    { key: 'PM', label: 'In PM', count: PM_STAGES.reduce((n, s) => n + (countByStage.get(s) || 0), 0) },
  ]

  // Slide the underline to the active tab (re-measured each render; counts change tab widths)
  useLayoutEffect(() => {
    const el = tabRefs.current[stageFilter]
    if (!el) return
    const next = { x: el.offsetLeft, w: el.offsetWidth }
    setIndicator((prev) => (prev && prev.x === next.x && prev.w === next.w ? prev : next))
  })

  return (
    <section className="panel deals-list-panel">
      <div className="company-toolbar">
        <div>
          <p className="section-kicker">Deals directory</p>
          <h2>All deals</h2>
        </div>
        <div className="company-tools">
          <label className="search-field">
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search deals" />
          </label>
        </div>
      </div>

      <div className="tabs deals-stage-filter" role="tablist" aria-label="Filter by stage">
        {indicator && (
          <span
            className="tab-indicator"
            aria-hidden
            style={{ transform: `translateX(${indicator.x}px)`, width: indicator.w }}
          />
        )}
        {filters.map((f) => (
          <button
            key={f.key}
            ref={(el) => {
              tabRefs.current[f.key] = el
            }}
            type="button"
            role="tab"
            aria-selected={stageFilter === f.key}
            className={stageFilter === f.key ? 'tab-active' : ''}
            onClick={() => {
              setStageFilter(f.key)
              setFilterTouched(true)
            }}
            title={FILTER_HINTS[f.key]}
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
          <div className="deals-list-empty">
            {query.trim() || stageFilter === 'All'
              ? 'No deals match this filter.'
              : stageFilter === 'PM'
                ? 'No signed deals yet. A deal moves to PM once it is Closed (contract signed).'
                : `No deals in ${stageFilter}.`}
          </div>
        ) : (
          <div key={stageFilter} className={filterTouched ? 'deals-list-body' : undefined}>
          {visibleDeals.map((deal) => (
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
                  <div className="flex items-center gap-1.5 min-w-0">
                    <strong className="truncate block" title={deal.title}>
                      {deal.title}
                    </strong>
                  </div>
                  <span className="truncate block" title={deal.contactName}>
                    {deal.contactName}
                  </span>
                </div>
              </div>

              <span className="font-medium text-[#1c1d1f]">{deal.stage}</span>

              <span className="cell-num">{formatDealValue(deal.value, settings)}</span>

              <div className="deals-list-next min-w-0">
                {!deal.next ? (
                  <span className="text-[#8f99a8]">—</span>
                ) : (
                  <>
                    <span className="truncate block text-[#1c1d1f]" title={deal.next}>
                      {deal.next}
                    </span>
                    {deal.nextDueDate && !deal.waiting && (
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
                    ...(onOpenNotes ? [{ label: 'Notes', icon: FileText, onClick: () => onOpenNotes(deal) }] : []),
                    { label: 'Open deal', icon: ExternalLink, onClick: () => onOpenDeal(deal) },
                    ...(nextDealStage(deal.stage)
                      ? [
                          {
                            label: nextDealStage(deal.stage) === 'Completed' ? 'Complete project' : `Move to ${nextDealStage(deal.stage)}`,
                            icon: nextDealStage(deal.stage) === 'Completed' ? Check : ArrowRight,
                            onClick: () => onMoveDealStage(deal.id, nextDealStage(deal.stage)!),
                          },
                        ]
                      : []),
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
          ))}
          </div>
        )}
      </div>
    </section>
  )
}
