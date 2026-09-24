'use client'

import React, { useEffect } from 'react'
import { X, Keyboard, Zap, Navigation, LayoutGrid, Sparkles } from 'lucide-react'

interface ShortcutsModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ShortcutsModal({ isOpen, onClose }: ShortcutsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const shortcutSections = [
    {
      title: 'Global & Command Palette',
      icon: <Zap size={15} className="text-[#266df0]" />,
      items: [
        { keys: ['⌘', 'K'], label: 'Open Command Palette' },
        { keys: ['Ctrl', 'K'], label: 'Open Command Palette (Windows/Linux)' },
        { keys: ['?'], label: 'Show this keyboard cheatsheet' },
        { keys: ['Esc'], label: 'Dismiss modal, drawer, or palette' },
      ],
    },
    {
      title: 'Instant Quick Actions (Operator Hotkeys)',
      icon: <Sparkles size={15} className="text-[#6f7988]" />,
      items: [
        { keys: ['N'], label: 'Quick-add new deal drawer' },
        { keys: ['C'], label: 'Quick-add new contact drawer' },
        { keys: ['L'], label: 'Quick-log call / meeting note' },
        { keys: ['⌘', '↵'], label: 'Submit form in quick capture' },
      ],
    },
    {
      title: 'Kanban Board Deals Navigation (No Mouse)',
      icon: <LayoutGrid size={15} className="text-[#6f7988]" />,
      items: [
        { keys: ['H'], label: 'Move focus left to previous stage' },
        { keys: ['L'], label: 'Move focus right to next stage' },
        { keys: ['J'], label: 'Move focus down to next deal' },
        { keys: ['K'], label: 'Move focus up to previous deal' },
        { keys: ['Tab'], label: 'Cycle forward through deals' },
        { keys: ['↵'], label: 'Open deal detail drawer & inspect' },
        { keys: ['['], label: 'Shift selected deal to previous stage' },
        { keys: [']'], label: 'Shift selected deal to next stage' },
      ],
    },
    {
      title: 'Rapid View Navigation',
      icon: <Navigation size={15} className="text-[#6f7988]" />,
      items: [
        { keys: ['G', 'D'], label: 'Go to Dashboard' },
        { keys: ['G', 'P'], label: 'Go to Deals & Pipeline' },
        { keys: ['G', 'C'], label: 'Go to Companies' },
        { keys: ['G', 'U'], label: 'Go to Contacts' },
        { keys: ['G', 'K'], label: 'Go to Calendar' },
        { keys: ['G', 'A'], label: 'Go to Activities' },
        { keys: ['G', 'S'], label: 'Go to Settings' },
      ],
    },
  ]

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
                Superhuman & Linear speed for your personal operator cockpit
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">
          {shortcutSections.map((section) => (
            <div key={section.title} className="space-y-3">
              <div className="flex items-center gap-2 pb-1 border-b border-[#f0f1f3]">
                {section.icon}
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#6f7988]">
                  {section.title}
                </h3>
              </div>
              <div className="space-y-2">
                {section.items.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-1.5 px-2 rounded-[8px] text-[12px] hover:bg-[#fafbfc]"
                  >
                    <span className="text-[#33383f] font-medium">{item.label}</span>
                    <div className="flex items-center gap-1 shrink-0 ml-2">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.5 min-w-[20px] text-center text-[10px] font-mono font-medium text-[#505967] bg-[#f4f5f6] border border-[#dce0e8] rounded-[5px]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#edf0f3] bg-[#fafbfc] flex items-center justify-between text-[11px] text-[#8f99a8]">
          <span>Tip: Press any single key hotkey when outside an input field.</span>
          <kbd className="px-2 py-0.5 text-[10px] bg-white border border-[#e4e7ec] rounded-[5px] font-mono font-medium text-[#505967]">
            Press ESC to exit
          </kbd>
        </div>
      </div>
    </div>
  )
}
