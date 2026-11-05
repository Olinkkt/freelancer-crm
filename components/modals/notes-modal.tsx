'use client'

import React, { memo, useEffect, useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import type { Deal } from '@/lib/crm-types'
import { useModKey } from '@/lib/use-mod-key'
import { ScratchpadEditor } from '@/components/drawers/scratchpad-editor'

interface NotesModalProps {
  deal: Deal | null
  onClose: () => void
  onSave: (deal: Deal, opts?: { silent?: boolean }) => void
}

/**
 * Light deal-notes editor. Mounted only while a deal is set, animates with
 * opacity/transform only (compositor-friendly, no backdrop blur).
 */
function NotesModalImpl({ deal, onClose, onSave }: NotesModalProps) {
  const modKey = useModKey()
  const [notes, setNotes] = useState(deal?.notes ?? '')
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle')
  const dealRef = useRef(deal)
  dealRef.current = deal
  const onSaveRef = useRef(onSave)
  onSaveRef.current = onSave
  const dirtyRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes

  const flush = () => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    const d = dealRef.current
    if (!dirtyRef.current || !d) return
    dirtyRef.current = false
    onSaveRef.current({ ...d, notes: notesRef.current }, { silent: true })
    setState('saved')
  }

  const change = (value: string) => {
    notesRef.current = value
    setNotes(value)
    dirtyRef.current = true
    setState('saving')
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(flush, 600)
  }

  const close = () => {
    flush()
    onClose()
  }

  useEffect(() => {
    if (!deal) return
    setNotes(deal.notes ?? '')
    setState('idle')
    dirtyRef.current = false
    return () => flush()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  // Window-level so Esc / Ctrl+S work when focus isn't inside the panel (preview mode).
  const closeRef = useRef(close)
  closeRef.current = close
  const hasDeal = !!deal
  useEffect(() => {
    if (!hasDeal) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        closeRef.current()
      } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        flush()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasDeal])

  if (!deal) return null

  return (
    <div className="notes-modal-backdrop" onClick={close}>
      <div
        className="notes-modal-panel"
        role="dialog"
        aria-label={`Notes for ${deal.title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf0f3] bg-[#fafbfc]">
          <span className="text-[12px] font-semibold text-[#1c1d1f] flex items-center gap-1.5 min-w-0">
            <FileText size={14} className="text-[#266df0] shrink-0" />
            <span className="truncate">Notes · {deal.title}</span>
          </span>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-4 flex flex-col flex-1 min-h-0">
          <ScratchpadEditor notes={notes} onChangeNotes={change} />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafbfc] border-t border-[#edf0f3] text-[11px]">
          <span className="text-[#8f99a8]">
            <kbd className="px-1 font-mono bg-white border border-[#e4e7ec] rounded">Esc</kbd> Close ·{' '}
            <kbd className="px-1 font-mono bg-white border border-[#e4e7ec] rounded">{modKey}+S</kbd> Save now
          </span>
          <span className="text-[#8f99a8]" aria-live="polite">
            {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved' : 'Autosaves'}
          </span>
        </div>
      </div>
    </div>
  )
}

export const NotesModal = memo(NotesModalImpl)
