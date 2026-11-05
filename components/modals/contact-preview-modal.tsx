'use client'

import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { Contact } from '@/lib/crm-types'

interface ContactPreviewModalProps {
  contact: Contact | null
  openDealsCount: number
  onClose: () => void
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#6f7988]">{label}</div>
      <div className="text-[13px] text-[#1c1d1f]">{children}</div>
    </div>
  )
}

export function ContactPreviewModal({ contact, openDealsCount, onClose }: ContactPreviewModalProps) {
  useEffect(() => {
    if (!contact) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [contact, onClose])

  if (!contact) return null

  const empty = <span className="text-[#8f99a8]">—</span>

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`${contact.name} preview`}
        className="w-full max-w-md bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`company-avatar shrink-0 ${contact.color}`}>{contact.name.charAt(0)}</span>
            <h2 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight truncate">
              {contact.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 grid grid-cols-2 gap-x-4 gap-y-4">
          <Field label="Email">
            {contact.email ? (
              <a href={`mailto:${contact.email}`} className="text-[#266df0] hover:underline break-all">
                {contact.email}
              </a>
            ) : (
              empty
            )}
          </Field>
          <Field label="Phone">
            {contact.phone ? (
              <a href={`tel:${contact.phone}`} className="hover:underline">
                {contact.phone}
              </a>
            ) : (
              empty
            )}
          </Field>
          <Field label="Open deals">{openDealsCount}</Field>
          <Field label="Last touch">{contact.lastTouch || empty}</Field>
          <div className="col-span-2">
            <Field label="Notes">
              {contact.notes ? <p className="whitespace-pre-wrap">{contact.notes}</p> : empty}
            </Field>
          </div>
        </div>
      </div>
    </div>
  )
}
