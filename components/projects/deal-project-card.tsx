'use client'

import React from 'react'
import Link from 'next/link'
import {
  FolderKanban,
  ExternalLink,
  Plus,
  Clock,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Banknote,
} from 'lucide-react'
import type { Deal } from '@/lib/crm-types'
import type { ProjectCard } from '@/lib/projects/types'
import { formatMinor } from '@/lib/projects/money'
import { formatRelativeDate, localToday } from '@/lib/projects/dates'
import { OPERATOR_CONFIG } from '@/lib/config'

interface DealProjectCardProps {
  deal: Deal
  projectCard?: ProjectCard | null
  onStartProject?: (dealId: string) => void
}

export function DealProjectCard({
  deal,
  projectCard,
  onStartProject,
}: DealProjectCardProps) {
  const isWon = deal.stage === 'Won'
  const today = localToday()

  // If deal has a project
  if (projectCard) {
    const { project, stage, money, openTasks, doneTasks, overdueTasks } = projectCard
    const totalTasks = openTasks + doneTasks

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
      <div className="bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <FolderKanban size={16} className="text-blue-600 dark:text-blue-400 shrink-0" />
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Linked Project
            </h4>
          </div>

          <Link
            href={`/projects/${project.id}`}
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            <span>Open project</span>
            <ExternalLink size={12} />
          </Link>
        </div>

        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <Link
              href={`/projects/${project.id}`}
              className="text-sm font-semibold text-slate-900 dark:text-slate-100 hover:underline truncate block"
            >
              {project.title}
            </Link>
            <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              <span className="font-medium text-slate-700 dark:text-slate-300">{stage.name}</span>
              {project.dueDate && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-1">
                    <Calendar size={11} />
                    due {formatRelativeDate(project.dueDate, today)}
                  </span>
                </>
              )}
            </div>
          </div>

          <div className="text-right shrink-0">
            {formattedBudget && (
              <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                {formattedBudget}
              </div>
            )}
            {formattedUnpaid && (
              <div className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                {formattedUnpaid} unpaid
              </div>
            )}
          </div>
        </div>

        {/* Progress & Task status */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-slate-700/60 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
          <div className="flex items-center gap-2">
            <span>
              {doneTasks}/{totalTasks} tasks done
            </span>
            {overdueTasks > 0 && (
              <span className="inline-flex items-center gap-0.5 text-red-600 dark:text-red-400 font-medium text-[11px]">
                <AlertCircle size={11} />
                {overdueTasks} overdue
              </span>
            )}
          </div>

          {project.waitingSinceDate && (
            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 text-[11px]">
              <Clock size={11} />
              Waiting on client
            </span>
          )}
        </div>
      </div>
    )
  }

  // If Won but no project yet
  if (isWon) {
    return (
      <div className="bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/40 rounded-xl p-4 text-center space-y-2">
        <div className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
          This deal is won! No project started yet.
        </div>
        <p className="text-[11px] text-slate-500 dark:text-slate-400">
          Create milestones, assign tasks, and track invoices by starting a project.
        </p>
        <button
          type="button"
          onClick={() => onStartProject?.(deal.id)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-medium transition-colors shadow-sm"
        >
          <Plus size={13} />
          <span>Start project</span>
          <kbd className="ml-1 px-1 py-0.2 bg-emerald-700 rounded text-[10px] font-mono">P</kbd>
        </button>
      </div>
    )
  }

  // Deal is in pipeline (earlier stage)
  return null
}
