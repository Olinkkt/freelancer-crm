'use client'

import React from 'react'
import Link from 'next/link'
import {
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import type { ProjectCard } from '@/lib/projects/types'
import { formatMinor } from '@/lib/projects/money'
import { formatRelativeDate, localToday } from '@/lib/projects/dates'
import { revisionRoundLabel } from '@/lib/projects/ui-helpers'
import { OPERATOR_CONFIG } from '@/lib/config'

interface ProjectCardViewProps {
  card: ProjectCard
  isSelected?: boolean
  onSelect?: () => void
  onOpen?: () => void
  onDragStart?: (e: React.DragEvent, card: ProjectCard) => void
}

export function ProjectCardView({
  card,
  isSelected = false,
  onSelect,
  onOpen,
  onDragStart,
}: ProjectCardViewProps) {
  const { project, stage, money, openTasks, doneTasks, overdueTasks, currentMilestone, waitingDays, needsNextStep, revisionRound } = card
  const today = localToday()
  const totalTasks = openTasks + doneTasks

  // Money formatting
  const formattedBudget = money.budgetMinor
    ? formatMinor(money.budgetMinor, project.currency, {
        currency: project.currency,
        currencySymbol: project.currency === 'EUR' ? '€' : '$',
        locale: OPERATOR_CONFIG.locale || 'en-US',
      })
    : null

  const formattedUnpaid = money.outstandingMinor > 0
    ? formatMinor(money.outstandingMinor, project.currency, {
        currency: project.currency,
        currencySymbol: project.currency === 'EUR' ? '€' : '$',
        locale: OPERATOR_CONFIG.locale || 'en-US',
      })
    : null

  return (
    <div
      draggable
      onDragStart={(e) => onDragStart?.(e, card)}
      onClick={onSelect}
      onDoubleClick={onOpen}
      className={`p-3 rounded-xl bg-white dark:bg-slate-800 border transition-all cursor-pointer select-none space-y-2.5 ${
        isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/30 shadow-md'
          : 'border-slate-200 dark:border-slate-700/70 hover:border-slate-300 dark:hover:border-slate-600 shadow-sm'
      }`}
    >
      {/* Title & Client */}
      <div className="space-y-0.5">
        <div className="flex items-start justify-between gap-1">
          <h3 className="font-bold text-xs text-slate-900 dark:text-slate-100 truncate">
            {project.title}
          </h3>
          {project.health === 'at_risk' && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/60 shrink-0">
              At risk
            </span>
          )}
          {project.health === 'blocked' && (
            <span className="px-1.5 py-0.2 rounded text-[10px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/60 shrink-0">
              Blocked
            </span>
          )}
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
          {project.company}
        </p>
      </div>

      {/* Money Line */}
      <div className="text-[11px] text-slate-600 dark:text-slate-300 flex items-center justify-between font-medium">
        {project.billingType === 'fixed' && (
          <>
            <span>{formattedBudget || 'Fixed'}</span>
            {formattedUnpaid ? (
              <span className="text-amber-600 dark:text-amber-400">
                {formattedUnpaid} unpaid
              </span>
            ) : money.paidMinor > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">paid ✓</span>
            ) : money.draftMinor > 0 ? (
              <span className="text-slate-400">deposit draft</span>
            ) : null}
          </>
        )}

        {project.billingType === 'hourly' && (
          <span>
            hourly · {money.billedHours}
            {project.estimateHours ? `/${project.estimateHours}` : ''} h
          </span>
        )}

        {project.billingType === 'retainer' && (
          <span>
            retainer · {currentMilestone ? currentMilestone.title : 'Active'}
          </span>
        )}
      </div>

      {/* Progress & Milestone */}
      <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-750">
        <span className="font-mono">
          {doneTasks}/{totalTasks}
          {currentMilestone && ` · ${currentMilestone.title}`}
        </span>
        {project.dueDate && (
          <span className="text-[10px]">
            due {formatRelativeDate(project.dueDate, today)}
          </span>
        )}
      </div>

      {/* Chips */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {/* Overdue chip */}
        {overdueTasks > 0 && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40">
            <AlertCircle size={10} />
            <span>{overdueTasks} overdue</span>
          </span>
        )}

        {/* Waiting on client chip */}
        {waitingDays !== null && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40">
            <Clock size={10} />
            <span>◷ {waitingDays}d</span>
          </span>
        )}

        {/* Needs next step chip */}
        {needsNextStep && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-700/60 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600">
            <span>◇ no next step</span>
          </span>
        )}

        {/* Round chip */}
        {revisionRound !== null && (
          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/40">
            <span>{revisionRoundLabel(revisionRound, project.revisionsIncluded)}</span>
          </span>
        )}
      </div>
    </div>
  )
}
