'use client'

import React, { useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { ACTIVE_PROJECT_STAGES, Deal, cardColumn } from '@/lib/crm-types'
import { daysUntil, formatDue, normalizeDueDate } from '@/lib/due-date'

export type ProjectFlag = 'blocked' | 'invoice' | 'late' | 'waiting' | null

export interface ProjectRow {
  deal: Deal
  /** Index in ACTIVE_PROJECT_STAGES */
  stageIndex: number
  tasksDone: number
  tasksTotal: number
  flag: ProjectFlag
  flagLabel: string
  /** Soonest date that matters (next action, else end date), ISO */
  due: string | null
}

const toMs = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Overview of projects being delivered, most-urgent first. */
export function buildProjects(deals: Deal[], now = new Date()): ProjectRow[] {
  const rows: ProjectRow[] = []

  for (const deal of deals) {
    const stageIndex = ACTIVE_PROJECT_STAGES.indexOf(deal.stage)
    if (stageIndex === -1) continue

    // Client materials ('podklady') are tracked in the waiting group, not as project tasks.
    const tasks = (deal.deliverables ?? []).filter((i) => i.section !== 'podklady')
    const tasksDone = tasks.filter((i) => i.status === 'Done').length
    const blocked = tasks.filter((i) => cardColumn(i) === 'blocked').length
    const overdueInvoices = (deal.invoices ?? []).filter((inv) => {
      if (inv.status === 'Overdue') return true
      if (inv.status !== 'Sent') return false
      const d = daysUntil(inv.dueDate, now)
      return d !== null && d < 0
    }).length

    const end = normalizeDueDate(deal.endDate, now)
    const nextDue = deal.waiting ? null : normalizeDueDate(deal.nextDueDate, now)
    const due = nextDue ?? end
    const dueDiff = daysUntil(nextDue, now)
    const endDiff = daysUntil(end, now)

    let flag: ProjectFlag = null
    let flagLabel = ''
    if (blocked > 0) {
      flag = 'blocked'
      flagLabel = `${blocked} blocked`
    } else if (overdueInvoices > 0) {
      flag = 'invoice'
      flagLabel = 'Invoice overdue'
    } else if ((dueDiff !== null && dueDiff < 0) || (endDiff !== null && endDiff < 0)) {
      flag = 'late'
      flagLabel = 'Late'
    } else if (deal.waiting) {
      flag = 'waiting'
      flagLabel = 'Waiting on client'
    }

    rows.push({ deal, stageIndex, tasksDone, tasksTotal: tasks.length, flag, flagLabel, due })
  }

  // Needs attention first, waiting-on-client last, soonest date first inside each group.
  const rank = (r: ProjectRow) => (r.flag === 'waiting' ? 2 : r.flag ? 0 : 1)
  rows.sort((a, b) => {
    const byRank = rank(a) - rank(b)
    if (byRank) return byRank
    const da = a.due ? toMs(a.due) : Infinity
    const db = b.due ? toMs(b.due) : Infinity
    if (da !== db) return da < db ? -1 : 1
    return a.deal.title.localeCompare(b.deal.title)
  })
  return rows
}

interface ProjectsOverviewProps {
  rows: ProjectRow[]
  onOpenDeal: (deal: Deal) => void
  onAddDeal?: () => void
}

const PROJECTS_CAP = 5

export function ProjectsOverview({ rows, onOpenDeal, onAddDeal }: ProjectsOverviewProps) {
  const [showAll, setShowAll] = useState(false)
  const visibleRows = showAll ? rows : rows.slice(0, PROJECTS_CAP)
  const hidden = rows.length - visibleRows.length
  return (
    <section className="panel projects-panel" aria-label="Active projects">
      <div className="today-group-head">
        <FolderKanban size={14} />
        <h2>Projects</h2>
        <span className="font-mono">{rows.length}</span>
      </div>
      {rows.length === 0 && (
        <div className="home-empty">
          <p className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No active projects</p>
          <p className="text-[11px] text-[#8f99a8] mb-3">A deal appears here once the contract is signed.</p>
          {onAddDeal && (
            <button type="button" className="text-button mx-auto" onClick={onAddDeal}>
              + New deal
            </button>
          )}
        </div>
      )}
      <ul>
        {visibleRows.map((row) => {
          const { deal } = row
          const pct = row.tasksTotal ? Math.round((row.tasksDone / row.tasksTotal) * 100) : 0
          return (
            <li key={deal.id} className="project-row">
              <button type="button" className="project-main" onClick={() => onOpenDeal(deal)}>
                <strong>{deal.title}</strong>
                <span>
                  {deal.stage}
                  {row.due ? ` · ${formatDue(row.due)}` : ''}
                </span>
              </button>

              <div
                className="project-steps"
                role="img"
                aria-label={`Stage ${row.stageIndex + 1} of ${ACTIVE_PROJECT_STAGES.length}: ${deal.stage}`}
              >
                {ACTIVE_PROJECT_STAGES.map((stage, i) => (
                  <i key={stage} className={i < row.stageIndex ? 'done' : i === row.stageIndex ? 'current' : ''} />
                ))}
              </div>

              <div className="project-tasks" title={`${row.tasksDone} of ${row.tasksTotal} tasks done`}>
                {row.tasksTotal ? (
                  <>
                    <div className="project-tasks-bar">
                      <b style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-mono">
                      {row.tasksDone}/{row.tasksTotal}
                    </span>
                  </>
                ) : (
                  <span className="project-none">No tasks</span>
                )}
              </div>

              <div className="project-flag">
                {row.flag && <span className={`project-flag-pill ${row.flag}`}>{row.flagLabel}</span>}
              </div>
            </li>
          )
        })}
      </ul>
      {rows.length > PROJECTS_CAP && (
        <button type="button" className="home-more" onClick={() => setShowAll((v) => !v)}>
          {showAll ? 'Show less' : `+${hidden} more`}
        </button>
      )}
    </section>
  )
}
