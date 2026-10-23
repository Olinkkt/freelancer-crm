'use client'

import React, { useEffect } from 'react'
import { CheckCircle2, AlertCircle, X } from 'lucide-react'

export interface ToastHUDItem {
  id: string
  message: string
  shortcut?: string
  type?: 'success' | 'info' | 'warning'
  action?: {
    label: string
    onRun: () => void
    kind: 'accept' | 'undo'
  }
  durationMs?: number
}

interface ToastHUDProps {
  toasts: ToastHUDItem[]
  onDismiss: (id: string) => void
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastHUDItem
  onDismiss: (id: string) => void
}) {
  useEffect(() => {
    const timer = setTimeout(() => {
      onDismiss(toast.id)
    }, toast.durationMs ?? 2500)
    return () => clearTimeout(timer)
  }, [toast.id, toast.durationMs, onDismiss])

  return (
    <div
      role="status"
      className="pointer-events-auto flex items-center justify-between gap-2.5 px-3.5 py-2.5 bg-[#232529] text-white rounded-[12px] shadow-[0_12px_30px_rgba(0,0,0,0.18)] border border-[#343840] text-[12px] font-medium max-w-sm sm:max-w-md w-full animate-in slide-in-from-bottom-2 fade-in duration-150"
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {toast.type === 'warning' ? (
          <AlertCircle size={15} className="text-[#d99b38] shrink-0" />
        ) : (
          <CheckCircle2 size={15} className="text-[#266df0] shrink-0" />
        )}
        <span className="truncate flex-1">{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.onRun()
              onDismiss(toast.id)
            }}
            className="shrink-0 flex items-center gap-1.5 px-2 py-0.5 bg-[#2e3238] hover:bg-[#383d45] text-[#bad0fa] hover:text-white rounded-[5px] border border-[#444a53] transition-colors cursor-pointer text-[11px] font-semibold"
          >
            <span>{toast.action.label}</span>
            <kbd className="px-1 py-0.2 text-[9px] font-mono bg-[#1c1d1f] rounded border border-[#525964]">
              {toast.action.kind === 'accept' ? 'Y' : 'Z'}
            </kbd>
          </button>
        )}
        {toast.shortcut && !toast.action && (
          <kbd className="shrink-0 px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#2e3238] text-[#bad0fa] rounded-[5px] border border-[#444a53]">
            {toast.shortcut}
          </kbd>
        )}
      </div>
      <button
        onClick={() => onDismiss(toast.id)}
        className="text-[#8f99a8] hover:text-white transition-colors ml-1 p-0.5 rounded cursor-pointer shrink-0"
        aria-label="Dismiss toast"
      >
        <X size={13} />
      </button>
    </div>
  )
}

export function ToastHUD({ toasts, onDismiss }: ToastHUDProps) {
  // Cap visible toasts to the most recent 2 to prevent stacking
  const visibleToasts = toasts.slice(-2)

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 pointer-events-none max-w-full px-4 sm:px-0">
      {visibleToasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  )
}
