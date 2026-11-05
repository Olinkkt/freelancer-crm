'use client'

import React, { useRef, useState } from 'react'
import { Check, Plus, X } from 'lucide-react'
import { BOARD_COLUMNS, BoardColumnId, DeliverableItem, cardColumn } from '@/lib/crm-types'

interface DealBoardProps {
  items: DeliverableItem[]
  onChange: (items: DeliverableItem[]) => void
}

/** Trello-style task board for one deal: To do → Waiting → Blocked → Done. Drag cards between columns. */
export function DealBoard({ items, onChange }: DealBoardProps) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<BoardColumnId | null>(null)
  const [addingIn, setAddingIn] = useState<BoardColumnId | null>(null)
  const [draft, setDraft] = useState('')

  const moveCard = (id: string, col: BoardColumnId, beforeId?: string) => {
    const card = items.find((i) => i.id === id)
    if (!card) return
    const moved: DeliverableItem = { ...card, column: col, status: col === 'done' ? 'Done' : 'Pending' }
    const rest = items.filter((i) => i.id !== id)
    const at = beforeId ? rest.findIndex((i) => i.id === beforeId) : -1
    if (at === -1) {
      // append after the last card of that column
      let last = -1
      rest.forEach((i, idx) => cardColumn(i) === col && (last = idx))
      rest.splice(last + 1, 0, moved)
    } else {
      rest.splice(at, 0, moved)
    }
    onChange(rest)
  }

  const addCard = (col: BoardColumnId) => {
    const title = draft.trim()
    if (!title) return setAddingIn(null)
    const card: DeliverableItem = {
      id: `card-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title,
      column: col,
      status: col === 'done' ? 'Done' : 'Pending',
    }
    onChange([...items, card])
    setDraft('')
  }

  return (
    <section className="board" aria-label="Task board">
      {BOARD_COLUMNS.map((col) => {
        const cards = items.filter((i) => cardColumn(i) === col.id)
        return (
          <div
            key={col.id}
            className={`board-col ${overCol === col.id ? 'over' : ''}`}
            onDragOver={(e) => {
              if (!dragId) return
              e.preventDefault()
              setOverCol(col.id)
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node)) setOverCol(null)
            }}
            onDrop={(e) => {
              e.preventDefault()
              if (dragId) moveCard(dragId, col.id)
              setDragId(null)
              setOverCol(null)
            }}
          >
            <header className="board-col-head">
              <h3>{col.label}</h3>
              <span className="tabular-nums">{cards.length}</span>
            </header>

            <div className="board-cards">
              {cards.map((card) => (
                <div
                  key={card.id}
                  draggable
                  className={`board-card ${dragId === card.id ? 'dragging' : ''}`}
                  onDragStart={() => setDragId(card.id)}
                  onDragEnd={() => {
                    setDragId(null)
                    setOverCol(null)
                  }}
                  onDragOver={(e) => {
                    if (dragId && dragId !== card.id) e.stopPropagation(), e.preventDefault(), setOverCol(col.id)
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (dragId && dragId !== card.id) moveCard(dragId, col.id, card.id)
                    setDragId(null)
                    setOverCol(null)
                  }}
                >
                  <button
                    type="button"
                    className={`board-check ${col.id === 'done' ? 'on' : ''}`}
                    aria-label={col.id === 'done' ? 'Mark as to do' : 'Mark as done'}
                    onClick={() => moveCard(card.id, col.id === 'done' ? 'todo' : 'done')}
                  >
                    <Check size={11} strokeWidth={3} />
                  </button>
                  <span className={col.id === 'done' ? 'done' : ''}>{card.title}</span>
                  <button
                    type="button"
                    className="board-remove"
                    aria-label="Delete card"
                    onClick={() => onChange(items.filter((i) => i.id !== card.id))}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>

            <div className="board-composer" data-open={addingIn === col.id} data-composer={col.id} inert={addingIn !== col.id}>
              <form
                className="board-add-form"
                onSubmit={(e) => {
                  e.preventDefault()
                  addCard(col.id)
                }}
                onBlur={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node) && !draft.trim()) setAddingIn(null)
                }}
              >
                <textarea
                  rows={2}
                  value={draft}
                  placeholder="Enter a title for this card"
                  maxLength={200}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      addCard(col.id)
                    } else if (e.key === 'Escape') {
                      e.stopPropagation()
                      setDraft('')
                      setAddingIn(null)
                    }
                  }}
                />
                <div className="board-add-actions">
                  <button type="submit" className="board-add-submit">
                    Add card
                  </button>
                  <button
                    type="button"
                    className="board-add-cancel"
                    aria-label="Cancel"
                    onClick={() => {
                      setDraft('')
                      setAddingIn(null)
                    }}
                  >
                    <X size={16} />
                  </button>
                </div>
              </form>
            </div>
            {addingIn !== col.id && (
              <button
                type="button"
                className="board-add"
                onClick={() => {
                  setDraft('')
                  setAddingIn(col.id)
                  requestAnimationFrame(() =>
                    document.querySelector<HTMLTextAreaElement>(`[data-composer="${col.id}"] textarea`)?.focus()
                  )
                }}
              >
                <Plus size={14} /> Add card
              </button>
            )}
          </div>
        )
      })}
    </section>
  )
}
