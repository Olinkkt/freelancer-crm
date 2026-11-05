'use client'

import { useShortcuts } from '@/lib/use-shortcuts'
import { matches } from '@/lib/shortcuts'
import React, { useState, useEffect, useRef } from 'react'
import { X, UserPlus } from 'lucide-react'
import { Contact } from '@/lib/crm-types'

interface NewContactModalProps {
  isOpen: boolean
  onClose: () => void
  onAddContact: (contact: Omit<Contact, 'id'>) => void
  contactToEdit?: Contact | null
  onUpdateContact?: (contact: Contact) => void
}

export function NewContactModal({
  isOpen,
  onClose,
  onAddContact,
  contactToEdit,
  onUpdateContact,
}: NewContactModalProps) {
  const shortcuts = useShortcuts()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [notes, setNotes] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      if (contactToEdit) {
        setName(contactToEdit.name || '')
        setEmail(contactToEdit.email || '')
        setPhone(contactToEdit.phone || '')
        setNotes(contactToEdit.notes || '')
      } else {
        setName('')
        setEmail('')
        setPhone('')
        setNotes('')
      }
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, contactToEdit])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim()) return

    if (contactToEdit && onUpdateContact) {
      onUpdateContact({
        ...contactToEdit,
        name: name.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.cz`,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
      })
    } else {
      onAddContact({
        name: name.trim(),
        email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.cz`,
        phone: phone.trim() || undefined,
        notes: notes.trim() || undefined,
        deals: 0,
        lastTouch: 'Today',
        color: 'blue',
      })
    }

    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (matches(e, shortcuts.submit)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[12px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#edf0f3] bg-[#fafbfc]">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">
              {contactToEdit ? 'Edit Client' : 'Add Client'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Full Name *
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tomáš Dvořák"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tomas@studio.cz"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Phone Number (Optional)
            </label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+420 777 000 000"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
              Notes (Optional)
            </label>
            <textarea
              rows={3}
              maxLength={5000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How you met, preferences, anything worth remembering..."
              className="w-full p-3 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 resize-none"
            />
          </div>

          <div className="pt-2 flex items-center justify-between">
            <span />
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-[12px] font-medium text-[#6f7988] hover:text-[#1c1d1f] rounded-[10px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-medium rounded-[10px] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <UserPlus size={15} />
                <span>{contactToEdit ? 'Save Changes' : 'Save Client'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
