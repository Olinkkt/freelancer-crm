'use client'

import React from 'react'

interface ScratchpadEditorProps {
  notes: string
  onChangeNotes: (notes: string) => void
}

export function ScratchpadEditor({ notes = '', onChangeNotes }: ScratchpadEditorProps) {
  return (
    <textarea
      rows={9}
      value={notes}
      onChange={(e) => onChangeNotes(e.target.value)}
      placeholder="Write your notes..."
      className="w-full p-3.5 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 leading-relaxed font-sans resize-y"
    />
  )
}
