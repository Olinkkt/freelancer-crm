'use client'

import React, { useState } from 'react'
import { X, Sparkles, FileText, CheckCircle2 } from 'lucide-react'
import { ScratchpadEditor } from '@/components/drawers/scratchpad-editor'
import { syncBriefAction, updateProjectAction } from '@/app/actions/projects'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'

interface BriefEditorProps {
  projectId: string
  projectTitle: string
  company: string
  brief: string
  isOpen: boolean
  isReadOnly?: boolean
  onClose: () => void
  onBriefUpdated: (brief: string) => void
  onToast: (msg: string) => void
}

export function BriefEditor({
  projectId,
  projectTitle,
  company,
  brief: initialBrief,
  isOpen,
  isReadOnly = false,
  onClose,
  onBriefUpdated,
  onToast,
}: BriefEditorProps) {
  const [brief, setBrief] = useState(initialBrief)
  const [isSyncing, setIsSyncing] = useState(false)

  useEscapeLayer(onClose, isOpen)

  const handleSyncBrief = async () => {
    if (isReadOnly) return
    setIsSyncing(true)
    try {
      const res = await syncBriefAction({ projectId, brief })
      if (res.ok && res.data) {
        const { created, completed, reopened } = res.data
        onToast(
          `Brief synced: ${created.length} created, ${completed.length} completed, ${reopened.length} reopened`
        )
      } else if (!res.ok) {
        onToast(res.error.message)
      }
    } finally {
      setIsSyncing(false)
    }
  }

  // Mod+Shift+S shortcut
  useShortcut('project.syncBrief', handleSyncBrief, { enabled: isOpen && !isReadOnly })

  const handleSaveBrief = async () => {
    if (isReadOnly) return
    const res = await updateProjectAction({
      id: projectId,
      patch: { brief },
    })
    if (res.ok) {
      onBriefUpdated(brief)
      onToast('Brief saved')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div
        className="w-full max-w-3xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col h-[85vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-blue-500" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Project Brief</h2>
            <span className="text-xs text-slate-400">· {projectTitle}</span>
          </div>
          <div className="flex items-center gap-2">
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSyncBrief}
                disabled={isSyncing}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/60 transition-colors cursor-pointer"
                title="Sync brief checkboxes to tasks (⌘⇧S)"
              >
                <Sparkles size={12} />
                <span>Sync checkboxes to tasks</span>
                <kbd className="px-1 text-[9px] font-mono bg-blue-100 dark:bg-blue-900 rounded border border-blue-200 dark:border-blue-800">
                  ⌘⇧S
                </kbd>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Editor Body */}
        <div className="flex-1 overflow-hidden p-4">
          <ScratchpadEditor
            notes={brief}
            onChangeNotes={(val) => {
              setBrief(val)
            }}
            onSave={handleSaveBrief}
            dealContext={{
              title: projectTitle,
              company,
            }}
          />
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between text-xs text-slate-400">
          <span>Checkboxes `- [ ]` sync into tasks with ⌘⇧S</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1 font-medium hover:text-slate-700 dark:hover:text-slate-200"
            >
              Close (Esc)
            </button>
            {!isReadOnly && (
              <button
                type="button"
                onClick={handleSaveBrief}
                className="px-3 py-1 font-semibold rounded-md bg-blue-600 text-white hover:bg-blue-500"
              >
                Save
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
