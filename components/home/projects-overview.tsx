'use client'

import React from 'react'
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
  start: string | null
  end: string | null
}

const DAY = 86400000
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

    const start = normalizeDueDate(deal.startDate, now) ?? normalizeDueDate(deal.createdAt, now)
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

    rows.push({ deal, stageIndex, tasksDone, tasksTotal: tasks.length, flag, flagLabel, due, start, end })
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

interface Axis {
  from: number
  to: number
  today: number
}

/** One shared time axis so bars are comparable across projects. */
export function buildAxis(rows: ProjectRow[], now = new Date()): Axis {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  let from = today - 7 * DAY
  let to = today + 21 * DAY
  for (const r of rows) {
    if (r.start) from = Math.min(from, toMs(r.start))
    if (r.end) to = Math.max(to, toMs(r.end))
  }
  return { from, to, today }
}

/** Bar position in % of the axis. Without an end date the bar runs start → today. */
export function barSpan(row: ProjectRow, axis: Axis): { left: number; width: number; open: boolean } | null {
  if (!row.start && !row.end) return null
  const span = axis.to - axis.from
  const startMs = row.start ? toMs(row.start) : toMs(row.end!) - 7 * DAY
  const endMs = row.end ? toMs(row.end) : axis.today
  const left = ((startMs - axis.from) / span) * 100
  const width = Math.max(((Math.max(endMs, startMs) - startMs) / span) * 100, 1.5)
  return { left, width, open: !row.end }
}

interface ProjectsOverviewProps {
  rows: ProjectRow[]
  onOpenDeal: (deal: Deal) => void
}

export function ProjectsOverview({ rows, onOpenDeal }: ProjectsOverviewProps) {
  if (rows.length === 0) return null
  const axis = buildAxis(rows)
  const todayLeft = ((axis.today - axis.from) / (axis.to - axis.from)) * 100

  return (
    <section className="panel projects-panel" aria-label="Active projects">
      <div className="today-group-head">
        <FolderKanban size={14} />
        <h2>Active projects</h2>
        <span className="font-mono">{rows.length}</span>
      </div>
      <ul>
        {rows.map((row) => {
          const { deal } = row
          const bar = barSpan(row, axis)
          const pct = row.tasksTotal ? Math.round((row.tasksDone / row.tasksTotal) * 100) : 0
          return (
            <li key={deal.id} className="project-row">
              <button type="button" className="project-main" onClick={() => onOpenDeal(deal)}>
                <strong>{deal.title}</strong>
                <span>
                  {deal.contactName} · {deal.stage}
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

              <div className="project-timeline" aria-hidden={!bar}>
                {bar ? (
                  <>
                    <span
                      className={`project-bar${bar.open ? ' open' : ''}${row.flag === 'late' || row.flag === 'blocked' || row.flag === 'invoice' ? ' alert' : ''}`}
                      style={{ left: `${bar.left}%`, width: `${bar.width}%` }}
                    />
                    <span className="project-today" style={{ left: `${todayLeft}%` }} />
                  </>
                ) : (
                  <span className="project-none">No dates</span>
                )}
              </div>

              <div className="project-flag">
                {row.flag && <span className={`project-flag-pill ${row.flag}`}>{row.flagLabel}</span>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
