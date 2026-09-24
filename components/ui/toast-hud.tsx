'use client'

import React, { useEffect, useState } from 'react'
import { CheckCircle2, Sparkles, AlertCircle, Info } from 'lucide-react'

export interface ToastHUDItem {
  id: string
  message: string
  shortcut?: string
  type?: 'success' | 'info' | 'warning'
}

interface ToastHUDProps {
  toasts: ToastHUDItem[]
  onDismiss: (id: string) => void
}

export function ToastHUD({ toasts, onDismiss }: ToastHUDProps) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 bg-[#1c1d1f] text-white rounded-xl shadow-xl border border-[#33383f] text-[12px] font-medium animate-in slide-in-from-bottom-2 fade-in duration-150"
        >
          {toast.type === 'warning' ? (
            <AlertCircle size={15} className="text-[#c4882b] shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="text-[#43a878] shrink-0" />
          )}
          <span>{toast.message}</span>
          {toast.shortcut && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#2e3238] text-[#bad0fa] rounded border border-[#444a53]">
              {toast.shortcut}
            </kbd>
          )}
        </div>
      ))}
    </div>
  )
}
