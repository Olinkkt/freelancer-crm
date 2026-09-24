'use client'

import React from 'react'
import { Check, Clock, AlertTriangle } from 'lucide-react'
import { Deal } from './types'

interface DealNextActionCellProps {
  deal: Deal
  onOpenModal: (deal: Deal) => void
  onComplete: (deal: Deal) => void
}

export function DealNextActionCell({
  deal,
  onOpenModal,
  onComplete,
}: DealNextActionCellProps) {
  if (!deal.nextAction) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onOpenModal(deal)
        }}
        className="next-action-prompt"
        title="GTD Rule: A deal can never sit without an explicit next action. Click to schedule."
      >
        <AlertTriangle size={13} strokeWidth={2.4} className="prompt-icon" />
        <span>No next step set</span>
      </button>
    )
  }

  const isToday =
    deal.nextDueTone === 'urgent' ||
    deal.nextDueDate?.toLowerCase().includes('today')

  return (
    <div className="next-action-cell" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="next-action-check"
        onClick={() => onComplete(deal)}
        title="Mark complete (will prompt for subsequent next action)"
        aria-label={`Mark "${deal.nextAction}" complete`}
      >
        <Check size={12} strokeWidth={2.6} className="check-icon" />
      </button>

      <button
        type="button"
        className="next-action-pill"
        onClick={() => onOpenModal(deal)}
        title="Click to edit or reschedule next action"
      >
        <span className="action-text">{deal.nextAction}</span>
        {deal.nextDueDate && (
          <span className={`due-tag ${isToday ? 'today' : ''}`}>
            <Clock size={10} strokeWidth={2} />
            {deal.nextDueDate}
          </span>
        )}
      </button>
    </div>
  )
}
