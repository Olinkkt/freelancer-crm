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
          className="pointer-events-auto flex items-center gap-2.5 px-3.5 py-2.5 bg-[#232529] text-white rounded-[12px] shadow-[0_12px_30px_rgba(0,0,0,0.18)] border border-[#343840] text-[12px] font-medium animate-in slide-in-from-bottom-2 fade-in duration-150"
        >
          {toast.type === 'warning' ? (
            <AlertCircle size={15} className="text-[#d99b38] shrink-0" />
          ) : (
            <CheckCircle2 size={15} className="text-[#266df0] shrink-0" />
          )}
          <span>{toast.message}</span>
          {toast.shortcut && (
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#2e3238] text-[#bad0fa] rounded-[5px] border border-[#444a53]">
              {toast.shortcut}
            </kbd>
          )}
        </div>
      ))}
    </div>
  )
}
