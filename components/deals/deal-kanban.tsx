'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Kanban,
  TableProperties,
  CirclePlus,
  MoreHorizontal,
  ArrowRight,
  ArrowLeft,
  ChevronDown,
  Search,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  Command,
  WalletCards,
} from 'lucide-react'
import { Deal, DealStage } from '@/lib/crm-types'

interface DealKanbanProps {
  deals: Deal[]
  onOpenDeal: (deal: Deal) => void
  onAddDealClick: () => void
  onMoveDealStage: (dealId: string, newStage: DealStage) => void
}

const STAGES: DealStage[] = ['Lead', 'Qualified', 'Scope', 'Quote sent', 'Negotiation', 'Won']

export function DealKanban({
  deals,
  onOpenDeal,
  onAddDealClick,
  onMoveDealStage,
}: DealKanbanProps) {
  const [viewMode, setViewMode] = useState<'kanban' | 'table'>('kanban')
  const [focusedColIndex, setFocusedColIndex] = useState<number>(0)
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(0)
  const [isBoardFocused, setIsBoardFocused] = useState<boolean>(false)
  const [searchFilter, setSearchFilter] = useState<string>('')
  const boardRef = useRef<HTMLDivElement>(null)

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      Lead: [],
      Qualified: [],
      Scope: [],
      'Quote sent': [],
      Negotiation: [],
      Won: [],
    }

    const filtered = searchFilter
      ? deals.filter(
          (d) =>
            d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
            d.company.toLowerCase().includes(searchFilter.toLowerCase())
        )
      : deals

    filtered.forEach((d) => {
      if (map[d.stage]) {
        map[d.stage].push(d)
      } else {
        map['Lead'].push(d)
      }
    })

    return map
  }, [deals, searchFilter])

  // Get current focused deal
  const currentStage = STAGES[focusedColIndex]
  const currentStageDeals = dealsByStage[currentStage] || []
  const focusedDeal = currentStageDeals[focusedCardIndex] || currentStageDeals[0] || null

  // Ensure card index stays valid when stage changes
  useEffect(() => {
    const maxIdx = Math.max(0, currentStageDeals.length - 1)
    if (focusedCardIndex > maxIdx) {
      setFocusedCardIndex(maxIdx)
    }
  }, [focusedColIndex, currentStageDeals.length, focusedCardIndex])

  // Keyboard navigation for Kanban (H, J, K, L, Arrows, Tab, Enter, [, ])
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, or contentEditable
      const target = e.target as HTMLElement
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable
      ) {
        return
      }

      // Check if any modal is open
      if (document.querySelector('.modal-backdrop') || document.querySelector('[role="dialog"]')) {
        return
      }

      // Only handle if in kanban view
      if (viewMode !== 'kanban') return

      const key = e.key.toLowerCase()

      // H or ArrowLeft: Move to previous column
      if (key === 'h' || e.key === 'ArrowLeft') {
        e.preventDefault()
        setIsBoardFocused(true)
        setFocusedColIndex((prev) => (prev > 0 ? prev - 1 : STAGES.length - 1))
        setFocusedCardIndex(0)
      }
      // L or ArrowRight: Move to next column
      else if (key === 'l' || e.key === 'ArrowRight') {
        e.preventDefault()
        setIsBoardFocused(true)
        setFocusedColIndex((prev) => (prev < STAGES.length - 1 ? prev + 1 : 0))
        setFocusedCardIndex(0)
      }
      // J or ArrowDown: Move to next deal in column
      else if (key === 'j' || e.key === 'ArrowDown') {
        e.preventDefault()
        setIsBoardFocused(true)
        const colDeals = dealsByStage[STAGES[focusedColIndex]] || []
        if (colDeals.length > 0) {
          setFocusedCardIndex((prev) => (prev < colDeals.length - 1 ? prev + 1 : 0))
        }
      }
      // K or ArrowUp: Move to previous deal in column
      else if (key === 'k' || e.key === 'ArrowUp') {
        e.preventDefault()
        setIsBoardFocused(true)
        const colDeals = dealsByStage[STAGES[focusedColIndex]] || []
        if (colDeals.length > 0) {
          setFocusedCardIndex((prev) => (prev > 0 ? prev - 1 : colDeals.length - 1))
        }
      }
      // Tab: Cycle through deals
      else if (e.key === 'Tab') {
        // Find next non-empty column or cycle
        setIsBoardFocused(true)
        const allDealsList = STAGES.flatMap((s) => dealsByStage[s])
        if (allDealsList.length > 0 && focusedDeal) {
          e.preventDefault()
          const currentGlobalIdx = allDealsList.findIndex((d) => d.id === focusedDeal.id)
          const nextGlobalIdx = e.shiftKey
            ? (currentGlobalIdx - 1 + allDealsList.length) % allDealsList.length
            : (currentGlobalIdx + 1) % allDealsList.length
          const nextDeal = allDealsList[nextGlobalIdx]
          if (nextDeal) {
            const nextColIdx = STAGES.indexOf(nextDeal.stage)
            if (nextColIdx !== -1) {
              setFocusedColIndex(nextColIdx)
              const cardIdx = (dealsByStage[nextDeal.stage] || []).findIndex(
                (d) => d.id === nextDeal.id
              )
              setFocusedCardIndex(Math.max(0, cardIdx))
            }
          }
        }
      }
      // Enter: Open focused deal
      else if (e.key === 'Enter') {
        if (focusedDeal) {
          e.preventDefault()
          onOpenDeal(focusedDeal)
        }
      }
      // [ or Shift+H: Move deal to previous stage
      else if (e.key === '[' || (e.shiftKey && key === 'h')) {
        if (focusedDeal) {
          e.preventDefault()
          const curIdx = STAGES.indexOf(focusedDeal.stage)
          if (curIdx > 0) {
            const prevStage = STAGES[curIdx - 1]
            onMoveDealStage(focusedDeal.id, prevStage)
            setFocusedColIndex(curIdx - 1)
          }
        }
      }
      // ] or Shift+L: Move deal to next stage
      else if (e.key === ']' || (e.shiftKey && key === 'l')) {
        if (focusedDeal) {
          e.preventDefault()
          const curIdx = STAGES.indexOf(focusedDeal.stage)
          if (curIdx < STAGES.length - 1) {
            const nextStage = STAGES[curIdx + 1]
            onMoveDealStage(focusedDeal.id, nextStage)
            setFocusedColIndex(curIdx + 1)
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [
    viewMode,
    focusedColIndex,
    focusedCardIndex,
    dealsByStage,
    focusedDeal,
    onOpenDeal,
    onMoveDealStage,
  ])

  // Calculate stage summary amounts
  const stageAmounts = useMemo(() => {
    const res: Record<DealStage, number> = {
      Lead: 0,
      Qualified: 0,
      Scope: 0,
      'Quote sent': 0,
      Negotiation: 0,
      Won: 0,
    }
    deals.forEach((d) => {
      const amt = d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0
      if (res[d.stage] !== undefined) {
        res[d.stage] += amt
      }
    })
    return res
  }, [deals])

  const formatKc = (num: number) => {
    return num.toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč'
  }

  return (
    <div className="space-y-4" ref={boardRef}>
      {/* Toolbar: Search, View Switch */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-[12px] border border-[#e4e7ec] shadow-xs">
        <div className="flex items-center gap-3">
          <label className="search-field">
            <Search size={14} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search deals"
            />
          </label>

          {/* View mode toggle: Kanban vs Table */}
          <div className="flex items-center p-0.5 bg-[#f0f2f5] rounded-[10px] border border-[#e4e7ec]">
            <button
              onClick={() => setViewMode('kanban')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-medium transition-all ${
                viewMode === 'kanban'
                  ? 'bg-white text-[#1c1d1f] shadow-xs'
                  : 'text-[#6f7988] hover:text-[#1c1d1f]'
              }`}
            >
              <Kanban size={13} />
              <span>Kanban</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[7px] text-[11px] font-medium transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-[#1c1d1f] shadow-xs'
                  : 'text-[#6f7988] hover:text-[#1c1d1f]'
              }`}
            >
              <TableProperties size={13} />
              <span>Dense Table</span>
            </button>
          </div>
        </div>
      </div>

      {viewMode === 'kanban' ? (
        /* KANBAN BOARD */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5 items-start">
          {STAGES.map((stage, colIdx) => {
            const stageDeals = dealsByStage[stage] || []
            const isColumnFocused = isBoardFocused && focusedColIndex === colIdx
            const totalStageAmt = stageAmounts[stage] || 0

            return (
              <div
                key={stage}
                onClick={() => {
                  setFocusedColIndex(colIdx)
                  setIsBoardFocused(true)
                }}
                className={`bg-[#f9fafb] border rounded-[12px] p-2.5 transition-all min-h-[580px] flex flex-col ${
                  isColumnFocused
                    ? 'border-[#266df0]/60 ring-1 ring-[#266df0]/20 bg-[#f8faff]'
                    : 'border-[#edf0f3]'
                }`}
              >
                {/* Column Header */}
                <div className="px-2 py-2 flex items-center justify-between border-b border-[#edf0f3] mb-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        stage === 'Lead'
                          ? 'bg-[#a6b9df]'
                          : stage === 'Qualified'
                          ? 'bg-[#6f94e6]'
                          : stage === 'Scope'
                          ? 'bg-[#538bf3]'
                          : stage === 'Quote sent'
                          ? 'bg-[#407ff2]'
                          : stage === 'Negotiation'
                          ? 'bg-[#266df0]'
                          : 'bg-[#232529]'
                      }`}
                    />
                    <h3 className="text-[12px] font-semibold text-[#1c1d1f] tracking-tight">{stage}</h3>
                    <span className="w-4 h-4 rounded-full bg-[#e9ebef] text-[#6f7988] text-[10px] font-mono font-medium flex items-center justify-center">
                      {stageDeals.length}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono font-medium text-[#8f99a8] tabular-nums">
                    {formatKc(totalStageAmt)}
                  </span>
                </div>

                {/* Cards in Column */}
                <div className="flex-1 space-y-2.5 overflow-y-auto">
                  {stageDeals.length === 0 ? (
                    <div className="py-10 text-center border-2 border-dashed border-[#edf0f3] rounded-[10px]">
                      <p className="text-[11px] text-[#9fa1a7]">Empty stage</p>
                    </div>
                  ) : (
                    stageDeals.map((deal, cardIdx) => {
                      const isCardFocused = isColumnFocused && focusedCardIndex === cardIdx

                      return (
                        <div
                          key={deal.id}
                          onClick={(e) => {
                            e.stopPropagation()
                            setFocusedColIndex(colIdx)
                            setFocusedCardIndex(cardIdx)
                            setIsBoardFocused(true)
                            onOpenDeal(deal)
                          }}
                          className={`relative p-3.5 bg-white rounded-[12px] border transition-all cursor-pointer group select-none ${
                            isCardFocused
                              ? 'border-[#266df0] ring-2 ring-[#266df0]/30 shadow-md z-10 translate-y-[-1px]'
                              : 'border-[#e4e7ec] shadow-2xs hover:border-[#cbd0d8] hover:shadow-xs'
                          }`}
                        >
                          {/* Card Top: Avatar, Company, Stage Actions */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[10px] font-semibold bg-[#e9f0ff] text-[#266df0] shrink-0">
                                {deal.company.charAt(0)}
                              </span>
                              <span className="text-[11px] font-semibold text-[#6f7988] truncate">
                                {deal.company}
                              </span>
                            </div>

                            {/* Stage shift arrows for quick mouse click too */}
                            <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                              {colIdx > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onMoveDealStage(deal.id, STAGES[colIdx - 1])
                                  }}
                                  title="Shift left ([)"
                                  className="w-5 h-5 rounded hover:bg-[#f0f2f5] text-[#8f99a8] hover:text-[#1c1d1f] flex items-center justify-center"
                                >
                                  <ArrowLeft size={11} />
                                </button>
                              )}
                              {colIdx < STAGES.length - 1 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onMoveDealStage(deal.id, STAGES[colIdx + 1])
                                  }}
                                  title="Shift right (])"
                                  className="w-5 h-5 rounded hover:bg-[#f0f2f5] text-[#8f99a8] hover:text-[#1c1d1f] flex items-center justify-center"
                                >
                                  <ArrowRight size={11} />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Deal Title */}
                          <h4 className="mt-2 text-[12px] font-semibold text-[#1c1d1f] leading-snug line-clamp-2">
                            {deal.title}
                          </h4>

                          {/* Financial Value & Probability */}
                          <div className="mt-2.5 flex items-baseline justify-between pt-2 border-t border-[#f5f6f8]">
                            <span className="text-[13px] font-bold font-mono tabular-nums text-[#1c1d1f]">
                              {deal.value}
                            </span>
                            <span className="text-[10px] font-mono font-medium text-[#6f7988]">
                              {deal.probability}
                            </span>
                          </div>

                          {/* Mandatory Next Action Pill (GTD) */}
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#232529] bg-[#f8faff] p-1.5 rounded-[7px] border border-[#edf3fe]">
                            <Clock size={11} className="text-[#266df0] shrink-0" />
                            <span className="truncate font-medium">{deal.next}</span>
                          </div>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        /* DENSE TABLE VIEW */
        <div className="bg-white rounded-[12px] border border-[#e4e7ec] shadow-xs overflow-hidden">
          {deals.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                <WalletCards size={18} />
              </div>
              <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No deals in pipeline</h3>
              <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                Track client scopes, estimated value, and GTD next steps.
              </p>
              <button
                type="button"
                onClick={onAddDealClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
              >
                <CirclePlus size={13} />
                <span>Add first deal (N)</span>
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-[12px]">
                <thead className="bg-[#fafbfc] border-b border-[#edf0f3] text-[9px] uppercase tracking-wider font-bold text-[#9fa1a7]">
                  <tr>
                    <th className="py-3 px-4">Deal & Company</th>
                    <th className="py-3 px-3">Stage</th>
                    <th className="py-3 px-3 text-right">Value (Kč)</th>
                    <th className="py-3 px-3">Probability</th>
                    <th className="py-3 px-3">Mandatory Next Action</th>
                    <th className="py-3 px-3">Primary Contact</th>
                    <th className="py-3 px-3 text-center">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f0f1f3]">
                  {deals
                    .filter((d) => {
                      if (!searchFilter.trim()) return true
                      const q = searchFilter.toLowerCase().trim()
                      return (
                        d.title.toLowerCase().includes(q) ||
                        d.company.toLowerCase().includes(q) ||
                        d.stage.toLowerCase().includes(q) ||
                        d.value.toLowerCase().includes(q)
                      )
                    })
                    .map((deal) => (
                      <tr
                        key={deal.id}
                        onClick={() => onOpenDeal(deal)}
                        className="hover:bg-[#f8faff] cursor-pointer transition-colors"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2.5">
                            <span className="w-7 h-7 rounded-[8px] flex items-center justify-center text-[11px] font-semibold bg-[#e9f0ff] text-[#266df0] shrink-0">
                              {deal.company.charAt(0)}
                            </span>
                            <div>
                              <strong className="text-[13px] font-semibold text-[#1c1d1f] block">
                                {deal.title}
                              </strong>
                              <span className="text-[11px] text-[#8f99a8]">{deal.company}</span>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 text-[10px] font-medium rounded-[7px] bg-[#f1f5ff] text-[#266df0]">
                            {deal.stage}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums font-bold text-[#1c1d1f]">
                          {deal.value}
                        </td>
                        <td className="py-3 px-3 font-mono text-[#6f7988] font-medium">
                          {deal.probability}
                        </td>
                        <td className="py-3 px-3 text-[#6f7988]">
                          <div className="flex items-center gap-1.5">
                            <Clock size={12} className="text-[#266df0]" />
                            <span>{deal.next}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-[#6f7988]">
                          {deal.contactName || deal.company}
                        </td>
                        <td className="py-3 px-3 text-center">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              onOpenDeal(deal)
                            }}
                            className="text-[#9fa1a7] hover:text-[#1c1d1f] p-1 rounded-[6px]"
                          >
                            <MoreHorizontal size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>

              {deals.length > 0 &&
                searchFilter.trim() &&
                deals.filter((d) => {
                  const q = searchFilter.toLowerCase().trim()
                  return (
                    d.title.toLowerCase().includes(q) ||
                    d.company.toLowerCase().includes(q) ||
                    d.stage.toLowerCase().includes(q) ||
                    d.value.toLowerCase().includes(q)
                  )
                }).length === 0 && (
                  <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                    No deals matching &ldquo;{searchFilter}&rdquo;
                  </div>
                )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
