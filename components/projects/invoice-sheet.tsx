'use client'

import React, { useState, useEffect, useRef } from 'react'
import { X, Calendar, DollarSign, ExternalLink, Trash2 } from 'lucide-react'
import type { Invoice, Milestone, Project } from '@/lib/projects/types'
import { toMinor, fromMinor } from '@/lib/projects/money'
import { localToday, addDays } from '@/lib/projects/dates'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { handleFormKeys } from '@/components/shortcuts/form-keys'

interface InvoiceSheetProps {
  project: Project
  milestones: Milestone[]
  invoiceToEdit?: Invoice | null
  defaultMilestoneId?: string | null
  invoiceNetDays?: number
  isOpen: boolean
  onClose: () => void
  onSave: (params: {
    id?: string
    label: string
    number?: string | null
    amountMinor: number
    currency?: string
    hours?: number | null
    milestoneId?: string | null
    status?: 'draft' | 'sent'
    issueDate?: string | null
    dueDate?: string | null
    externalUrl?: string | null
    notes?: string | null
  }) => Promise<void>
  onDelete?: (id: string) => Promise<void>
}

export function InvoiceSheet({
  project,
  milestones,
  invoiceToEdit,
  defaultMilestoneId = null,
  invoiceNetDays = 14,
  isOpen,
  onClose,
  onSave,
  onDelete,
}: InvoiceSheetProps) {
  const [label, setLabel] = useState('')
  const [number, setNumber] = useState('')
  const [amountMajor, setAmountMajor] = useState('')
  const [hours, setHours] = useState('')
  const [milestoneId, setMilestoneId] = useState<string | null>(null)
  const [status, setStatus] = useState<'draft' | 'sent'>('draft')
  const [issueDate, setIssueDate] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [externalUrl, setExternalUrl] = useState('')
  const [notes, setNotes] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const labelInputRef = useRef<HTMLInputElement>(null)
  const isEditing = !!invoiceToEdit

  useEscapeLayer(onClose, isOpen)

  useEffect(() => {
    if (isOpen) {
      if (invoiceToEdit) {
        setLabel(invoiceToEdit.label)
        setNumber(invoiceToEdit.number || '')
        setAmountMajor(invoiceToEdit.amountMinor ? (invoiceToEdit.amountMinor / 100).toString() : '0')
        setHours(invoiceToEdit.hours ? invoiceToEdit.hours.toString() : '')
        setMilestoneId(invoiceToEdit.milestoneId)
        setStatus(invoiceToEdit.status === 'sent' ? 'sent' : 'draft')
        setIssueDate(invoiceToEdit.issueDate || '')
        setDueDate(invoiceToEdit.dueDate || '')
        setExternalUrl(invoiceToEdit.externalUrl || '')
        setNotes(invoiceToEdit.notes || '')
      } else {
        const today = localToday()
        setLabel('')
        setNumber('')
        setAmountMajor('')
        setHours('')
        setMilestoneId(defaultMilestoneId)
        setStatus('draft')
        setIssueDate(today)
        setDueDate(addDays(today, invoiceNetDays))
        setExternalUrl('')
        setNotes('')
      }
      setError(null)
      setTimeout(() => labelInputRef.current?.focus(), 50)
    }
  }, [isOpen, invoiceToEdit, defaultMilestoneId, invoiceNetDays])

  if (!isOpen) return null

  // Auto-compute amount if hourly
  const handleHoursChange = (val: string) => {
    setHours(val)
    const numHours = parseFloat(val.replace(',', '.'))
    if (!isNaN(numHours) && project.billingType === 'hourly' && project.hourlyRateMinor) {
      const computedMinor = Math.round(numHours * project.hourlyRateMinor)
      setAmountMajor((computedMinor / 100).toString())
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!label.trim()) {
      setError('Label is required')
      return
    }

    const cleanAmount = amountMajor.replace(',', '.').trim()
    const parsedAmount = parseFloat(cleanAmount)
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      setError('Valid amount is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const amountMinor = Math.round(parsedAmount * 100)
      const numHours = hours.trim() ? parseFloat(hours.replace(',', '.')) : null

      await onSave({
        id: invoiceToEdit?.id,
        label: label.trim(),
        number: number.trim() || null,
        amountMinor,
        currency: project.currency,
        hours: isNaN(Number(numHours)) ? null : numHours,
        milestoneId: milestoneId || null,
        status: isEditing ? undefined : status,
        issueDate: issueDate || null,
        dueDate: dueDate || null,
        externalUrl: externalUrl.trim() || null,
        notes: notes.trim() || null,
      })
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to save invoice')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto"
      onKeyDown={(e) =>
        handleFormKeys(e, {
          onSubmit: () => handleSubmit(),
          onCancel: onClose,
          onDelete: isEditing && onDelete ? () => onDelete(invoiceToEdit.id) : undefined,
        })
      }
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Invoice' : 'New Invoice'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Invoice Label *
            </label>
            <input
              ref={labelInputRef}
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Deposit 50%, Milestone 1, Final payment"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Invoice Number (optional)
              </label>
              <input
                type="text"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                placeholder="e.g. 2026-001"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Amount ({project.currency}) *
              </label>
              <input
                type="text"
                value={amountMajor}
                onChange={(e) => setAmountMajor(e.target.value)}
                placeholder="4000.00"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-mono"
              />
            </div>
          </div>

          {project.billingType === 'hourly' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Hours Billed
              </label>
              <input
                type="text"
                value={hours}
                onChange={(e) => handleHoursChange(e.target.value)}
                placeholder="e.g. 25"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Linked Milestone
            </label>
            <select
              value={milestoneId || ''}
              onChange={(e) => setMilestoneId(e.target.value || null)}
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
            >
              <option value="">None (General invoice)</option>
              {milestones.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Issue Date
              </label>
              <input
                type="date"
                value={issueDate}
                onChange={(e) => setIssueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              External Link (optional)
            </label>
            <input
              type="url"
              value={externalUrl}
              onChange={(e) => setExternalUrl(e.target.value)}
              placeholder="https://invoicing.example.com/inv-123"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Payment terms, bank details, or internal notes..."
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <div>
            {isEditing && onDelete && (
              <button
                type="button"
                onClick={() => onDelete(invoiceToEdit.id)}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1"
              >
                <Trash2 size={13} />
                <span>Delete</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEditing ? 'Save changes' : 'Create invoice'} (⌘↵)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
