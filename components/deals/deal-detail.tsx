'use client'

import React, { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, ChevronDown, Clock, Edit3, FileText, Plus } from 'lucide-react'
import {
  Deal,
  DealStage,
  DEAL_STAGE_HINTS,
  OPEN_DEAL_STAGES,
  PM_STAGES,
  WorkspaceSettings,
  isPmStage,
  nextDealStage,
} from '@/lib/crm-types'
import { DealBoard } from '@/components/deals/deal-board'
import { DeliverableItem } from '@/lib/crm-types'
import { formatDealValue } from '@/lib/config'
import { formatDue, isOverdue } from '@/lib/due-date'

interface DealDetailProps {
  deal: Deal
  settings?: WorkspaceSettings
  onBack: () => void
  onEdit: (deal: Deal) => void
  onOpenNotes: (deal: Deal) => void
  onMoveStage: (dealId: string, stage: DealStage) => void
  onChecklistChange: (dealId: string, items: DeliverableItem[]) => void
}

function waitingSinceLabel(iso: string, locale?: string): string {
  const since = new Date(iso)
  if (Number.isNaN(since.getTime())) return ''
  const date = since.toLocaleDateString(locale || undefined, { day: 'numeric', month: 'short' })
  const time = since.toLocaleTimeString(locale || undefined, { hour: '2-digit', minute: '2-digit' })
  return `Since ${date} · ${time}`
}

/** One deal: CRM info on top, PM progress (stage track + checklist) below. */
export function DealDetail({
  deal,
  settings,
  onBack,
  onEdit,
  onOpenNotes,
  onMoveStage,
  onChecklistChange,
}: DealDetailProps) {
  const next = nextDealStage(deal.stage)
  const inPm = isPmStage(deal.stage)

  return (
    <>
      <section className="page-heading">
        <div className="min-w-0">
          <button type="button" className="text-button mb-2" onClick={onBack}>
            <ArrowLeft size={14} /> Back
          </button>
          <h1 className="truncate" title={deal.title}>
            {deal.title}
          </h1>
          <p className="subcopy">
            {deal.contactName} · <span className="tabular-nums">{formatDealValue(deal.value, settings)}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {next && (
            <button
              type="button"
              className="primary-button"
              onClick={() => onMoveStage(deal.id, next)}
              title={DEAL_STAGE_HINTS[next]}
            >
              {next === 'Completed' ? <Check size={15} /> : <ArrowRight size={15} />}
              <span>{next === 'Completed' ? 'Complete project' : `Move to ${next}`}</span>
            </button>
          )}
        </div>
      </section>

      {/* Stage track: CRM, then PM. Click any stage to move there. */}
      <section className="panel mb-3.5" aria-label="Stage">
        <div className="panel-heading">
          <div>
            <p className="section-kicker">{inPm ? 'Project (PM)' : 'Sales (CRM)'}</p>
            <h2>{deal.stage}</h2>
            <p className="mt-1 text-[12px] text-[#8f99a8]">{DEAL_STAGE_HINTS[deal.stage]}</p>
          </div>
        </div>
        <div className="deal-stage-steps mt-4">
          <CrmStagePicker stage={deal.stage} onPick={(st) => onMoveStage(deal.id, st)} />
          {PM_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              title={DEAL_STAGE_HINTS[s]}
              aria-pressed={deal.stage === s}
              className={`deal-stage-step ${deal.stage === s ? 'current' : ''}`}
              onClick={() => deal.stage !== s && onMoveStage(deal.id, s)}
            >
              {s}
            </button>
          ))}
        </div>
      </section>

      <div className="deal-detail-grid">
        {/* Next action (GTD) */}
        <section className="panel">
          <p className="section-kicker">Next action</p>
          {deal.next ? (
            <>
              <h2 className="text-[22px] leading-snug font-semibold text-[#1c1d1f] mt-1">{deal.next}</h2>
              {deal.nextDueDate && !deal.waiting && (
                <p
                  className={`mt-1 flex items-center gap-1 text-[12px] ${
                    isOverdue(deal.nextDueDate) ? 'text-[#d92d20] font-semibold' : 'text-[#8f99a8]'
                  }`}
                >
                  <Clock size={12} /> {formatDue(deal.nextDueDate)}
                </p>
              )}
            </>
          ) : (
            <p className="mt-1 text-[12px] text-[#b54708]">No next action. Every deal needs one.</p>
          )}
          {deal.waiting && deal.waitingSince && (
            <p className="mt-1 flex items-center gap-1 text-[12px] text-[#8f99a8]">
              <Clock size={12} /> {waitingSinceLabel(deal.waitingSince, settings?.locale)}
            </p>
          )}
          <button type="button" className="text-button mt-auto pt-3 self-start" onClick={() => onEdit(deal)}>
            <Edit3 size={13} /> Change
          </button>
        </section>

        {/* Notes */}
        <section className="panel">
          <p className="section-kicker">Notes</p>
          {deal.notes?.trim() ? (
            <p className="mt-1 text-[12px] text-[#505967] whitespace-pre-wrap line-clamp-3">{deal.notes.trim()}</p>
          ) : (
            <p className="mt-1 text-[12px] text-[#8f99a8]">No notes yet.</p>
          )}
          <button type="button" className="text-button mt-auto pt-3 self-start" onClick={() => onOpenNotes(deal)}>
            <FileText size={13} /> Open notes
          </button>
        </section>
      </div>

      <DealBoard items={deal.deliverables ?? []} onChange={(items) => onChecklistChange(deal.id, items)} />
    </>
  )
}

/** "+" pill holding the CRM stages; shows the current one when the deal is still in sales */
function CrmStagePicker({ stage, onPick }: { stage: DealStage; onPick: (stage: DealStage) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inCrm = OPEN_DEAL_STAGES.includes(stage)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc, true)
    return () => {
      document.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc, true)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Sales (CRM) stages"
        className={`deal-stage-step inline-flex items-center gap-1 ${inCrm ? 'current' : ''}`}
        onClick={() => setOpen((v) => !v)}
      >
        {inCrm ? stage : <Plus size={13} aria-label="CRM stages" />}
        <ChevronDown size={12} />
      </button>
      {open && (
        <div role="menu" className="deal-stage-menu">
          <p className="deal-stage-group-label px-2.5 pt-1 pb-1.5">SALES (CRM)</p>
          {OPEN_DEAL_STAGES.map((s) => (
            <button
              key={s}
              type="button"
              role="menuitemradio"
              aria-checked={stage === s}
              className={stage === s ? 'active' : ''}
              onClick={() => {
                setOpen(false)
                if (stage !== s) onPick(s)
              }}
            >
              <span>{s}</span>
              <small>{DEAL_STAGE_HINTS[s]}</small>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
