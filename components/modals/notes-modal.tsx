'use client'

import React, { memo, useEffect, useRef, useState } from 'react'
import { FileText, X } from 'lucide-react'
import type { Deal } from '@/lib/crm-types'
import { useModKey } from '@/lib/use-mod-key'

interface NotesModalProps {
  deal: Deal | null
  onClose: () => void
  onSave: (deal: Deal) => void
}

/**
 * Light deal-notes editor. Mounted only while a deal is set, animates with
 * opacity/transform only (compositor-friendly, no backdrop blur).
 */
function NotesModalImpl({ deal, onClose, onSave }: NotesModalProps) {
  const modKey = useModKey()
  const [notes, setNotes] = useState(deal?.notes ?? '')
  const [saved, setSaved] = useState(false)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const notesRef = useRef(notes)
  notesRef.current = notes

  useEffect(() => {
    if (!deal) return
    setNotes(deal.notes ?? '')
    setSaved(false)
    areaRef.current?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal?.id])

  if (!deal) return null

  const save = () => {
    onSave({ ...deal, notes: notesRef.current })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="notes-modal-backdrop" onClick={onClose}>
      <div
        className="notes-modal-panel"
        role="dialog"
        aria-label={`Notes for ${deal.title}`}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault()
            onClose()
          } else if (e.key === 's' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            save()
          }
        }}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#edf0f3] bg-[#fafbfc]">
          <span className="text-[12px] font-semibold text-[#1c1d1f] flex items-center gap-1.5 min-w-0">
            <FileText size={14} className="text-[#266df0] shrink-0" />
            <span className="truncate">Notes · {deal.title}</span>
          </span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-[7px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3]"
          >
            <X size={15} />
          </button>
        </div>
        <div className="p-4">
          <textarea
            ref={areaRef}
            autoFocus
            rows={9}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Write your notes..."
            className="w-full p-3.5 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 leading-relaxed font-sans resize-y"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#fafbfc] border-t border-[#edf0f3] text-[11px]">
          <span className="text-[#8f99a8]">
            <kbd className="px-1 font-mono bg-white border border-[#e4e7ec] rounded">Esc</kbd> Close ·{' '}
            <kbd className="px-1 font-mono bg-white border border-[#e4e7ec] rounded">{modKey}+S</kbd> Save
          </span>
          <button
            type="button"
            onClick={save}
            className="px-3 py-1 bg-[#232529] hover:bg-[#101113] text-white font-medium rounded-[7px] cursor-pointer"
          >
            {saved ? 'Saved' : 'Save note'}
          </button>
        </div>
      </div>
    </div>
  )
}

export const NotesModal = memo(NotesModalImpl)
