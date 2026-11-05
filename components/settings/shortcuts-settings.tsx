'use client'

import { useEffect, useState } from 'react'
import { Search } from 'lucide-react'
import { useModKey } from '@/lib/use-mod-key'
import { resetShortcuts, setShortcut, useShortcuts } from '@/lib/use-shortcuts'
import {
  DEFAULT_BINDINGS,
  SHORTCUTS,
  ShortcutId,
  eventToStep,
  formatBinding,
  getShortcutGroups,
  validateBinding,
} from '@/lib/shortcuts'

const KBD =
  'px-2 py-0.5 min-w-[22px] text-center text-[11px] font-mono font-semibold text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded-[5px] shadow-2xs'

export function ShortcutsSettings() {
  const modKey = useModKey()
  const bindings = useShortcuts()
  const [filter, setFilter] = useState('')
  const [recording, setRecording] = useState<ShortcutId | null>(null)
  const [draft, setDraft] = useState<string[]>([])

  const def = recording ? SHORTCUTS.find((s) => s.id === recording) : null
  const maxSteps = def?.chord ? 2 : 1

  useEffect(() => {
    if (!recording) return
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()
      if (e.key === 'Escape') {
        setRecording(null)
        return
      }
      const step = eventToStep(e)
      if (!step) return
      setDraft((d) => (d.length >= maxSteps ? [step] : [...d, step]))
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [recording, maxSteps])

  const startRecording = (id: ShortcutId) => {
    setDraft([])
    setRecording(id)
  }

  const draftBinding = draft.join(' ')
  const error = recording && draft.length > 0 ? validateBinding(recording, draftBinding, bindings) : null
  const canSave = !!recording && draft.length > 0 && !error

  const save = () => {
    if (!recording || !canSave) return
    setShortcut(recording, draftBinding)
    setRecording(null)
  }

  const q = filter.trim().toLowerCase()
  const groups = getShortcutGroups(bindings, modKey)
    .map((g) => ({
      ...g,
      items: g.items.filter(
        (i) =>
          !q ||
          i.label.toLowerCase().includes(q) ||
          i.keys.some((k) => k.toLowerCase().includes(q))
      ),
    }))
    .filter((g) => g.items.length > 0)

  const customized = SHORTCUTS.some((s) => bindings[s.id] !== DEFAULT_BINDINGS[s.id])

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
        <div>
          <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Shortcuts</h3>
          <p className="text-[13px] text-[#6f7988] mt-0.5">Click Edit, then press the keys you want.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9fa1a7]" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e4e7ec] rounded-[10px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0] placeholder:text-[#9fa1a7]"
            />
          </div>
          {customized && (
            <button type="button" onClick={resetShortcuts} className="select-button text-[12px] shrink-0">
              Reset all
            </button>
          )}
        </div>
      </div>

      {groups.map((group) => (
        <div key={group.title} className="bg-white border border-[#e4e7ec] rounded-xl overflow-hidden shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
          <div className="px-4 py-2.5 bg-[#fafbfc] border-b border-[#e4e7ec]">
            <span className="text-[12px] font-semibold text-[#1c1d1f]">{group.title}</span>
          </div>
          <div className="divide-y divide-[#f0f1f3]">
            {group.items.map((item) => {
              const id = item.id
              const isRecording = id !== null && recording === id
              const isCustom = id !== null && bindings[id] !== DEFAULT_BINDINGS[id]
              return (
                <div key={item.label} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-[#fafbfc] transition-colors">
                  <div className="min-w-0">
                    <span className="text-[13px] font-medium text-[#1c1d1f] block truncate">{item.label}</span>
                    {isRecording && (
                      <span className={`text-[11px] block ${error ? 'text-[#b42318]' : 'text-[#6f7988]'}`}>
                        {error ?? (draft.length === 0
                          ? 'Press the new keys… (Esc to cancel)'
                          : def?.chord && draft.length < 2
                            ? 'Press a second key for a chord, or save'
                            : 'Looks good')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1">
                      {(isRecording ? (draft.length ? formatBinding(draftBinding, modKey) : []) : item.keys).map((k, i) => (
                        <kbd key={i} className={KBD}>{k}</kbd>
                      ))}
                      {isRecording && draft.length === 0 && <kbd className={KBD}>…</kbd>}
                    </div>
                    {id !== null && !isRecording && (
                      <>
                        <button type="button" onClick={() => startRecording(id)} className="select-button text-[12px] py-1 px-2.5 min-h-0">
                          Edit
                        </button>
                        {isCustom && (
                          <button type="button" onClick={() => setShortcut(id, null)} className="text-[12px] text-[#6f7988] hover:text-[#1c1d1f] cursor-pointer">
                            Reset
                          </button>
                        )}
                      </>
                    )}
                    {isRecording && (
                      <>
                        <button
                          type="button"
                          onClick={save}
                          disabled={!canSave}
                          className="primary-button text-[12px] py-1 px-2.5 min-h-0 disabled:opacity-40"
                        >
                          Save
                        </button>
                        <button type="button" onClick={() => setRecording(null)} className="text-[12px] text-[#6f7988] hover:text-[#1c1d1f] cursor-pointer">
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
