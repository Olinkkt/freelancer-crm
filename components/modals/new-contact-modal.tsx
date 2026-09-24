'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, UserPlus, Building2, Mail, Phone, Briefcase } from 'lucide-react'
import { Contact, Company } from '@/lib/crm-types'

interface NewContactModalProps {
  isOpen: boolean
  onClose: () => void
  onAddContact: (contact: Omit<Contact, 'id'>) => void
  companies: Company[]
}

export function NewContactModal({
  isOpen,
  onClose,
  onAddContact,
  companies,
}: NewContactModalProps) {
  const [name, setName] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setRole('')
      setCompany(companies[0]?.name || '')
      setEmail('')
      setPhone('')
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen, companies])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim()) return

    onAddContact({
      name: name.trim(),
      role: role.trim() || 'Stakeholder',
      company: company.trim() || 'Independent',
      email: email.trim() || `${name.toLowerCase().replace(/\s+/g, '.')}@example.cz`,
      phone: phone.trim() || undefined,
      deals: 1,
      lastTouch: 'Today',
      color: 'blue',
    })

    onClose()
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/30 backdrop-blur-xs transition-all"
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
            <span className="px-2 py-0.5 text-[10px] font-mono font-medium bg-[#e9f0ff] text-[#266df0] rounded-[7px] border border-[#d6e3fc]">
              Hotkey: C
            </span>
            <h2 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">
              Add New Contact
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
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Tomáš Dvořák"
              className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Creative Director"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Company
              </label>
              <input
                list="contact-companies"
                value={company}
                onChange={(e) => setCompany(e.target.value)}
                placeholder="Select company"
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
              <datalist id="contact-companies">
                {companies.map((c) => (
                  <option key={c.id} value={c.name} />
                ))}
              </datalist>
            </div>
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

          <div className="pt-2 flex items-center justify-between">
            <span className="text-[11px] text-[#9fa1a7] font-mono">
              Press <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">⌘</kbd> +{' '}
              <kbd className="px-1 bg-[#f4f5f6] border border-[#e4e7ec] rounded-[5px] text-[10px]">↵</kbd>
            </span>
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
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-medium rounded-[10px] shadow-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <UserPlus size={15} />
                <span>Save Contact</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
