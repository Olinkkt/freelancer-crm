'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import {
  ExternalLink,
  Clock,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  Edit2,
  RotateCcw,
  Sparkles,
} from 'lucide-react'
import type { ProjectDetail } from '@/lib/projects/types'
import { formatMinor } from '@/lib/projects/money'
import { formatRelativeDate, diffDays, localToday } from '@/lib/projects/dates'
import { revisionRoundLabel, isRoundOverScope } from '@/lib/projects/ui-helpers'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'
import { OPERATOR_CONFIG } from '@/lib/config'

interface ProjectHeaderProps {
  detail: ProjectDetail
  onMoveStage: (stageId: string) => void
  onToggleWaiting: () => void
  onOpenFeedback: () => void
  onOpenCloseDialog: () => void
  onOpenEdit: () => void
  onReopen: () => void
}

export function ProjectHeader({
  detail,
  onMoveStage,
  onToggleWaiting,
  onOpenFeedback,
  onOpenCloseDialog,
  onOpenEdit,
  onReopen,
}: ProjectHeaderProps) {
  const { project, stages, card, deal } = detail
  const [isStageMenuOpen, setIsStageMenuOpen] = useState(false)
  const isClosed = stages.find((s) => s.id === project.stageId)?.category === 'closed'
  const today = localToday()

  // Shortcuts: [ and ] move stage
  const currentStageIndex = stages.findIndex((s) => s.id === project.stageId)
  useShortcut(
    'project.stagePrev',
    () => {
      if (isClosed) {
        onReopen()
      } else if (currentStageIndex > 0) {
        onMoveStage(stages[currentStageIndex - 1].id)
      }
    },
    { enabled: true }
  )

  useShortcut(
    'project.stageNext',
    () => {
      if (currentStageIndex >= 0 && currentStageIndex < stages.length - 1) {
        onMoveStage(stages[currentStageIndex + 1].id)
      } else if (!isClosed) {
        onOpenCloseDialog()
      }
    },
    { enabled: !isClosed }
  )

  useShortcut('project.logFeedback', onOpenFeedback, { enabled: !isClosed })
  useShortcut('project.close', onOpenCloseDialog, { enabled: !isClosed })
  useShortcut('project.edit', onOpenEdit, { enabled: true })
  useShortcut('project.toggleWaiting', onToggleWaiting, { enabled: !isClosed })

  // Stage details
  const currentStage = stages.find((s) => s.id === project.stageId) || stages[0]

  // Revision round
  const maxRevisionRound = Math.max(
    0,
    ...detail.tasks.map((t) => t.revisionRound || 0)
  )
  const hasRevisions = maxRevisionRound > 0 || project.revisionsIncluded !== null
  const round = maxRevisionRound > 0 ? maxRevisionRound : 1
  const roundLabel = revisionRoundLabel(round, project.revisionsIncluded)
  const isOverScope = isRoundOverScope(round, project.revisionsIncluded)

  // Timeline & Days left
  const daysLeft = project.dueDate ? diffDays(today, project.dueDate) : null

  // Money formatting
  const formattedBudget = project.budgetMinor
    ? formatMinor(project.budgetMinor, project.currency, {
        currency: project.currency,
        currencySymbol: project.currency === 'EUR' ? '€' : '$',
        locale: OPERATOR_CONFIG.locale || 'en-US',
      })
    : null

  const billingLabel =
    project.billingType === 'fixed'
      ? 'Fixed'
      : project.billingType === 'hourly'
      ? 'Hourly'
      : 'Retainer'

  return (
    <div className="space-y-3">
      {/* Breadcrumb & Global Actions */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 font-medium">
          <Link
            href="/?view=projects"
            className="hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
          >
            Projects
          </Link>
          <span>›</span>
          <span className="text-slate-900 dark:text-slate-100 font-semibold truncate max-w-[200px] sm:max-w-md">
            {project.title}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isClosed ? (
            <>
              <button
                type="button"
                onClick={onOpenFeedback}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Log client feedback (R)"
              >
                <span>Feedback</span>
                <kbd className="px-1 py-0.2 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">
                  R
                </kbd>
              </button>
              <button
                type="button"
                onClick={onOpenCloseDialog}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer"
                title="Close project (Shift+C)"
              >
                <span>Close</span>
                <kbd className="px-1 py-0.2 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-300 dark:border-slate-600">
                  ⇧C
                </kbd>
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onReopen}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-md bg-emerald-600 text-white hover:bg-emerald-500 transition-colors cursor-pointer shadow-sm"
              title="Reopen project ([)"
            >
              <RotateCcw size={12} />
              <span>Reopen project</span>
              <kbd className="px-1 py-0.2 text-[9px] font-mono bg-emerald-700 rounded border border-emerald-500">
                [
              </kbd>
            </button>
          )}
        </div>
      </div>

      {/* Closed Banner */}
      {isClosed && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span className="font-semibold">
              Closed {project.closeOutcome ? `· ${project.closeOutcome}` : ''}{' '}
              {project.closedAt ? `on ${project.closedAt.slice(0, 10)}` : ''}
            </span>
            {project.closeReason && (
              <span className="text-emerald-700 dark:text-emerald-400">({project.closeReason})</span>
            )}
          </div>
          <span className="text-[11px] text-emerald-600 dark:text-emerald-400 hidden sm:inline">
            Read-only mode
          </span>
        </div>
      )}

      {/* Main Header Card */}
      <div className="p-4 rounded-xl bg-white dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/80 shadow-sm space-y-3">
        {/* Top Row: Title, Stage pill, Client Info */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white tracking-tight">
              {project.title}
            </h1>

            {/* Stage Pill Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => !isClosed && setIsStageMenuOpen(!isStageMenuOpen)}
                disabled={isClosed}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-700/60 text-slate-800 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer disabled:cursor-default"
                title="Stage selector ([ and ])"
              >
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: currentStage.color || '#3b82f6' }}
                />
                <span>{currentStage.name}</span>
                {!isClosed && <ChevronDown size={12} className="opacity-70" />}
              </button>

              {isStageMenuOpen && (
                <div
                  className="absolute left-0 mt-1 w-48 py-1 bg-white dark:bg-slate-800 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 z-50 text-xs"
                  onMouseLeave={() => setIsStageMenuOpen(false)}
                >
                  {stages.map((stage) => (
                    <button
                      key={stage.id}
                      type="button"
                      onClick={() => {
                        onMoveStage(stage.id)
                        setIsStageMenuOpen(false)
                      }}
                      className="w-full text-left px-3 py-1.5 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2 h-2 rounded-full"
                          style={{ backgroundColor: stage.color || '#3b82f6' }}
                        />
                        <span>{stage.name}</span>
                      </div>
                      {stage.id === project.stageId && (
                        <CheckCircle2 size={12} className="text-blue-500" />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Stage Move Hint */}
            {!isClosed && (
              <span className="hidden md:inline-flex items-center gap-1 text-[11px] text-slate-400 dark:text-slate-500">
                <kbd className="px-1 text-[10px] font-mono bg-slate-100 dark:bg-slate-750 rounded border border-slate-200 dark:border-slate-700">
                  [
                </kbd>
                <kbd className="px-1 text-[10px] font-mono bg-slate-100 dark:bg-slate-750 rounded border border-slate-200 dark:border-slate-700">
                  ]
                </kbd>
              </span>
            )}

            {/* Waiting on client badge */}
            {card.waitingDays !== null && (
              <span
                onClick={onToggleWaiting}
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/50 cursor-pointer hover:bg-amber-100 transition-colors"
                title="Toggle waiting on client (W)"
              >
                <Clock size={11} />
                <span>
                  Waiting on client · {card.waitingDays} day{card.waitingDays === 1 ? '' : 's'}
                </span>
              </span>
            )}
          </div>

          {/* Client & Contact line: Contact email shows only when stored; no placeholder values anywhere */}
          <div className="text-xs text-slate-600 dark:text-slate-300 flex items-center gap-1.5 flex-wrap">
            <span className="font-semibold text-slate-800 dark:text-slate-100">
              {project.company}
            </span>
            {project.contactName && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <span>{project.contactName}</span>
              </>
            )}
            {project.contactEmail && (
              <>
                <span className="text-slate-300 dark:text-slate-600">·</span>
                <a
                  href={`mailto:${project.contactEmail}`}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  {project.contactEmail}
                </a>
              </>
            )}
          </div>
        </div>

        {/* Bottom Row: Metadata info */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 pt-1 border-t border-slate-100 dark:border-slate-750">
          <span>{billingLabel}</span>
          {formattedBudget && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">
                {formattedBudget}
              </span>
            </>
          )}

          {project.startDate && project.dueDate && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span>
                {project.startDate} → {project.dueDate}
                {daysLeft !== null && (
                  <span className={daysLeft < 0 ? 'text-red-500 font-medium ml-1' : 'ml-1'}>
                    ({daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : `${daysLeft} days left`})
                  </span>
                )}
              </span>
            </>
          )}

          {hasRevisions && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span
                className={`inline-flex items-center gap-1 font-medium ${
                  isOverScope
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-slate-700 dark:text-slate-200'
                }`}
              >
                <span>{roundLabel}</span>
                {isOverScope && <span className="text-[10px]">(over scope)</span>}
              </span>
            </>
          )}

          {deal && (
            <>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <Link
                href={`/deals/${deal.id}`}
                className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
              >
                <span>Deal</span>
                <ExternalLink size={10} />
              </Link>
            </>
          )}

          <button
            type="button"
            onClick={onOpenEdit}
            className="ml-auto inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer text-xs"
            title="Edit project details (Shift+P)"
          >
            <Edit2 size={11} />
            <span>Edit</span>
            <kbd className="px-1 text-[9px] font-mono bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600">
              ⇧P
            </kbd>
          </button>
        </div>
      </div>
    </div>
  )
}
