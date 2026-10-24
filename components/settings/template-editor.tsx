'use client'

import React, { useState } from 'react'
import { Plus, Trash2, X, Check } from 'lucide-react'
import type { ProjectTemplate } from '@/lib/projects/types'
import { PAYMENT_SCHEDULES, type PaymentSchedule } from '@/lib/projects/constants'
import { upsertTemplateAction } from '@/app/actions/projects'

interface TemplateEditorProps {
  template: ProjectTemplate | null
  isOpen: boolean
  onClose: () => void
  onSaved: () => void
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

export function TemplateEditor({
  template,
  isOpen,
  onClose,
  onSaved,
  showToast,
}: TemplateEditorProps) {
  const [name, setName] = useState(template?.name ?? 'New Project Template')
  const [billingType, setBillingType] = useState<'fixed' | 'hourly' | 'retainer'>(
    template?.billingType ?? 'fixed'
  )
  const [paymentSchedule, setPaymentSchedule] = useState<PaymentSchedule>(
    template?.paymentSchedule ?? 'split_50_50'
  )
  const [durationDays, setDurationDays] = useState<number | ''>(template?.durationDays ?? 30)
  const [revisionsIncluded, setRevisionsIncluded] = useState<number | ''>(
    template?.revisionsIncluded ?? 2
  )

  const [milestones, setMilestones] = useState<
    Array<{ title: string; offsetDays: number; amountPct: number | null }>
  >(template?.milestones ? [...template.milestones] : [])

  const [tasks, setTasks] = useState<
    Array<{ title: string; milestoneIndex: number | null; offsetDays: number | null }>
  >(template?.tasks ? [...template.tasks] : [])

  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      showToast?.('Template name is required', 'warning')
      return
    }

    setIsSubmitting(true)
    try {
      const res = await upsertTemplateAction({
        id: template?.id,
        name: name.trim(),
        billingType,
        paymentSchedule,
        durationDays: durationDays === '' ? null : Number(durationDays),
        revisionsIncluded: revisionsIncluded === '' ? null : Number(revisionsIncluded),
        milestones,
        tasks,
      })

      if (res.ok) {
        showToast?.('Template saved', 'success')
        onSaved()
        onClose()
      } else {
        showToast?.(res.error.message || 'Failed to save template', 'error')
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error saving template', 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addMilestone = () => {
    setMilestones((prev) => [
      ...prev,
      { title: `Milestone ${prev.length + 1}`, offsetDays: (prev.length + 1) * 7, amountPct: 0 },
    ])
  }

  const removeMilestone = (index: number) => {
    setMilestones((prev) => prev.filter((_, i) => i !== index))
    // Clean up task references to this milestone
    setTasks((prev) =>
      prev.map((t) => {
        if (t.milestoneIndex === index) return { ...t, milestoneIndex: null }
        if (t.milestoneIndex !== null && t.milestoneIndex > index)
          return { ...t, milestoneIndex: t.milestoneIndex - 1 }
        return t
      })
    )
  }

  const addTask = () => {
    setTasks((prev) => [
      ...prev,
      { title: '', milestoneIndex: null, offsetDays: null },
    ])
  }

  const removeTask = (index: number) => {
    setTasks((prev) => prev.filter((_, i) => i !== index))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-6 space-y-5 my-8 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {template ? 'Edit Template' : 'New Project Template'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form body */}
        <form onSubmit={handleSave} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Template Name
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Config row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Billing Type
              </label>
              <select
                value={billingType}
                onChange={(e) => setBillingType(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="fixed">Fixed</option>
                <option value="hourly">Hourly</option>
                <option value="retainer">Retainer</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Payment Schedule
              </label>
              <select
                value={paymentSchedule}
                onChange={(e) => setPaymentSchedule(e.target.value as any)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
              >
                <option value="none">None</option>
                <option value="upfront_100">100% Upfront</option>
                <option value="split_50_50">50% Deposit / 50% Final</option>
                <option value="split_30_40_30">30% Deposit / 40% Mid / 30% Final</option>
                <option value="per_milestone">Per milestone</option>
                <option value="monthly">Monthly progress</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Default Duration (Days)
              </label>
              <input
                type="number"
                min={0}
                value={durationDays}
                onChange={(e) => setDurationDays(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Revisions Included
              </label>
              <input
                type="number"
                min={0}
                value={revisionsIncluded}
                onChange={(e) =>
                  setRevisionsIncluded(e.target.value === '' ? '' : Number(e.target.value))
                }
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
              />
            </div>
          </div>

          {/* Milestones list */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Milestones ({milestones.length})
              </span>
              <button
                type="button"
                onClick={addMilestone}
                className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1 font-medium"
              >
                <Plus size={12} />
                <span>Add Milestone</span>
              </button>
            </div>

            {milestones.map((m, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Milestone title"
                  value={m.title}
                  onChange={(e) => {
                    const val = e.target.value
                    setMilestones((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                    )
                  }}
                  className="flex-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="Day offset"
                  title="Offset days from start date"
                  value={m.offsetDays}
                  onChange={(e) => {
                    const val = Number(e.target.value)
                    setMilestones((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, offsetDays: val } : item))
                    )
                  }}
                  className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <input
                  type="number"
                  placeholder="% budget"
                  title="Payment % of total budget"
                  value={m.amountPct ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    setMilestones((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, amountPct: val } : item))
                    )
                  }}
                  className="w-20 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => removeMilestone(idx)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          {/* Tasks list */}
          <div className="space-y-2 pt-2 border-t border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                Tasks ({tasks.length})
              </span>
              <button
                type="button"
                onClick={addTask}
                className="text-xs text-blue-600 hover:text-blue-500 flex items-center gap-1 font-medium"
              >
                <Plus size={12} />
                <span>Add Task</span>
              </button>
            </div>

            {tasks.map((t, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs">
                <input
                  type="text"
                  placeholder="Task title"
                  value={t.title}
                  onChange={(e) => {
                    const val = e.target.value
                    setTasks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, title: val } : item))
                    )
                  }}
                  className="flex-1 px-2.5 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <select
                  value={t.milestoneIndex ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    setTasks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, milestoneIndex: val } : item))
                    )
                  }}
                  className="w-32 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                >
                  <option value="">No milestone</option>
                  {milestones.map((m, mIdx) => (
                    <option key={mIdx} value={mIdx}>
                      {m.title || `Milestone ${mIdx + 1}`}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Offset"
                  title="Offset days from start date"
                  value={t.offsetDays ?? ''}
                  onChange={(e) => {
                    const val = e.target.value === '' ? null : Number(e.target.value)
                    setTasks((prev) =>
                      prev.map((item, i) => (i === idx ? { ...item, offsetDays: val } : item))
                    )
                  }}
                  className="w-16 px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800"
                />
                <button
                  type="button"
                  onClick={() => removeTask(idx)}
                  className="text-slate-400 hover:text-rose-500 p-1"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 cursor-pointer"
            >
              Save Template
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
