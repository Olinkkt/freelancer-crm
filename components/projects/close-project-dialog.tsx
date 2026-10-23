'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  CheckCircle2,
  XCircle,
  AlertCircle,
  DollarSign,
  ListTodo,
  Calendar,
  Archive,
  Save,
} from 'lucide-react'
import type { Project, Invoice } from '@/lib/projects/types'
import { formatMinor } from '@/lib/projects/money'
import { localToday } from '@/lib/projects/dates'
import { buildCloseProjectInput } from '@/lib/projects/ui-helpers'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { handleFormKeys } from '@/components/shortcuts/form-keys'
import { OPERATOR_CONFIG } from '@/lib/config'

interface CloseProjectDialogProps {
  project: Project
  invoices: Invoice[]
  openTasksCount: number
  isOpen: boolean
  onClose: () => void
  onCloseProject: (input: any) => Promise<void>
}

export function CloseProjectDialog({
  project,
  invoices,
  openTasksCount,
  isOpen,
  onClose,
  onCloseProject,
}: CloseProjectDialogProps) {
  const [outcome, setOutcome] = useState<'completed' | 'cancelled'>('completed')
  const [reason, setReason] = useState('')
  const [paidInvoiceIds, setPaidInvoiceIds] = useState<string[]>([])
  const [unpaidResolution, setUnpaidResolution] = useState<'leave_open' | 'void_open'>('leave_open')
  const [openTasks, setOpenTasks] = useState<'keep' | 'complete' | 'delete'>('complete')
  const [testimonialFollowUp, setTestimonialFollowUp] = useState(true)
  const [retainerFollowUp, setRetainerFollowUp] = useState(false)
  const [checkInFollowUp, setCheckInFollowUp] = useState(false)
  const [saveAsTemplate, setSaveAsTemplate] = useState(false)
  const [templateName, setTemplateName] = useState('')
  const [archive, setArchive] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = localToday()
  useEscapeLayer(onClose, isOpen)

  const unpaidInvoices = invoices.filter(
    (inv) => inv.status === 'draft' || inv.status === 'sent'
  )

  useEffect(() => {
    if (isOpen) {
      setOutcome('completed')
      setReason('')
      setPaidInvoiceIds([])
      setUnpaidResolution('leave_open')
      setOpenTasks(openTasksCount > 0 ? 'complete' : 'keep')
      setTestimonialFollowUp(true)
      setRetainerFollowUp(false)
      setCheckInFollowUp(false)
      setSaveAsTemplate(false)
      setTemplateName(project.title)
      setArchive(false)
      setError(null)
    }
  }, [isOpen, openTasksCount, project.title])

  if (!isOpen) return null

  const remainingUnpaidCount = unpaidInvoices.filter(
    (inv) => !paidInvoiceIds.includes(inv.id)
  ).length

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (outcome === 'cancelled' && !reason.trim()) {
      setError('A cancellation reason is required')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const input = buildCloseProjectInput({
        projectId: project.id,
        outcome,
        reason: reason.trim() || null,
        unpaidInvoices,
        paidInvoiceIds,
        unpaidResolution,
        openTasks,
        followUps: {
          testimonial: testimonialFollowUp,
          retainer: retainerFollowUp,
          checkIn: checkInFollowUp,
        },
        saveAsTemplateName: saveAsTemplate && templateName.trim() ? templateName.trim() : null,
        archive,
        today,
      })

      await onCloseProject(input)
      onClose()
    } catch (err: any) {
      setError(err?.message || 'Failed to close project')
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
        })
      }
    >
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">Close Project</h2>
            <span className="text-xs text-slate-400">· {project.title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {/* Outcome Choice */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Project Outcome
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setOutcome('completed')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 font-medium transition-colors ${
                  outcome === 'completed'
                    ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <CheckCircle2 size={15} className="text-emerald-600 dark:text-emerald-400" />
                <span>Completed</span>
              </button>

              <button
                type="button"
                onClick={() => setOutcome('cancelled')}
                className={`p-2.5 rounded-xl border flex items-center gap-2 font-medium transition-colors ${
                  outcome === 'cancelled'
                    ? 'border-red-500 bg-red-50/50 dark:bg-red-950/30 text-red-800 dark:text-red-200'
                    : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <XCircle size={15} className="text-red-600 dark:text-red-400" />
                <span>Cancelled</span>
              </button>
            </div>
          </div>

          {/* Reason if cancelled */}
          {outcome === 'cancelled' && (
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Cancellation Reason *
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Client paused budget, scope altered"
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-red-500 text-slate-900 dark:text-slate-100"
              />
            </div>
          )}

          {/* Unpaid Invoices Resolution */}
          {unpaidInvoices.length > 0 && (
            <div className="space-y-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/60">
              <div className="flex items-center gap-1.5 font-semibold text-slate-800 dark:text-slate-200">
                <DollarSign size={13} className="text-blue-500" />
                <span>Unpaid Invoices ({unpaidInvoices.length})</span>
              </div>

              {/* Invoices list with mark paid checkboxes */}
              <div className="space-y-1">
                {unpaidInvoices.map((inv) => {
                  const isMarkedPaid = paidInvoiceIds.includes(inv.id)
                  const amt = formatMinor(inv.amountMinor, inv.currency, {
                    currency: inv.currency,
                    currencySymbol: inv.currency === 'EUR' ? '€' : '$',
                    locale: OPERATOR_CONFIG.locale || 'en-US',
                  })
                  return (
                    <label
                      key={inv.id}
                      className="flex items-center justify-between p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700/40 cursor-pointer"
                    >
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={isMarkedPaid}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setPaidInvoiceIds((prev) => [...prev, inv.id])
                            } else {
                              setPaidInvoiceIds((prev) => prev.filter((id) => id !== inv.id))
                            }
                          }}
                          className="rounded text-blue-600 focus:ring-0"
                        />
                        <span className="font-medium text-slate-800 dark:text-slate-200">
                          {inv.label}
                        </span>
                        <span className="text-[10px] text-slate-400 capitalize">
                          ({inv.status})
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-slate-700 dark:text-slate-300">{amt}</span>
                        <span className="text-[10px] text-blue-600 dark:text-blue-400">
                          Mark paid today
                        </span>
                      </div>
                    </label>
                  )
                })}
              </div>

              {/* Resolution for remaining unpaid invoices */}
              {remainingUnpaidCount > 0 && (
                <div className="pt-2 border-t border-slate-200 dark:border-slate-700 space-y-1">
                  <div className="font-medium text-slate-700 dark:text-slate-300">
                    Remaining unpaid invoices ({remainingUnpaidCount}):
                  </div>
                  <div className="flex items-center gap-4 text-xs">
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="unpaidResolution"
                        value="leave_open"
                        checked={unpaidResolution === 'leave_open'}
                        onChange={() => setUnpaidResolution('leave_open')}
                        className="text-blue-600"
                      />
                      <span>Leave open</span>
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="radio"
                        name="unpaidResolution"
                        value="void_open"
                        checked={unpaidResolution === 'void_open'}
                        onChange={() => setUnpaidResolution('void_open')}
                        className="text-blue-600"
                      />
                      <span>Void remaining</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Open Tasks Handling */}
          {openTasksCount > 0 && (
            <div className="space-y-1.5">
              <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                <ListTodo size={13} className="text-blue-500" />
                <span>Open Tasks ({openTasksCount})</span>
              </label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="openTasks"
                    value="keep"
                    checked={openTasks === 'keep'}
                    onChange={() => setOpenTasks('keep')}
                    className="text-blue-600"
                  />
                  <span>Keep</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="openTasks"
                    value="complete"
                    checked={openTasks === 'complete'}
                    onChange={() => setOpenTasks('complete')}
                    className="text-blue-600"
                  />
                  <span>Complete</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="openTasks"
                    value="delete"
                    checked={openTasks === 'delete'}
                    onChange={() => setOpenTasks('delete')}
                    className="text-blue-600"
                  />
                  <span>Delete</span>
                </label>
              </div>
            </div>
          )}

          {/* Follow-ups Checkboxes */}
          <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Schedule Follow-up Activities
            </label>
            <div className="space-y-1.5">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={testimonialFollowUp}
                  onChange={(e) => setTestimonialFollowUp(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Ask for a testimonial (&apos;This week&apos;)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={retainerFollowUp}
                  onChange={(e) => setRetainerFollowUp(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Pitch a retainer (&apos;Next week&apos;)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={checkInFollowUp}
                  onChange={(e) => setCheckInFollowUp(e.target.checked)}
                  className="rounded text-blue-600 focus:ring-0"
                />
                <span>Check in (&apos;Later&apos;)</span>
              </label>
            </div>
          </div>

          {/* Save as Template & Archive */}
          <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={saveAsTemplate}
                onChange={(e) => setSaveAsTemplate(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span>Save project structure as template</span>
            </label>
            {saveAsTemplate && (
              <input
                type="text"
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder="Template name"
                className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
              />
            )}

            <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={archive}
                onChange={(e) => setArchive(e.target.checked)}
                className="rounded text-blue-600 focus:ring-0"
              />
              <span>Archive project immediately</span>
            </label>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-end gap-2">
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
            Close project (⌘↵)
          </button>
        </div>
      </div>
    </div>
  )
}
