'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import {
  Kanban,
  CirclePlus,
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
  FileText,
  PhoneCall,
  Check,
  Trash2,
  GripVertical,
  Banknote,
  Eye,
  EyeOff,
  Edit3,
} from 'lucide-react'
import { Deal, DealStage } from '@/lib/crm-types'
import { RowActionMenu } from '@/components/ui/row-action-menu'

interface DealKanbanProps {
  deals: Deal[]
  onOpenDeal: (deal: Deal) => void
  onAddDealClick: () => void
  onMoveDealStage: (dealId: string, newStage: DealStage) => void
  onDeleteDeal?: (dealId: string) => void
  onLogInteraction?: (deal: Deal) => void
  onEditDeal?: (deal: Deal) => void
}

const STAGES: DealStage[] = [
  'Lead',
  'Qualified',
  'Proposal',
  'Won',
  'Paid',
]

export function DealKanban({
  deals,
  onOpenDeal,
  onAddDealClick,
  onMoveDealStage,
  onDeleteDeal,
  onLogInteraction,
  onEditDeal,
}: DealKanbanProps) {
  const [focusedColIndex, setFocusedColIndex] = useState<number>(0)
  const [focusedCardIndex, setFocusedCardIndex] = useState<number>(0)
  const [isBoardFocused, setIsBoardFocused] = useState<boolean>(false)
  const [searchFilter, setSearchFilter] = useState<string>('')
  const [draggedDealId, setDraggedDealId] = useState<string | null>(null)
  const [dragOverStage, setDragOverStage] = useState<DealStage | null>(null)
  const [hideEmptyStages, setHideEmptyStages] = useState<boolean>(false)
  const boardRef = useRef<HTMLDivElement>(null)
  const isDraggingRef = useRef<boolean>(false)
  const dragCounters = useRef<Record<string, number>>({})

  // Group deals by stage
  const dealsByStage = useMemo(() => {
    const map: Record<DealStage, Deal[]> = {
      Lead: [],
      Qualified: [],
      Proposal: [],
      Won: [],
      Paid: [],
    }

    const filtered = searchFilter
      ? deals.filter(
          (d) =>
            d.title.toLowerCase().includes(searchFilter.toLowerCase()) ||
            d.company.toLowerCase().includes(searchFilter.toLowerCase())
        )
      : deals

    filtered.forEach((d) => {
      let stageKey = d.stage as DealStage
      if (
        stageKey === ('Scope' as any) ||
        stageKey === ('Quote sent' as any) ||
        stageKey === ('Negotiation' as any)
      ) {
        stageKey = 'Proposal'
      } else if (stageKey === ('Completed' as any)) {
        stageKey = 'Won'
      }

      if (map[stageKey]) {
        map[stageKey].push(d)
      } else {
        map['Lead'].push(d)
      }
    })

    return map
  }, [deals, searchFilter])

  const emptyStagesCount = useMemo(() => {
    return STAGES.filter((s) => (dealsByStage[s]?.length || 0) === 0).length
  }, [dealsByStage])

  const visibleStages = useMemo(() => {
    if (!hideEmptyStages) return STAGES
    const withDeals = STAGES.filter((s) => (dealsByStage[s]?.length || 0) > 0)
    return withDeals.length > 0 ? withDeals : STAGES
  }, [hideEmptyStages, dealsByStage])

  // Find currently dragged deal
  const draggedDeal = useMemo(() => {
    if (!draggedDealId) return null
    return deals.find((d) => d.id === draggedDealId) || null
  }, [draggedDealId, deals])

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, deal: Deal) => {
    isDraggingRef.current = true
    setDraggedDealId(deal.id)
    e.dataTransfer.setData('text/plain', deal.id)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragEnd = () => {
    setDraggedDealId(null)
    setDragOverStage(null)
    dragCounters.current = {}
    setTimeout(() => {
      isDraggingRef.current = false
    }, 150)
  }

  const handleDragOver = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    if (dragOverStage !== stage) {
      setDragOverStage(stage)
    }
  }

  const handleDragEnter = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault()
    dragCounters.current[stage] = (dragCounters.current[stage] || 0) + 1
    if (dragOverStage !== stage) {
      setDragOverStage(stage)
    }
  }

  const handleDragLeave = (e: React.DragEvent, stage: DealStage) => {
    dragCounters.current[stage] = (dragCounters.current[stage] || 0) - 1
    if (dragCounters.current[stage] <= 0) {
      dragCounters.current[stage] = 0
      if (dragOverStage === stage) {
        setDragOverStage(null)
      }
    }
  }

  const handleDrop = (e: React.DragEvent, stage: DealStage) => {
    e.preventDefault()
    dragCounters.current[stage] = 0
    setDragOverStage(null)
    const dealId = e.dataTransfer.getData('text/plain') || draggedDealId
    if (dealId) {
      const deal = deals.find((d) => d.id === dealId)
      if (deal && deal.stage !== stage) {
        onMoveDealStage(dealId, stage)
      }
    }
    setDraggedDealId(null)
  }


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
      Proposal: 0,
      Won: 0,
      Paid: 0,
    }
    deals.forEach((d) => {
      const amt = d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0
      let stageKey = d.stage as DealStage
      if (
        stageKey === ('Scope' as any) ||
        stageKey === ('Quote sent' as any) ||
        stageKey === ('Negotiation' as any)
      ) {
        stageKey = 'Proposal'
      } else if (stageKey === ('Completed' as any)) {
        stageKey = 'Won'
      }

      if (res[stageKey] !== undefined) {
        res[stageKey] += amt
      }
    })
    return res
  }, [deals])

  const formatKc = (num: number) => {
    return num.toLocaleString('cs-CZ').replace(/\s/g, ' ') + ' Kč'
  }

  return (
    <div className="space-y-4" ref={boardRef}>
      {/* Toolbar: Search, Keyboard Hints & Add Action */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-[12px] border border-[#e4e7ec] shadow-xs">
        <div className="flex items-center gap-2">
          <label className="search-field">
            <Search size={14} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Search deals"
            />
          </label>
          {emptyStagesCount > 0 && (
            <button
              type="button"
              onClick={() => setHideEmptyStages((prev) => !prev)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px] font-medium border transition-colors cursor-pointer ${
                hideEmptyStages
                  ? 'bg-[#e9f0ff] border-[#b8d1fc] text-[#266df0]'
                  : 'bg-white border-[#e4e7ec] text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#f8faff]'
              }`}
              title={hideEmptyStages ? 'Show all 5 stages' : `Hide ${emptyStagesCount} empty stage${emptyStagesCount > 1 ? 's' : ''}`}
            >
              {hideEmptyStages ? <Eye size={13} /> : <EyeOff size={13} />}
              <span>{hideEmptyStages ? 'Show all stages' : `Hide empty (${emptyStagesCount})`}</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2.5 text-[11px] text-[#8f99a8]">
          <span className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#f4f5f6] text-[#6f7988] rounded-[8px] font-mono text-[10px]">
            <span>Drag:</span>
            <kbd className="text-[#1c1d1f] font-semibold">Mouse</kbd>
            <span className="text-[#cad0d9]">•</span>
            <span>Navigate:</span>
            <kbd className="text-[#1c1d1f] font-semibold">← → ↑ ↓</kbd>
            <span className="text-[#cad0d9]">•</span>
            <span>Shift:</span>
            <kbd className="text-[#1c1d1f] font-semibold">[ ]</kbd>
            <span className="text-[#cad0d9]">•</span>
            <span>Open:</span>
            <kbd className="text-[#1c1d1f] font-semibold">↵</kbd>
          </span>
          <button
            type="button"
            onClick={onAddDealClick}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
          >
            <CirclePlus size={13} />
            <span>New deal</span>
            <kbd className="ml-0.5 px-1 bg-[#3a3e45] text-white rounded text-[10px] font-mono">N</kbd>
          </button>
        </div>
      </div>

      {/* KANBAN BOARD */}
      <div className="flex gap-4 items-start overflow-x-auto pb-6 pt-1 px-0.5 scroll-smooth">
        {visibleStages.map((stage) => {
          const colIdx = STAGES.indexOf(stage)
          const stageDeals = dealsByStage[stage] || []
          const isColumnFocused = isBoardFocused && focusedColIndex === colIdx
          const totalStageAmt = stageAmounts[stage] || 0
          const isTargetStage = dragOverStage === stage && draggedDeal?.stage !== stage

          return (
            <div
              key={stage}
              onDragOver={(e) => handleDragOver(e, stage)}
              onDragEnter={(e) => handleDragEnter(e, stage)}
              onDragLeave={(e) => handleDragLeave(e, stage)}
              onDrop={(e) => handleDrop(e, stage)}
              onClick={() => {
                setFocusedColIndex(colIdx)
                setIsBoardFocused(true)
              }}
              className={`w-[280px] shrink-0 bg-[#f9fafb] border rounded-[12px] p-2.5 transition-all min-h-[580px] flex flex-col ${
                isTargetStage
                  ? 'border-[#266df0] ring-2 ring-[#266df0]/30 bg-[#eff5ff]'
                  : isColumnFocused
                  ? 'border-[#266df0]/60 ring-1 ring-[#266df0]/20 bg-[#f8faff]'
                  : 'border-[#edf0f3]'
              }`}
            >
              {/* Column Header */}
              <div className="px-2 py-2 flex items-center justify-between border-b border-[#edf0f3] mb-2 min-h-[34px]">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      stage === 'Lead'
                        ? 'bg-[#a6b9df]'
                        : stage === 'Qualified'
                        ? 'bg-[#6f94e6]'
                        : stage === 'Proposal'
                        ? 'bg-[#266df0]'
                        : stage === 'Won'
                        ? 'bg-[#10b981]'
                        : 'bg-[#059669]'
                    }`}
                  />
                  <h3 className="text-[12px] font-semibold text-[#1c1d1f] tracking-tight whitespace-nowrap truncate">
                    {stage === 'Won' ? 'Won • Active Work' : stage === 'Paid' ? 'Paid • Delivered' : stage}
                  </h3>
                  <span className="w-4 h-4 rounded-full bg-[#e9ebef] text-[#6f7988] text-[10px] font-mono font-medium flex items-center justify-center shrink-0">
                    {stageDeals.length}
                  </span>
                </div>
                {totalStageAmt > 0 && (
                  <span className="text-[11px] font-mono font-semibold text-[#266df0] tabular-nums whitespace-nowrap shrink-0">
                    {formatKc(totalStageAmt)}
                  </span>
                )}
              </div>

              {/* Cards in Column */}
              <div
                className="flex-1 space-y-2.5 overflow-y-auto"
                onDragOver={(e) => handleDragOver(e, stage)}
                onDrop={(e) => handleDrop(e, stage)}
              >
                {stageDeals.length === 0 ? (
                  isTargetStage ? (
                    <div className="py-12 text-center border-2 border-dashed border-[#266df0] bg-[#eff5ff] text-[#266df0] rounded-[10px] flex items-center justify-center gap-1.5 text-[11px] font-semibold animate-pulse">
                      <ArrowRight size={12} />
                      <span>Drop here to move</span>
                    </div>
                  ) : (
                    <div className="py-10 text-center text-[#9fa1a7] text-[11px]">
                      <div className="w-7 h-7 rounded-full bg-white border border-[#edf0f3] text-[#c0c6d0] flex items-center justify-center mx-auto mb-1.5">
                        <Sparkles size={13} />
                      </div>
                      <span>No deals</span>
                    </div>
                  )
                ) : (
                  <>
                    {stageDeals.map((deal, cardIdx) => {
                      const isCardFocused = isColumnFocused && focusedCardIndex === cardIdx
                      const isBeingDragged = draggedDealId === deal.id

                      return (
                        <div
                          key={deal.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, deal)}
                          onDragEnd={handleDragEnd}
                          onClick={(e) => {
                            if (isDraggingRef.current) return
                            e.stopPropagation()
                            setFocusedColIndex(colIdx)
                            setFocusedCardIndex(cardIdx)
                            setIsBoardFocused(true)
                            onOpenDeal(deal)
                          }}
                          className={`relative p-3.5 bg-white rounded-[12px] border transition-all cursor-grab active:cursor-grabbing group select-none ${
                            isBeingDragged
                              ? 'opacity-35 scale-[0.98] border-dashed border-[#266df0] shadow-none'
                              : isCardFocused
                              ? 'border-[#266df0] ring-2 ring-[#266df0]/30 shadow-md z-10 translate-y-[-1px]'
                              : 'border-[#e4e7ec] shadow-2xs hover:border-[#cbd0d8] hover:shadow-xs'
                          }`}
                        >
                          {/* Card Top: Avatar, Company, Stage Actions */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 min-w-0">
                              <GripVertical
                                size={12}
                                className="text-[#cbd0d8] group-hover:text-[#6f7988] shrink-0 transition-colors"
                              />
                              <span className="w-6 h-6 rounded-[6px] flex items-center justify-center text-[10px] font-semibold bg-[#e9f0ff] text-[#266df0] shrink-0">
                                {deal.company.charAt(0)}
                              </span>
                              <span className="text-[11px] font-semibold text-[#6f7988] truncate">
                                {deal.company}
                              </span>
                            </div>

                            {/* Stage shift arrows & RowActionMenu */}
                            <div
                              className="flex items-center gap-0.5"
                              onMouseDown={(e) => e.stopPropagation()}
                            >
                              <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 transition-opacity">
                                {colIdx > 0 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMoveDealStage(deal.id, STAGES[colIdx - 1])
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    title="Shift left ([)"
                                    className="w-5 h-5 rounded hover:bg-[#f0f2f5] text-[#8f99a8] hover:text-[#1c1d1f] flex items-center justify-center cursor-pointer"
                                  >
                                    <ArrowLeft size={11} />
                                  </button>
                                )}
                                {colIdx < STAGES.length - 1 && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onMoveDealStage(deal.id, STAGES[colIdx + 1])
                                    }}
                                    onMouseDown={(e) => e.stopPropagation()}
                                    title="Shift right (])"
                                    className="w-5 h-5 rounded hover:bg-[#f0f2f5] text-[#8f99a8] hover:text-[#1c1d1f] flex items-center justify-center cursor-pointer"
                                  >
                                    <ArrowRight size={11} />
                                  </button>
                                )}
                              </div>

                              <div
                                onClick={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                              >
                                <RowActionMenu
                                  triggerLabel={`Options for ${deal.title}`}
                                  items={[
                                    {
                                      label: 'Edit deal',
                                      icon: Edit3,
                                      onClick: () => (onEditDeal ? onEditDeal(deal) : onOpenDeal(deal)),
                                    },
                                    {
                                      label: 'Open deal drawer',
                                      icon: FileText,
                                      onClick: () => onOpenDeal(deal),
                                    },
                                    ...(onLogInteraction
                                      ? [
                                          {
                                            label: 'Log interaction',
                                            icon: PhoneCall,
                                            onClick: () => onLogInteraction(deal),
                                          },
                                        ]
                                      : []),
                                    ...(deal.stage !== 'Won' && deal.stage !== 'Paid'
                                      ? [
                                          {
                                            label: 'Mark as Won',
                                            icon: Check,
                                            onClick: () => onMoveDealStage(deal.id, 'Won'),
                                          },
                                        ]
                                      : []),
                                    ...(deal.stage !== 'Paid'
                                      ? [
                                          {
                                            label: 'Mark as Paid',
                                            icon: Banknote,
                                            onClick: () => onMoveDealStage(deal.id, 'Paid'),
                                          },
                                        ]
                                      : []),
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

                          {/* Deliverables Mini-Progress */}
                          {deal.deliverables && deal.deliverables.length > 0 && (
                            <div className="mt-2 space-y-1">
                              <div className="flex items-center justify-between text-[10px] text-[#6f7988]">
                                <span className="font-medium">Deliverables</span>
                                <span className="font-mono font-semibold text-[#1c1d1f]">
                                  {deal.deliverables.filter((d) => d.status === 'Done').length}/{deal.deliverables.length}
                                </span>
                              </div>
                              <div className="w-full bg-[#f0f2f5] h-1 rounded-full overflow-hidden">
                                <div
                                  className="bg-[#266df0] h-full transition-all"
                                  style={{
                                    width: `${Math.round(
                                      (deal.deliverables.filter((d) => d.status === 'Done').length / deal.deliverables.length) * 100
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          )}

                          {/* Invoicing Status Badge */}
                          {(() => {
                            if (deal.stage === 'Paid') {
                              return (
                                <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono font-semibold text-[#1f7a47] bg-[#eaf8f0] px-1.5 py-0.5 rounded-[5px] w-fit">
                                  <span>✓ 100% Paid</span>
                                </div>
                              )
                            }
                            if (deal.invoices && deal.invoices.length > 0) {
                              const paidDeposit = deal.invoices.some((i) => i.type === 'Deposit' && i.status === 'Paid')
                              if (paidDeposit) {
                                return (
                                  <div className="mt-1.5 flex items-center gap-1 text-[9px] font-mono font-semibold text-[#266df0] bg-[#eff5ff] px-1.5 py-0.5 rounded-[5px] w-fit">
                                    <span>50% Deposit Paid</span>
                                  </div>
                                )
                              }
                            }
                            return null
                          })()}

                          {/* Mandatory Next Action Pill (GTD) */}
                          {deal.next ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#232529] bg-[#f8faff] p-1.5 rounded-[7px] border border-[#edf3fe]">
                              <Clock size={11} className="text-[#266df0] shrink-0" />
                              <span className="truncate font-medium">{deal.next}</span>
                            </div>
                          ) : deal.stage !== 'Paid' ? (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-[#b54708] bg-[#fff9f0] p-1.5 rounded-[7px] border border-[#fedf89]">
                              <AlertCircle size={11} className="text-[#b54708] shrink-0" />
                              <span className="truncate font-semibold">Needs next action</span>
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                    {isTargetStage && (
                      <div className="py-2.5 px-3 border-2 border-dashed border-[#266df0] bg-[#eff5ff] text-[#266df0] rounded-[10px] text-[11px] font-semibold text-center flex items-center justify-center gap-1.5 transition-all animate-pulse">
                        <ArrowRight size={12} />
                        <span>Drop to move here</span>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {searchFilter.trim() &&
        Object.values(dealsByStage).every((list) => list.length === 0) && (
          <div className="py-12 text-center text-[#8f99a8] text-[12px] bg-white rounded-[12px] border border-[#e4e7ec]">
            No deals matching &ldquo;{searchFilter}&rdquo;
          </div>
        )}
    </div>
  )
}
