'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { AlignLeft, Check, ChevronDown, X } from 'lucide-react'
import { BOARD_COLUMNS, BoardColumnId, DeliverableItem, cardColumn } from '@/lib/crm-types'

interface TaskModalProps {
  card: DeliverableItem | null
  onClose: () => void
  onChange: (patch: Partial<DeliverableItem>) => void
  onMove: (column: BoardColumnId) => void
}

/** Card details: column, title and a markdown description. */
export function TaskModal({ card, onClose, onChange, onMove }: TaskModalProps) {
  const [title, setTitle] = useState('')
  const [editing, setEditing] = useState(false)
  const [desc, setDesc] = useState('')
  const cardId = card?.id
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!card) return
    setTitle(card.title)
    setDesc(card.description ?? '')
    setEditing(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cardId])

  useEffect(() => {
    if (!cardId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [cardId])

  if (!card) return null
  const col = cardColumn(card)
  const isDone = col === 'done'

  const commitTitle = () => {
    const t = title.trim()
    if (!t) return setTitle(card.title)
    if (t !== card.title) onChange({ title: t })
  }
  const saveDesc = () => {
    onChange({ description: desc.trim() || undefined })
    setEditing(false)
  }

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div className="notes-modal-panel task-modal" role="dialog" aria-label={card.title} onClick={(e) => e.stopPropagation()}>
        <div className="task-modal-head">
          <label className="task-col-select">
            <select value={col} onChange={(e) => onMove(e.target.value as BoardColumnId)} aria-label="Column">
              {BOARD_COLUMNS.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown size={12} />
          </label>
          <button type="button" className="task-modal-close" onClick={onClose} aria-label="Close">
            <X size={15} />
          </button>
        </div>

        <div className="task-modal-body">
          <div className="task-title-row">
            <button
              type="button"
              className={`board-check lg ${isDone ? 'on' : ''}`}
              aria-label={isDone ? 'Mark as to do' : 'Mark as done'}
              onClick={() => onMove(isDone ? 'todo' : 'done')}
            >
              <Check size={13} strokeWidth={3} />
            </button>
            <input
              className="task-title-input"
              value={title}
              maxLength={200}
              aria-label="Title"
              onChange={(e) => setTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget.blur())}
            />
          </div>

          <div className="task-desc-head">
            <span>
              <AlignLeft size={15} /> Description
            </span>
            {!editing && desc.trim() && (
              <button type="button" className="task-edit-btn" onClick={() => setEditing(true)}>
                Edit
              </button>
            )}
          </div>

          {editing ? (
            <div className="task-desc-edit">
              <textarea
                autoFocus
                value={desc}
                rows={8}
                placeholder="Add a more detailed description… (Markdown supported)"
                onChange={(e) => setDesc(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault()
                    saveDesc()
                  }
                }}
              />
              <div className="board-add-actions">
                <button type="button" className="board-add-submit" onClick={saveDesc}>
                  Save
                </button>
                <button
                  type="button"
                  className="task-edit-btn"
                  onClick={() => {
                    setDesc(card.description ?? '')
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : desc.trim() ? (
            <div className="notes-md task-desc-view">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{desc}</ReactMarkdown>
            </div>
          ) : (
            <button type="button" className="task-desc-empty" onClick={() => setEditing(true)}>
              Add a more detailed description…
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
