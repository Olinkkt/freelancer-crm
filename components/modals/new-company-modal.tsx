'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Building2 } from 'lucide-react'
import { Company } from '@/lib/crm-types'

interface NewCompanyModalProps {
  isOpen: boolean
  onClose: () => void
  onAddCompany: (company: Omit<Company, 'id'>) => void
}

export function NewCompanyModal({ isOpen, onClose, onAddCompany }: NewCompanyModalProps) {
  const [name, setName] = useState('')
  const [type, setType] = useState('Client')
  const [contact, setContact] = useState('')
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<Company['status']>('Active')
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setName('')
      setType('Client')
      setContact('')
      setEmail('')
      setStatus('Active')
      setTimeout(() => {
        nameInputRef.current?.focus()
      }, 50)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!name.trim()) return

    onAddCompany({
      name: name.trim(),
      type: type.trim() || 'Client',
      contact: contact.trim(),
      email: email.trim(),
      deals: 0,
      value: '0 Kč',
      status,
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
            <div className="w-8 h-8 rounded-lg bg-[#eef2f6] text-[#1c1d1f] flex items-center justify-center">
              <Building2 size={16} />
            </div>
            <div>
              <h2 className="text-[14px] font-semibold text-[#1c1d1f]">Add Company Account</h2>
              <p className="text-[11px] text-[#6f7988]">Create client account or business entity</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#8f99a8] hover:text-[#1c1d1f] p-1 rounded-md hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-[11px] font-medium text-[#505967] mb-1">
              Company Name <span className="text-red-500">*</span>
            </label>
            <input
              ref={nameInputRef}
              type="text"
              required
              placeholder="e.g. Stripe, Acme Corp, Seidl Studio"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0] focus:ring-1 focus:ring-[#266df0]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-medium text-[#505967] mb-1">
                Account Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0]"
              >
                <option value="Client">Client</option>
                <option value="Prospect">Prospect</option>
                <option value="Partner">Partner</option>
                <option value="Vendor">Vendor</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-[#505967] mb-1">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as Company['status'])}
                className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0]"
              >
                <option value="Active">Active</option>
                <option value="Prospect">Prospect</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#505967] mb-1">
              Primary Contact Name
            </label>
            <input
              type="text"
              placeholder="e.g. Petr Svoboda"
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-[#505967] mb-1">
              Contact Email
            </label>
            <input
              type="email"
              placeholder="petr@company.cz"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-[13px] bg-white border border-[#dce0e5] rounded-[8px] focus:outline-none focus:border-[#266df0]"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-[#edf0f3]">
            <span className="text-[10px] text-[#8f99a8] flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-[#f0f2f5] border border-[#dce0e5] rounded text-[9px] font-mono">
                ⌘
              </kbd>
              <kbd className="px-1 py-0.5 bg-[#f0f2f5] border border-[#dce0e5] rounded text-[9px] font-mono">
                ↵
              </kbd>
              save
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-[12px] font-medium text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] rounded-[7px] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim()}
                className="px-3.5 py-1.5 text-[12px] font-medium bg-[#232529] hover:bg-[#101113] text-white rounded-[7px] transition-colors disabled:opacity-50 cursor-pointer"
              >
                Save company
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
