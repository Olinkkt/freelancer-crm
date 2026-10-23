'use client'

import React, { useState, useMemo, useCallback } from 'react'
import { Search, Lock, RotateCcw, AlertTriangle, Check } from 'lucide-react'
import { SHORTCUTS, ShortcutId } from '@/lib/shortcuts/registry'
import type { ShortcutDef } from '@/lib/shortcuts/types'
import { formatBinding } from '@/lib/shortcuts/keys'
import { findConflicts } from '@/lib/shortcuts/conflicts'
import { resolveBindings } from '@/lib/shortcuts/overrides'
import {
  useShortcuts,
  useShortcutContext,
  useShortcut,
} from '@/components/shortcuts/shortcut-provider'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { KeybindingRecorder } from './keybinding-recorder'
import {
  updateShortcutOverridesAction,
  resetShortcutsAction,
} from '@/app/actions/shortcuts'

interface ShortcutSettingsProps {
  onToast?: (message: string, shortcut?: string, type?: 'success' | 'info' | 'warning', action?: { label: string; onRun: () => void; kind: 'accept' | 'undo' }) => void
}

export function ShortcutSettings({ onToast }: ShortcutSettingsProps) {
  useShortcutContext('shortcutSettings')

  const { effectiveBindings, overrides, setOverrides, platform } = useShortcuts()

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState<number>(0)
  const [recordingId, setRecordingId] = useState<string | null>(null)
  const [conflictState, setConflictState] = useState<{
    type: 'duplicate' | 'prefix' | 'reserved'
    binding: string
    conflictingId?: string
    conflictingLabel?: string
    conflictingScope?: string
    candidate: string
    errorMessage?: string
  } | null>(null)

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetBothState, setResetBothState] = useState<{
    idToReset: string
    conflictingId: string
    conflictingLabel: string
  } | null>(null)

  useEscapeLayer(() => {
    if (recordingId) {
      setRecordingId(null)
      setConflictState(null)
    } else if (resetConfirmOpen) {
      setResetConfirmOpen(false)
    } else if (resetBothState) {
      setResetBothState(null)
    }
  }, Boolean(recordingId || resetConfirmOpen || resetBothState))

  // Filtered shortcuts list
  const filteredShortcuts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return SHORTCUTS

    return SHORTCUTS.filter((s) => {
      const labelMatch = s.label.toLowerCase().includes(q)
      const groupMatch = s.group.toLowerCase().includes(q)
      const bindings = effectiveBindings[s.id] || s.defaults
      const bindingMatch = bindings.some((b) => {
        const formatted = formatBinding(b, platform).toLowerCase()
        return formatted.includes(q) || b.toLowerCase().includes(q)
      })
      return labelMatch || groupMatch || bindingMatch
    })
  }, [searchQuery, effectiveBindings, platform])

  // Grouped shortcuts
  const groupedShortcuts = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>()
    for (const s of filteredShortcuts) {
      const list = map.get(s.group) || []
      list.push(s)
      map.set(s.group, list)
    }
    return Array.from(map.entries())
  }, [filteredShortcuts])

  // Flat list for indexing
  const flatVisible = filteredShortcuts

  // Keep selected index within bounds
  const clampedSelectedIndex = Math.min(
    Math.max(0, selectedIndex),
    Math.max(0, flatVisible.length - 1)
  )

  const selectedShortcut = flatVisible[clampedSelectedIndex]

  // Keyboard navigation within Settings
  useShortcut(
    'shortcuts.down',
    () => {
      if (recordingId) return
      setSelectedIndex((prev) => Math.min(prev + 1, flatVisible.length - 1))
    },
    { enabled: !recordingId }
  )

  useShortcut(
    'shortcuts.up',
    () => {
      if (recordingId) return
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    },
    { enabled: !recordingId }
  )

  const handleStartRecording = useCallback((id: string) => {
    const def = SHORTCUTS.find((s) => s.id === id)
    if (!def || def.locked) return
    setRecordingId(id)
    setConflictState(null)
  }, [])

  const handleResetOne = useCallback(
    async (id: string) => {
      const def = SHORTCUTS.find((s) => s.id === id)
      if (!def || def.locked || !overrides[id]) return

      // Check if removing this override causes conflict with another override
      const proposed = { ...overrides }
      delete proposed[id]

      const resolved = resolveBindings(SHORTCUTS, proposed)
      const conflicts = findConflicts(resolved)

      if (conflicts.length > 0) {
        // Find conflicting other action
        const conflict = conflicts.find((c) => c.ids.includes(id)) || conflicts[0]
        const otherId = conflict.ids.find((i) => i !== id)
        const otherDef = SHORTCUTS.find((s) => s.id === otherId)
        if (otherId && otherDef) {
          setResetBothState({
            idToReset: id,
            conflictingId: otherId,
            conflictingLabel: otherDef.label,
          })
          return
        }
      }

      // Save clean reset
      const res = await updateShortcutOverridesAction({ overrides: proposed })
      if (res.ok) {
        setOverrides(res.data.overrides)
        onToast?.(`Reset shortcut for "${def.label}"`, undefined, 'info')
      } else {
        onToast?.(res.error.message, undefined, 'warning')
      }
    },
    [overrides, onToast, setOverrides]
  )

  useShortcut(
    'shortcuts.rebind',
    () => {
      if (recordingId || !selectedShortcut || selectedShortcut.locked) return
      handleStartRecording(selectedShortcut.id)
    },
    { enabled: !recordingId && Boolean(selectedShortcut && !selectedShortcut.locked) }
  )

  useShortcut(
    'shortcuts.reset',
    () => {
      if (recordingId || !selectedShortcut || !overrides[selectedShortcut.id]) return
      handleResetOne(selectedShortcut.id)
    },
    { enabled: !recordingId && Boolean(selectedShortcut && overrides[selectedShortcut.id]) }
  )

  useShortcut(
    'shortcuts.resetAll',
    () => {
      if (recordingId) return
      setResetConfirmOpen(true)
    },
    { enabled: !recordingId }
  )

  const handleRecordComplete = async (candidate: string) => {
    if (!recordingId) return
    const currentId = recordingId
    const currentDef = SHORTCUTS.find((s) => s.id === currentId)
    if (!currentDef) return

    const proposed = { ...overrides, [currentId]: [candidate] }
    const resolved = resolveBindings(SHORTCUTS, proposed)
    const conflicts = findConflicts(resolved)

    if (conflicts.length === 0) {
      // Save directly
      const oldOverrides = { ...overrides }
      const res = await updateShortcutOverridesAction({ overrides: proposed })
      if (res.ok) {
        setOverrides(res.data.overrides)
        setRecordingId(null)
        setConflictState(null)
        onToast?.(
          `Shortcut for '${currentDef.label}' set to ${formatBinding(candidate, platform)}`,
          undefined,
          'success',
          {
            label: 'Undo',
            kind: 'undo',
            onRun: async () => {
              const undoRes = await updateShortcutOverridesAction({ overrides: oldOverrides })
              if (undoRes.ok) {
                setOverrides(undoRes.data.overrides)
                onToast?.(`Restored shortcut for '${currentDef.label}'`, undefined, 'info')
              }
            },
          }
        )
      } else {
        onToast?.(res.error.message, undefined, 'warning')
        setRecordingId(null)
      }
      return
    }

    // Inspect conflicts
    const conflict = conflicts[0]
    if (conflict.type === 'duplicate') {
      const conflictingId = conflict.ids.find((i) => i !== currentId)
      const otherDef = SHORTCUTS.find((s) => s.id === conflictingId)
      setConflictState({
        type: 'duplicate',
        binding: conflict.binding,
        conflictingId,
        conflictingLabel: otherDef?.label || conflictingId,
        conflictingScope: otherDef?.scope || conflict.context,
        candidate,
      })
    } else if (conflict.type === 'reserved') {
      setConflictState({
        type: 'reserved',
        binding: conflict.binding,
        candidate,
        errorMessage: `${formatBinding(conflict.binding, platform)} is reserved by the browser or locked`,
      })
    } else if (conflict.type === 'prefix') {
      const otherId = conflict.ids.find((i) => i !== currentId)
      const otherDef = SHORTCUTS.find((s) => s.id === otherId)
      setConflictState({
        type: 'prefix',
        binding: conflict.binding,
        candidate,
        errorMessage: `${formatBinding(candidate, platform)} blocks the shortcut "${otherDef?.label || otherId}"`,
      })
    }
  }

  const handleSwap = async () => {
    if (!recordingId || !conflictState || !conflictState.conflictingId) return
    const currentId = recordingId
    const otherId = conflictState.conflictingId
    const currentDef = SHORTCUTS.find((s) => s.id === currentId)
    const otherDef = SHORTCUTS.find((s) => s.id === otherId)
    if (!currentDef || !otherDef) return

    const oldCurrentBindings = effectiveBindings[currentId] || currentDef.defaults

    const proposed = {
      ...overrides,
      [currentId]: [conflictState.candidate],
      [otherId]: [...oldCurrentBindings],
    }

    const resolved = resolveBindings(SHORTCUTS, proposed)
    const conflicts = findConflicts(resolved)

    if (conflicts.length > 0) {
      const clash = conflicts[0]
      const thirdId = clash.ids.find((i) => i !== currentId && i !== otherId)
      const thirdDef = SHORTCUTS.find((s) => s.id === thirdId)
      setConflictState((prev) =>
        prev
          ? {
              ...prev,
              errorMessage: `Can't swap: it would conflict with '${thirdDef?.label || thirdId}'`,
            }
          : null
      )
      return
    }

    // Clean swap!
    const res = await updateShortcutOverridesAction({ overrides: proposed })
    if (res.ok) {
      setOverrides(res.data.overrides)
      setRecordingId(null)
      setConflictState(null)
      onToast?.(
        `Swapped shortcuts for "${currentDef.label}" and "${otherDef.label}"`,
        undefined,
        'success'
      )
    } else {
      onToast?.(res.error.message, undefined, 'warning')
    }
  }

  const handleResetBoth = async () => {
    if (!resetBothState) return
    const proposed = { ...overrides }
    delete proposed[resetBothState.idToReset]
    delete proposed[resetBothState.conflictingId]

    const res = await updateShortcutOverridesAction({ overrides: proposed })
    if (res.ok) {
      setOverrides(res.data.overrides)
      setResetBothState(null)
      onToast?.('Reset shortcuts to default', undefined, 'info')
    } else {
      onToast?.(res.error.message, undefined, 'warning')
    }
  }

  const handleResetAllConfirm = async () => {
    const res = await resetShortcutsAction()
    if (res.ok) {
      setOverrides({})
      setResetConfirmOpen(false)
      onToast?.('All shortcuts reset to defaults', undefined, 'info')
    } else {
      onToast?.(res.error.message, undefined, 'warning')
    }
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* HEADER & SEARCH */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
        <div>
          <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">
            Keyboard Shortcuts
          </h3>
          <p className="text-[13px] text-[#6f7988] mt-0.5">
            Single-keystroke velocity. Click any row or press Enter to rebind.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="relative min-w-[240px]">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9fa1a7]"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search shortcuts..."
              className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-white border border-[#e4e7ec] rounded-[10px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0] placeholder:text-[#9fa1a7]"
            />
          </div>

          <button
            type="button"
            onClick={() => setResetConfirmOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#f2f4f7] rounded-[8px] border border-[#e4e7ec] transition-colors cursor-pointer shrink-0"
            title="Reset all to defaults (⇧R)"
          >
            <RotateCcw size={13} />
            <span>Reset all</span>
            <kbd className="text-[10px] font-mono px-1 py-0.2 bg-[#f2f4f7] rounded text-[#6f7988] border border-[#d0d5dd]">
              ⇧R
            </kbd>
          </button>
        </div>
      </div>

      {/* SHORTCUT GROUPS */}
      <div className="space-y-8">
        {groupedShortcuts.map(([groupName, items]) => (
          <div key={groupName} className="space-y-2">
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#9fa1a7] px-2">
              {groupName}
            </h4>

            <div className="bg-white border border-[#e4e7ec] rounded-[12px] divide-y divide-[#f2f4f7] overflow-hidden shadow-sm">
              {items.map((item) => {
                const itemIndex = flatVisible.indexOf(item)
                const isSelected = itemIndex === clampedSelectedIndex
                const isRecording = recordingId === item.id
                const isOverridden = Boolean(overrides[item.id])
                const bindings = effectiveBindings[item.id] || item.defaults

                return (
                  <div
                    key={item.id}
                    onClick={() => {
                      setSelectedIndex(itemIndex)
                      if (!item.locked && !isRecording) {
                        handleStartRecording(item.id)
                      }
                    }}
                    className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-3 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#f4f7ff] border-l-2 border-l-[#266df0]'
                        : 'hover:bg-[#fafbfc]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      {isOverridden && (
                        <span
                          className="w-1.5 h-1.5 rounded-full bg-[#266df0] shrink-0"
                          title="Custom binding"
                        />
                      )}
                      <span className="text-[13px] font-medium text-[#1c1d1f] truncate">
                        {item.label}
                      </span>
                      {item.locked && (
                        <span title="Locked (cannot be rebound)">
                          <Lock size={12} className="text-[#9fa1a7] shrink-0" />
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-3 self-end sm:self-auto shrink-0">
                      {isRecording ? (
                        <div className="flex flex-col items-end gap-1.5">
                          <KeybindingRecorder
                            platform={platform}
                            onComplete={handleRecordComplete}
                            onCancel={() => {
                              setRecordingId(null)
                              setConflictState(null)
                            }}
                          />
                          {conflictState && (
                            <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded flex items-center gap-2 mt-1">
                              <AlertTriangle size={12} className="shrink-0" />
                              <span>
                                {conflictState.errorMessage ||
                                  `"${formatBinding(conflictState.candidate, platform)}" is already used by '${conflictState.conflictingLabel}' (${conflictState.conflictingScope})`}
                              </span>
                              {conflictState.type === 'duplicate' && !conflictState.errorMessage && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    handleSwap()
                                  }}
                                  className="underline font-semibold hover:text-amber-900 cursor-pointer ml-1"
                                >
                                  Swap
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setRecordingId(null)
                                  setConflictState(null)
                                }}
                                className="underline hover:text-amber-900 cursor-pointer ml-1"
                              >
                                Cancel
                              </button>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          {isOverridden && (
                            <span className="text-[11px] text-[#8f99a8] mr-1 hidden md:inline">
                              Default: {item.defaults.map((d) => formatBinding(d, platform)).join(' / ')}
                            </span>
                          )}

                          <div className="flex items-center gap-1.5">
                            {bindings.map((b, i) => (
                              <React.Fragment key={b}>
                                {i > 0 && <span className="text-[#9fa1a7] text-[11px]">/</span>}
                                <kbd className="px-2 py-0.5 text-[11px] font-mono font-semibold bg-[#f4f7ff] text-[#266df0] rounded-[6px] border border-[#d6e3fc]">
                                  {formatBinding(b, platform)}
                                </kbd>
                              </React.Fragment>
                            ))}
                          </div>

                          {isOverridden && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                handleResetOne(item.id)
                              }}
                              className="p-1 text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#e4e7ec] rounded transition-colors cursor-pointer"
                              title="Reset to default (⌫)"
                            >
                              <RotateCcw size={12} />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))}

        {groupedShortcuts.length === 0 && (
          <div className="py-12 text-center text-[#6f7988] text-[13px]">
            No shortcuts match "{searchQuery}"
          </div>
        )}
      </div>

      {/* RESET ALL CONFIRM MODAL */}
      {resetConfirmOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] p-6 max-w-sm w-full shadow-xl border border-[#e4e7ec] space-y-4">
            <h3 className="text-[16px] font-semibold text-[#1c1d1f]">Reset all shortcuts?</h3>
            <p className="text-[13px] text-[#6f7988]">
              This will remove all custom keybindings and restore the factory defaults.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetConfirmOpen(false)}
                className="px-3 py-1.5 text-[12px] font-medium text-[#6f7988] hover:bg-[#f2f4f7] rounded-[8px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetAllConfirm}
                className="px-3 py-1.5 text-[12px] font-medium bg-red-600 hover:bg-red-700 text-white rounded-[8px] cursor-pointer"
              >
                Reset all
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET BOTH CONFIRM MODAL */}
      {resetBothState && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-[14px] p-6 max-w-sm w-full shadow-xl border border-[#e4e7ec] space-y-4">
            <h3 className="text-[16px] font-semibold text-[#1c1d1f]">Reset conflicts with another shortcut</h3>
            <p className="text-[13px] text-[#6f7988]">
              Resetting this shortcut also resets &apos;{resetBothState.conflictingLabel}&apos; to avoid key conflicts.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetBothState(null)}
                className="px-3 py-1.5 text-[12px] font-medium text-[#6f7988] hover:bg-[#f2f4f7] rounded-[8px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetBoth}
                className="px-3 py-1.5 text-[12px] font-medium bg-[#266df0] hover:bg-[#1f5ad1] text-white rounded-[8px] cursor-pointer"
              >
                Reset both
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
