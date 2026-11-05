'use client'

import React from 'react'
import { Check, Clock, AlertCircle, Inbox, Edit3, Trash2 } from 'lucide-react'
import { RowActionMenu } from '@/components/ui/row-action-menu'
import { Deal, FollowUpItem, isPmStage } from '@/lib/crm-types'
import { daysUntil, formatDue, normalizeDueDate } from '@/lib/due-date'

type TodayItem =
  | { kind: 'deal'; key: string; deal: Deal; title: string; detail: string; tone: 'overdue' | 'today' | 'muted' }
  | { kind: 'followUp'; key: string; followUp: FollowUpItem; title: string; detail: string; tone: 'overdue' | 'today' | 'muted' }

export interface TodayGroups {
  due: TodayItem[]
  waiting: TodayItem[]
  needsYou: TodayItem[]
}

const openMaterials = (d: Deal) =>
  (d.deliverables ?? []).filter((i) => i.section === 'podklady' && i.status !== 'Done')

/**
 * Today = what to act on now.
 * - Due: next actions / follow-ups due today or overdue.
 * - Waiting on client: signed deals with client materials still missing.
 * - Needs you: deals missing a next action or due date (GTD rule), undated follow-ups.
 * A deal shows up once, in the first group that fits.
 */
export function buildToday(deals: Deal[], followUps: FollowUpItem[], completedFollowUps: string[], now = new Date()): TodayGroups {
  const due: TodayItem[] = []
  const waiting: TodayItem[] = []
  const needsYou: TodayItem[] = []
  const dueRank = new Map<string, number>()

  for (const deal of deals) {
    if (deal.waiting) {
      waiting.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail: 'Waiting on client',
        tone: 'muted',
      })
      continue
    }
    const diff = daysUntil(deal.nextDueDate, now)
    if (deal.next && diff !== null && diff <= 0) {
      due.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.next,
        detail: `${deal.title} · ${deal.stage}`,
        tone: diff < 0 ? 'overdue' : 'today',
      })
      dueRank.set(deal.id, diff)
      continue
    }
    const missing = openMaterials(deal)
    if (isPmStage(deal.stage) && (deal.stage === 'Materials' || missing.length > 0)) {
      waiting.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail:
          missing.length > 0
            ? `${missing.length} material${missing.length === 1 ? '' : 's'} missing: ${missing
                .slice(0, 2)
                .map((i) => i.title)
                .join(', ')}${missing.length > 2 ? '…' : ''}`
            : 'Waiting on client materials',
        tone: 'muted',
      })
      continue
    }
    if (!deal.next || !deal.nextDueDate) {
      needsYou.push({
        kind: 'deal',
        key: deal.id,
        deal,
        title: deal.title,
        detail: !deal.next ? `${deal.stage} · no next action` : `${deal.stage} · “${deal.next}” has no due date`,
        tone: 'muted',
      })
    }
  }

  for (const f of followUps) {
    if (completedFollowUps.includes(f.id)) continue
    const iso = normalizeDueDate(f.time, now) ?? (f.day?.toLowerCase() === 'today' ? normalizeDueDate('today', now) : null)
    const diff = daysUntil(iso, now)
    const base = { kind: 'followUp' as const, key: f.id, followUp: f, title: f.action, detail: f.company }
    if (diff === null) {
      needsYou.push({ ...base, detail: `${f.company} · no date`, tone: 'muted' })
    } else if (diff <= 0) {
      due.push({ ...base, tone: diff < 0 ? 'overdue' : 'today' })
      dueRank.set(f.id, diff)
    }
  }

  due.sort((a, b) => (dueRank.get(a.key) ?? 0) - (dueRank.get(b.key) ?? 0))
  return { due, waiting, needsYou }
}

interface TodayListProps {
  groups: TodayGroups
  onOpenDeal: (deal: Deal) => void
  onToggleFollowUp: (id: string) => void
  onEditFollowUp: (followUp: FollowUpItem) => void
  onDeleteFollowUp: (id: string) => void
  onAddDeal: () => void
}

export function TodayList({
  groups,
  onOpenDeal,
  onToggleFollowUp,
  onEditFollowUp,
  onDeleteFollowUp,
  onAddDeal,
}: TodayListProps) {
  const sections: { key: keyof TodayGroups; title: string; empty: string; icon: typeof Clock }[] = [
    { key: 'due', title: 'Due', empty: 'Nothing due today.', icon: Clock },
    { key: 'waiting', title: 'Waiting on client', empty: 'Not waiting on anyone.', icon: Inbox },
    { key: 'needsYou', title: 'Needs you', empty: 'Every deal has a dated next action.', icon: AlertCircle },
  ]
  const total = groups.due.length + groups.waiting.length + groups.needsYou.length

  return (
    <section className="panel today-panel" aria-label="Today">
      {total === 0 ? (
        <div className="py-10 text-center">
          <div className="w-9 h-9 rounded-full bg-[#f4f5f6] flex items-center justify-center mx-auto mb-2">
            <Check size={17} className="text-[#43a878]" />
          </div>
          <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">All clear</h3>
          <p className="text-[11px] text-[#8f99a8] mb-3">Nothing due, nothing waiting, nothing missing.</p>
          <button type="button" className="text-button mx-auto" onClick={onAddDeal}>
            Add a deal
          </button>
        </div>
      ) : (
        sections.map(({ key, title, empty, icon: Icon }) => {
          const items = groups[key]
          return (
            <div key={key} className="today-group">
              <div className="today-group-head">
                <Icon size={14} />
                <h2>{title}</h2>
                <span className="font-mono">{items.length}</span>
              </div>
              {items.length === 0 ? (
                <p className="today-empty">{empty}</p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <li key={item.key} className="followup-row today-row">
                      {item.kind === 'followUp' ? (
                        <button
                          type="button"
                          className="check-button"
                          aria-label={`Mark ${item.title} complete`}
                          onClick={() => onToggleFollowUp(item.followUp.id)}
                        />
                      ) : (
                        <span className={`deal-avatar shrink-0 ${item.deal.color}`}>{item.deal.contactName.charAt(0)}</span>
                      )}
                      <button
                        type="button"
                        className="today-row-main"
                        disabled={item.kind !== 'deal'}
                        onClick={() => item.kind === 'deal' && onOpenDeal(item.deal)}
                      >
                        <strong>{item.title}</strong>
                        <span>{item.detail}</span>
                      </button>
                      {item.kind === 'deal' && item.deal.nextDueDate && key === 'due' && (
                        <time className={item.tone === 'overdue' ? 'text-[#d92d20] font-semibold' : ''}>
                          {formatDue(item.deal.nextDueDate)}
                        </time>
                      )}
                      {item.kind === 'followUp' && key === 'due' && (
                        <time className={item.tone === 'overdue' ? 'text-[#d92d20] font-semibold' : ''}>
                          {formatDue(normalizeDueDate(item.followUp.time) ?? item.followUp.time)}
                        </time>
                      )}
                      {item.kind === 'followUp' && (
                        <RowActionMenu
                          triggerLabel={`Options for ${item.title}`}
                          items={[
                            { label: 'Edit follow-up', icon: Edit3, onClick: () => onEditFollowUp(item.followUp) },
                            { label: 'Mark complete', icon: Check, onClick: () => onToggleFollowUp(item.followUp.id) },
                            {
                              label: 'Delete follow-up',
                              icon: Trash2,
                              destructive: true,
                              divider: true,
                              onClick: () => onDeleteFollowUp(item.followUp.id),
                            },
                          ]}
                        />
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })
      )}
    </section>
  )
}
