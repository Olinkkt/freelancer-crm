'use client'

import React, { useState, useEffect } from 'react'
import {
  AlertTriangle,
  Calendar,
  Check,
  Clock,
  Sparkles,
  Trash2,
  X,
  Zap,
} from 'lucide-react'
import { Deal } from './types'

interface NextActionModalProps {
  isOpen: boolean
  deal: Deal | null
  onClose: () => void
  onSave: (dealId: string, action: string, dueDate: string, tone?: 'urgent' | 'normal' | 'warning') => void
  onClear?: (dealId: string) => void
  isCompletingPrevious?: boolean
}

const ACTION_PRESETS = [
  'Follow up on quote',
  'Send revised scope',
  'Prepare discovery call',
  'Share case studies',
  'Send contract & deposit invoice',
  'Review client feedback',
]

const DUE_PRESETS = [
  { label: 'Today 17:00', tone: 'urgent' as const },
  { label: 'Tomorrow 10:00', tone: 'normal' as const },
  { label: 'Tomorrow 14:30', tone: 'urgent' as const },
  { label: 'In 2 days 11:00', tone: 'normal' as const },
  { label: 'Next Monday 09:30', tone: 'normal' as const },
]

export function NextActionModal({
  isOpen,
  deal,
  onClose,
  onSave,
  onClear,
  isCompletingPrevious = false,
}: NextActionModalProps) {
  const [action, setAction] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [tone, setTone] = useState<'urgent' | 'normal' | 'warning'>('normal')

  useEffect(() => {
    if (deal) {
      if (isCompletingPrevious) {
        setAction('')
        setDueDate('Tomorrow 10:00')
        setTone('normal')
      } else {
        setAction(deal.nextAction || '')
        setDueDate(deal.nextDueDate || 'Tomorrow 10:00')
        setTone(deal.nextDueTone || (deal.nextDueDate?.toLowerCase().includes('today') ? 'urgent' : 'normal'))
      }
    }
  }, [deal, isCompletingPrevious])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen || !deal) return null

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault()
    if (!action.trim()) return
    onSave(deal.id, action.trim(), dueDate.trim() || 'Tomorrow 10:00', tone)
    onClose()
  }

  const handleClear = () => {
    if (onClear) {
      onClear(deal.id)
      onClose()
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div
        className="composer"
        style={{ width: 'min(100%, 480px)', padding: '24px 26px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div className="composer-top" style={{ marginBottom: '18px' }}>
          <div>
            <p className="section-kicker" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Zap size={13} className="text-[#c4882b]" />
              GTD Mandatory Next Action
            </p>
            <h2 style={{ fontSize: '20px' }}>
              {isCompletingPrevious
                ? 'What is the next step?'
                : deal.nextAction
                ? 'Update Next Action'
                : 'Schedule Next Action'}
            </h2>
          </div>
          <button
            className="icon-button"
            onClick={onClose}
            aria-label="Close dialog"
            type="button"
          >
            <X size={17} />
          </button>
        </div>

        {/* Deal Context Card */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            padding: '10px 14px',
            borderRadius: '9px',
            background: '#fafbfc',
            border: '1px solid #edf0f3',
            marginBottom: '16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <span
              className={`deal-avatar ${deal.color}`}
              style={{ width: '28px', height: '28px', fontSize: '11px', flexShrink: 0 }}
            >
              {deal.company.charAt(0)}
            </span>
            <div style={{ minWidth: 0, overflow: 'hidden' }}>
              <strong
                style={{
                  display: 'block',
                  fontSize: '12px',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  color: '#1c1d1f',
                }}
              >
                {deal.title}
              </strong>
              <span style={{ fontSize: '10px', color: '#9fa1a7' }}>{deal.company}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span className="stage-pill" style={{ fontSize: '9.5px', padding: '3px 7px' }}>
              {deal.stage}
            </span>
            <strong style={{ fontSize: '12px', color: '#1c1d1f' }}>{deal.value}</strong>
          </div>
        </div>

        {/* GTD Principle Callout */}
        {isCompletingPrevious ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              background: '#eef9f2',
              border: '1px solid #d4f0df',
              color: '#2e7d52',
              fontSize: '11px',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            <Check size={14} style={{ marginTop: '2px', flexShrink: 0 }} />
            <span>
              <strong>Previous action completed!</strong> In GTD, an active deal must always have a scheduled next step so it never stalls.
            </span>
          </div>
        ) : !deal.nextAction ? (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: '8px',
              padding: '9px 12px',
              borderRadius: '8px',
              background: '#fff8ee',
              border: '1px solid #fae8c3',
              color: '#a36814',
              fontSize: '11px',
              marginBottom: '16px',
              lineHeight: 1.4,
            }}
          >
            <AlertTriangle size={14} style={{ marginTop: '2px', flexShrink: 0, color: '#c4882b' }} />
            <span>
              <strong>No next step set:</strong> This deal is currently stalled. Specify a concrete task and deadline to keep momentum.
            </span>
          </div>
        ) : null}

        <form onSubmit={handleSave}>
          {/* Action Input */}
          <label style={{ marginBottom: '14px' }}>
            Next Action
            <input
              type="text"
              value={action}
              onChange={(e) => setAction(e.target.value)}
              placeholder="e.g. Send revised scope — Tomorrow 14:30"
              autoFocus
              style={{ marginTop: '6px' }}
            />
          </label>

          {/* Action Presets */}
          <div style={{ marginBottom: '16px' }}>
            <span
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 600,
                color: '#8f99a8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '7px',
              }}
            >
              Quick Presets (1-Click)
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {ACTION_PRESETS.map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => setAction(preset)}
                  style={{
                    border: '1px solid #edf0f3',
                    background: action === preset ? '#f1f5ff' : '#fafbfc',
                    borderColor: action === preset ? '#bad0fa' : '#e4e7ec',
                    color: action === preset ? '#266df0' : '#505967',
                    fontWeight: action === preset ? 600 : 500,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* Due Date & Time */}
          <label style={{ marginBottom: '14px' }}>
            Due Date & Time
            <div style={{ position: 'relative', marginTop: '6px' }}>
              <input
                type="text"
                value={dueDate}
                onChange={(e) => {
                  setDueDate(e.target.value)
                  if (e.target.value.toLowerCase().includes('today')) {
                    setTone('urgent')
                  } else {
                    setTone('normal')
                  }
                }}
                placeholder="e.g. Tomorrow 14:30"
                style={{ paddingLeft: '32px' }}
              />
              <Clock
                size={14}
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#9fa1a7',
                  pointerEvents: 'none',
                }}
              />
            </div>
          </label>

          {/* Due Date Presets */}
          <div style={{ marginBottom: '22px' }}>
            <span
              style={{
                display: 'block',
                fontSize: '10px',
                fontWeight: 600,
                color: '#8f99a8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '7px',
              }}
            >
              Quick Deadlines
            </span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {DUE_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setDueDate(preset.label)
                    setTone(preset.tone)
                  }}
                  style={{
                    border: '1px solid #edf0f3',
                    background: dueDate === preset.label ? '#fff8ee' : '#fafbfc',
                    borderColor: dueDate === preset.label ? '#fae8c3' : '#e4e7ec',
                    color: dueDate === preset.label ? '#c4882b' : '#505967',
                    fontWeight: dueDate === preset.label ? 600 : 500,
                    borderRadius: '6px',
                    padding: '4px 8px',
                    fontSize: '11px',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* Actions Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: deal.nextAction && onClear ? 'space-between' : 'flex-end',
              gap: '10px',
              paddingTop: '16px',
              borderTop: '1px solid #f0f1f3',
            }}
          >
            {deal.nextAction && onClear ? (
              <button
                type="button"
                onClick={handleClear}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: 0,
                  background: 'transparent',
                  color: '#c4882b',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 8px',
                }}
                title="Clearing action flags this deal as stalled (⚠️ No next step set)"
              >
                <Trash2 size={13} />
                Clear action
              </button>
            ) : null}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="select-button" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                disabled={!action.trim()}
                style={{ minHeight: '36px', padding: '0 16px', opacity: !action.trim() ? 0.5 : 1 }}
              >
                Save next action
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
