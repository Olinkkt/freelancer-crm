'use client'

import React from 'react'
import { ArrowUpRight, CalendarDays, Clock, FolderKanban, WalletCards } from 'lucide-react'
import { DEAL_STAGES, ACTIVE_PROJECT_STAGES, OPEN_DEAL_STAGES, Deal, DealStage } from '@/lib/crm-types'
import { daysUntil } from '@/lib/due-date'
import { formatMoney } from '@/lib/config'
import type { WorkspaceSettings } from '@/lib/crm-types'

const amountOf = (d: Deal) => d.rawAmount || parseInt(d.value.replace(/[^0-9]/g, '')) || 0

export interface StageSummary {
  stage: DealStage
  count: number
  amount: number
  group: 'Sales' | 'Delivery'
}

export interface Overview {
  openCount: number
  pipelineValue: number
  activeProjects: number
  toCollect: number
  invoicesOpen: number
  invoicesOverdue: number
  stages: StageSummary[]
}

/** Numbers for the Home metric cards and the pipeline panel. */
export function buildOverview(deals: Deal[], now = new Date()): Overview {
  const open = deals.filter((d) => OPEN_DEAL_STAGES.includes(d.stage))
  let toCollect = 0
  let invoicesOpen = 0
  let invoicesOverdue = 0

  for (const d of deals) {
    if (!ACTIVE_PROJECT_STAGES.includes(d.stage)) continue
    for (const inv of d.invoices ?? []) {
      if (inv.status !== 'Sent' && inv.status !== 'Overdue') continue
      toCollect += inv.amount
      invoicesOpen += 1
      const diff = daysUntil(inv.dueDate, now)
      if (inv.status === 'Overdue' || (diff !== null && diff < 0)) invoicesOverdue += 1
    }
  }

  return {
    openCount: open.length,
    pipelineValue: open.reduce((sum, d) => sum + amountOf(d), 0),
    activeProjects: deals.filter((d) => ACTIVE_PROJECT_STAGES.includes(d.stage)).length,
    toCollect,
    invoicesOpen,
    invoicesOverdue,
    stages: DEAL_STAGES.map((stage) => {
      const inStage = deals.filter((d) => d.stage === stage)
      return {
        stage,
        count: inStage.length,
        amount: inStage.reduce((sum, d) => sum + amountOf(d), 0),
        group: OPEN_DEAL_STAGES.includes(stage) ? 'Sales' : 'Delivery',
      }
    }),
  }
}

interface MetricCardsProps {
  overview: Overview
  dueToday: number
  overdue: number
  settings: WorkspaceSettings
}

export function MetricCards({ overview, dueToday, overdue, settings }: MetricCardsProps) {
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`
  return (
    <section className="metric-grid" aria-label="Summary metrics">
      <div className="metric-card">
        <div className="metric-icon dark">
          <WalletCards size={18} />
        </div>
        <span className="metric-label">Open pipeline</span>
        <strong className="font-mono tabular-nums">{formatMoney(overview.pipelineValue, settings)}</strong>
        <small>{overview.openCount === 0 ? 'No open deals' : plural(overview.openCount, 'open deal')}</small>
      </div>

      <div className="metric-card">
        <div className="metric-icon green">
          <FolderKanban size={18} />
        </div>
        <span className="metric-label">Active projects</span>
        <strong>{overview.activeProjects}</strong>
        <small>{overview.activeProjects === 0 ? 'Nothing in delivery' : 'In delivery'}</small>
      </div>

      <div className="metric-card">
        <div className="metric-icon blue">
          <CalendarDays size={18} />
        </div>
        <span className="metric-label">To collect</span>
        <strong className="font-mono tabular-nums">{formatMoney(overview.toCollect, settings)}</strong>
        <small>
          {overview.invoicesOverdue > 0 ? (
            <span className="warning">{overview.invoicesOverdue} overdue</span>
          ) : overview.invoicesOpen > 0 ? (
            plural(overview.invoicesOpen, 'unpaid invoice')
          ) : (
            'No unpaid invoices'
          )}
        </small>
      </div>

      <div className="metric-card">
        <div className="metric-icon amber">
          <Clock size={18} />
        </div>
        <span className="metric-label">Due today</span>
        <strong>{dueToday}</strong>
        <small>
          {overdue > 0 ? <span className="warning">{overdue} overdue</span> : dueToday > 0 ? 'Keep momentum' : 'All caught up'}
        </small>
      </div>
    </section>
  )
}

interface PipelinePanelProps {
  overview: Overview
  settings: WorkspaceSettings
  onOpenDeals: () => void
}

export function PipelinePanel({ overview, settings, onOpenDeals }: PipelinePanelProps) {
  const max = Math.max(1, ...overview.stages.map((s) => s.count))
  const groups: ('Sales' | 'Delivery')[] = ['Sales', 'Delivery']
  let dot = 0

  return (
    <section className="panel pipeline-panel" aria-label="Pipeline">
      <div className="panel-heading">
        <div>
          <p className="section-kicker">Sales to delivery</p>
          <h2>Pipeline</h2>
        </div>
        <button className="text-button" onClick={onOpenDeals}>
          All deals <ArrowUpRight size={14} />
        </button>
      </div>

      {groups.map((group) => (
        <div key={group} className="pipeline-list">
          <p className="pipeline-group">{group}</p>
          {overview.stages
            .filter((s) => s.group === group)
            .map((s) => (
              <button type="button" className="pipeline-row pipeline-row-button" key={s.stage} onClick={onOpenDeals}>
                <span className="pipeline-name">
                  <span className={`stage-dot dot-${(dot++ % 5) + 1}`} />
                  <strong>{s.stage}</strong>
                </span>
                <span className="pipeline-bar">
                  <span style={{ width: s.count > 0 ? `${Math.max(12, (s.count / max) * 100)}%` : '0%' }} />
                </span>
                <span className="pipeline-count">{s.count}</span>
                <span className="pipeline-amount font-mono tabular-nums">{formatMoney(s.amount, settings)}</span>
              </button>
            ))}
        </div>
      ))}
    </section>
  )
}
