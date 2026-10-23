'use client'

import React, { useMemo } from 'react'
import { X, Keyboard } from 'lucide-react'
import { SHORTCUTS } from '@/lib/shortcuts/registry'
import type { ShortcutDef } from '@/lib/shortcuts/types'
import { formatBinding } from '@/lib/shortcuts/keys'
import {
  useShortcuts,
  useShortcutContext,
  useShortcut,
} from '@/components/shortcuts/shortcut-provider'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
  onOpenSettings?: () => void
}

export function ShortcutsModal({
  isOpen,
  onClose,
  onOpenSettings,
}: ShortcutsModalProps) {
  useEscapeLayer(onClose, isOpen)
  useShortcutContext('help')

  const { effectiveBindings, platform } = useShortcuts()

  useShortcut(
    'help.editShortcuts',
    () => {
      onClose()
      onOpenSettings?.()
    },
    { enabled: isOpen }
  )

  const groups = useMemo(() => {
    const map = new Map<string, ShortcutDef[]>()
    for (const s of SHORTCUTS) {
      if (s.readme === false) continue
      const list = map.get(s.group) || []
      list.push(s)
      map.set(s.group, list)
    }
    return Array.from(map.entries())
  }, [])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30 backdrop-blur-xs transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[8px] bg-[#e7efff] text-[#266df0] flex items-center justify-center font-bold">
              <Keyboard size={17} />
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">
                Keyboard Shortcuts
              </h2>
              <p className="text-[11px] text-[#6f7988]">
                Fast navigation and velocity shortcuts for your workspace
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {groups.map(([groupName, items]) => (
            <div key={groupName} className="space-y-3">
              <div className="pb-1 border-b border-[#f0f1f3]">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6f7988]">
                  {groupName}
                </h3>
              </div>
              <div className="space-y-1.5">
                {items.map((item) => {
                  const bindings = effectiveBindings[item.id] || item.defaults
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between py-1 px-1.5 rounded-[6px] text-[12px] hover:bg-[#fafbfc]"
                    >
                      <span className="text-[#33383f] font-medium truncate mr-2">
                        {item.label}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        {bindings.map((b, bIdx) => (
                          <React.Fragment key={b}>
                            {bIdx > 0 && (
                              <span className="text-[#9fa1a7] text-[10px]">/</span>
                            )}
                            <kbd className="px-1.5 py-0.5 text-center text-[10px] font-mono font-medium text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded-[5px]">
                              {formatBinding(b, platform)}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between text-[11px] text-[#8f99a8]">
          <span>Press E to edit shortcuts</span>
          <kbd className="px-2 py-0.5 text-[10px] bg-white border border-[#e4e7ec] rounded-[5px] font-mono font-medium text-[#505967]">
            Press ESC to exit
          </kbd>
        </div>
      </div>
    </div>
  )
}
