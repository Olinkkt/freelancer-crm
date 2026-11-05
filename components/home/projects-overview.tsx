'use client'

import React, { useState } from 'react'
import { FolderKanban } from 'lucide-react'
import { ACTIVE_PROJECT_STAGES, Deal, cardColumn } from '@/lib/crm-types'
import { daysUntil, formatDue, normalizeDueDate } from '@/lib/due-date'

import { buildProjects, type ProjectFlag, type ProjectRow } from '@/lib/home/projects'

export { buildProjects }
export type { ProjectFlag, ProjectRow }

interface ProjectsOverviewProps {
  rows: ProjectRow[]
  onOpenDeal: (deal: Deal) => void
  onAddDeal?: () => void
}

const PROJECTS_CAP = 5

function waitingFor(deal: Deal): string {
  const diff = daysUntil(deal.waitingSince)
  if (diff === null) return 'Paused until the client replies'
  const days = -diff
  return days <= 0 ? 'Waiting since today' : `Waiting ${days} ${days === 1 ? 'day' : 'days'}`
}

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
                <span className="project-title">
                  <strong>{deal.title}</strong>
                  <em>{deal.contactName}</em>
                </span>
                <span className="project-next">
                  {deal.waiting
                    ? waitingFor(deal)
                    : deal.next
                      ? `${deal.next}${row.due ? ` · ${formatDue(row.due)}` : ''}`
                      : 'No next action'}
                </span>
              </button>

              <div className="project-stage">
                <div
                  className="project-steps"
                  role="img"
                  aria-label={`Stage ${row.stageIndex + 1} of ${ACTIVE_PROJECT_STAGES.length}: ${deal.stage}`}
                >
                  {ACTIVE_PROJECT_STAGES.map((stage, i) => (
                    <i key={stage} className={i < row.stageIndex ? 'done' : i === row.stageIndex ? 'current' : ''} />
                  ))}
                </div>
                <span>
                  {deal.stage} · {row.stageIndex + 1}/{ACTIVE_PROJECT_STAGES.length}
                </span>
              </div>

              <div className="project-stage" title={`${row.tasksDone} of ${row.tasksTotal} tasks done`}>
                <div className="project-tasks-bar">
                  <b style={{ width: `${pct}%` }} />
                </div>
                <span>{row.tasksTotal ? `${row.tasksDone}/${row.tasksTotal} tasks` : 'No tasks'}</span>
              </div>

              <div className="project-value">{deal.value}</div>

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
