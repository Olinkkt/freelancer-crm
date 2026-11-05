'use client'

import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

interface ScratchpadEditorProps {
  notes: string
  onChangeNotes: (notes: string) => void
}

/** Flip `- [ ]` / `- [x]` on one (1-based) line of the markdown source. */
function toggleTaskLine(source: string, line: number): string {
  const lines = source.split('\n')
  const text = lines[line - 1]
  if (text === undefined) return source
  lines[line - 1] = text.replace(/\[( |x|X)\]/, (_, c: string) => (c === ' ' ? '[x]' : '[ ]'))
  return lines.join('\n')
}

/** Markdown notes: Preview / Edit tabs. Ctrl+E flips between them. */
export function ScratchpadEditor({ notes = '', onChangeNotes }: ScratchpadEditorProps) {
  const [mode, setMode] = useState<'write' | 'preview'>(notes.trim() ? 'preview' : 'write')
  const areaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (mode === 'write') areaRef.current?.focus()
  }, [mode])

  return (
    <div
      className="flex flex-col flex-1 min-h-0"
      onKeyDown={(e) => {
        if (e.key === 'e' && (e.ctrlKey || e.metaKey)) {
          e.preventDefault()
          setMode((m) => (m === 'write' ? 'preview' : 'write'))
        }
      }}
    >
      <div className="flex items-center gap-1 mb-2 text-[11px]" role="tablist">
        {(['preview', 'write'] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`px-2.5 py-1 rounded-[6px] font-medium capitalize cursor-pointer ${
              mode === m ? 'bg-[#edf0f3] text-[#1c1d1f]' : 'text-[#8f99a8] hover:text-[#1c1d1f]'
            }`}
          >
            {m === 'write' ? 'edit' : m}
          </button>
        ))}
        <span className="ml-auto text-[#8f99a8]">
          Markdown · <kbd className="px-1 font-mono bg-white border border-[#e4e7ec] rounded">Ctrl+E</kbd> {mode === 'write' ? 'preview' : 'edit'}
        </span>
      </div>

      {mode === 'write' ? (
        <textarea
          ref={areaRef}
          value={notes}
          onChange={(e) => onChangeNotes(e.target.value)}
          placeholder={'Write your notes…\n\n# Heading   - list   - [ ] task   **bold**'}
          className="flex-1 min-h-[50vh] w-full p-4 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 leading-relaxed font-mono resize-none"
        />
      ) : (
        <div className="notes-md flex-1 min-h-[50vh] overflow-y-auto p-4 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f]">
          {notes.trim() ? (
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
                        if (line) onChangeNotes(toggleTaskLine(notes, line))
                      }}
                    />
                  ) : null,
              }}
            >
              {notes}
            </ReactMarkdown>
          ) : (
            <p className="text-[#8f99a8]">Nothing to preview yet.</p>
          )}
        </div>
      )}
    </div>
  )
}
