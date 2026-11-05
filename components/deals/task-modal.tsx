'use client'

import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { X } from 'lucide-react'
import { toggleTaskLine } from '@/components/drawers/scratchpad-editor'
import { DeliverableItem } from '@/lib/crm-types'

interface TaskModalProps {
  card: DeliverableItem | null
  onClose: () => void
  onChange: (patch: Partial<DeliverableItem>) => void
}

/** Card details: column, title and a markdown description. */
export function TaskModal({ card, onClose, onChange }: TaskModalProps) {
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
    <div className="notes-modal-backdrop task-backdrop" onClick={onClose}>
      <div className="notes-modal-panel task-modal" role="dialog" aria-label={card.title} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-[#edf0f3] bg-[#fafbfc]">
          <h2 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Edit task</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="task-modal-body">
          <div className="task-title-row">
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
            <span>Description:</span>
          </div>

          {editing ? (
            <div className="task-desc-edit">
              <textarea
                autoFocus
                value={desc}
                rows={8}
                placeholder="Add a more detailed description… (Markdown supported)"
                onChange={(e) => setDesc(e.target.value)}
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
            <div
              className="notes-md task-desc-view"
              role="button"
              tabIndex={0}
              title="Click to edit"
              onClick={(e) => !(e.target as HTMLElement).closest('a, input') && setEditing(true)}
              onKeyDown={(e) => e.key === 'Enter' && setEditing(true)}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  a: ({ node: _n, ...p }) => <a {...p} target="_blank" rel="noopener noreferrer" />,
                  input: ({ node, ...p }) =>
                    p.type === 'checkbox' ? (
                      <input
                        type="checkbox"
                        checked={!!p.checked}
                        onChange={() => {
                          const line = node?.position?.start.line
                          if (!line) return
                          const next = toggleTaskLine(desc, line)
                          setDesc(next)
                          onChange({ description: next })
                        }}
                      />
                    ) : null,
                }}
              >
                {desc}
              </ReactMarkdown>
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
