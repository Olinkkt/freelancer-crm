'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  X,
  Building2,
  Calendar,
  DollarSign,
  Briefcase,
  AlertCircle,
  Trash2,
  ExternalLink,
} from 'lucide-react'
import type { Project, ProjectTemplate } from '@/lib/projects/types'
import type { Deal, Company } from '@/lib/crm-types'
import { Combobox } from '@/components/ui/combobox'
import { parseDateInput, localToday, addDays } from '@/lib/projects/dates'
import { formatMinor, scheduleInvoices } from '@/lib/projects/money'
import {
  createProjectAction,
  updateProjectAction,
  deleteProjectAction,
  fetchProjectConfigAction,
} from '@/app/actions/projects'
import { fetchWorkspaceData } from '@/app/actions/crm'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'
import { handleFormKeys } from '@/components/shortcuts/form-keys'
import { OPERATOR_CONFIG } from '@/lib/config'

interface ProjectSheetProps {
  projectToEdit?: Project | null
  initialDealId?: string | null
  initialCompany?: string | null
  isOpen: boolean
  onClose: () => void
  onProjectCreated?: (projectId: string) => void
  onProjectUpdated?: (project: Project) => void
  onProjectDeleted?: (projectId: string) => void
}

export function ProjectSheet({
  projectToEdit,
  initialDealId = null,
  initialCompany = null,
  isOpen,
  onClose,
  onProjectCreated,
  onProjectUpdated,
  onProjectDeleted,
}: ProjectSheetProps) {
  const router = useRouter()
  const isEditing = !!projectToEdit

  // Form Fields
  const [title, setTitle] = useState('')
  const [company, setCompany] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [dealId, setDealId] = useState<string | null>(null)
  const [templateId, setTemplateId] = useState('tpl-website')
  const [billingType, setBillingType] = useState<'fixed' | 'hourly' | 'retainer'>('fixed')
  const [budgetMajor, setBudgetMajor] = useState('')
  const [hourlyRateMajor, setHourlyRateMajor] = useState('')
  const [estimateHours, setEstimateHours] = useState('')
  const [paymentSchedule, setPaymentSchedule] = useState<
    'none' | 'upfront_100' | 'split_50_50' | 'split_30_40_30' | 'per_milestone' | 'monthly'
  >('split_50_50')
  const [startDateText, setStartDateText] = useState('')
  const [dueDateText, setDueDateText] = useState('')
  const [revisionsIncluded, setRevisionsIncluded] = useState<string>('2')
  const [health, setHealth] = useState<'on_track' | 'at_risk' | 'blocked' | null>(null)

  // Loaded Options
  const [companies, setCompanies] = useState<Company[]>([])
  const [deals, setDeals] = useState<Deal[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])

  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<{ message: string; code?: string; dealHasProjectUrl?: string } | null>(null)

  const titleInputRef = useRef<HTMLInputElement>(null)
  const today = localToday()

  useEscapeLayer(onClose, isOpen)

  // Load config & CRM data
  useEffect(() => {
    if (isOpen) {
      fetchProjectConfigAction().then((res) => {
        if (res.ok && res.data) {
          setTemplates(res.data.templates)
        }
      })
      fetchWorkspaceData().then((ws) => {
        setCompanies(ws.companies || [])
        setDeals(ws.deals || [])
      })
    }
  }, [isOpen])

  // Initialize values
  useEffect(() => {
    if (isOpen) {
      setError(null)
      if (projectToEdit) {
        setTitle(projectToEdit.title)
        setCompany(projectToEdit.company)
        setContactName(projectToEdit.contactName || '')
        setContactEmail(projectToEdit.contactEmail || '')
        setBillingType(projectToEdit.billingType)
        setBudgetMajor(projectToEdit.budgetMinor ? (projectToEdit.budgetMinor / 100).toString() : '')
        setHourlyRateMajor(
          projectToEdit.hourlyRateMinor ? (projectToEdit.hourlyRateMinor / 100).toString() : ''
        )
        setEstimateHours(projectToEdit.estimateHours ? projectToEdit.estimateHours.toString() : '')
        setStartDateText(projectToEdit.startDate || '')
        setDueDateText(projectToEdit.dueDate || '')
        setRevisionsIncluded(
          projectToEdit.revisionsIncluded !== null ? projectToEdit.revisionsIncluded.toString() : ''
        )
        setHealth(projectToEdit.health)
      } else {
        setTitle('')
        setCompany(initialCompany || '')
        setContactName('')
        setContactEmail('')
        setDealId(initialDealId)
        setTemplateId('tpl-website')
        setBillingType('fixed')
        setBudgetMajor('8000')
        setHourlyRateMajor('100')
        setEstimateHours('40')
        setPaymentSchedule('split_50_50')
        setStartDateText('today')
        setDueDateText('+5w')
        setRevisionsIncluded('2')
        setHealth(null)

        // If deal is given, prefill from deal
        if (initialDealId) {
          fetchWorkspaceData().then((ws) => {
            const found = ws.deals.find((d) => d.id === initialDealId)
            if (found) {
              setTitle(found.title)
              setCompany(found.company)
              setContactName(found.contactName || '')
              setContactEmail(found.contactEmail || '')
              if (found.value) {
                setBudgetMajor(found.value.toString())
              }
            }
          })
        }
      }
      setTimeout(() => titleInputRef.current?.focus(), 50)
    }
  }, [isOpen, projectToEdit, initialDealId, initialCompany])

  if (!isOpen) return null

  // Resolved dates
  const resolvedStartDate = startDateText.trim()
    ? parseDateInput(startDateText.trim(), today) || startDateText.trim()
    : today

  const resolvedDueDate = dueDateText.trim()
    ? parseDateInput(dueDateText.trim(), resolvedStartDate) || dueDateText.trim()
    : null

  // Invoices preview line
  const parsedBudgetMinor = budgetMajor.trim()
    ? Math.round(parseFloat(budgetMajor.replace(',', '.')) * 100)
    : 0

  const scheduledInvoices = scheduleInvoices(
    paymentSchedule,
    parsedBudgetMinor,
    [],
    resolvedStartDate
  )

  const scheduledInvoicesPreview = scheduledInvoices
    .map((inv) => {
      const amt = formatMinor(inv.amountMinor, 'EUR', {
        currency: 'EUR',
        currencySymbol: '€',
        locale: OPERATOR_CONFIG.locale || 'en-US',
      })
      return `${inv.label} ${amt} (draft)`
    })
    .join(' · ')

  const selectedTemplate = templates.find((t) => t.id === templateId)

  // Handle template selection change
  const handleTemplateChange = (tId: string) => {
    setTemplateId(tId)
    const tpl = templates.find((t) => t.id === tId)
    if (tpl) {
      setBillingType(tpl.billingType)
      setPaymentSchedule(tpl.paymentSchedule)
      if (tpl.revisionsIncluded !== null) {
        setRevisionsIncluded(tpl.revisionsIncluded.toString())
      }
      if (tpl.durationDays) {
        setDueDateText(`+${Math.round(tpl.durationDays / 7)}w`)
      }
    }
  }

  // Handle deal selection change
  const handleDealChange = (dId: string) => {
    setDealId(dId || null)
    if (dId) {
      const deal = deals.find((d) => d.id === dId)
      if (deal) {
        if (!title.trim()) setTitle(deal.title)
        if (!company.trim()) setCompany(deal.company)
        if (deal.contactName && !contactName.trim()) setContactName(deal.contactName)
        if (deal.contactEmail && !contactEmail.trim()) setContactEmail(deal.contactEmail)
        if (deal.value && !budgetMajor.trim()) setBudgetMajor(deal.value.toString())
      }
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!title.trim()) {
      setError({ message: 'Project title is required' })
      return
    }
    if (!company.trim()) {
      setError({ message: 'Client company is required' })
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      if (isEditing) {
        const patch: any = {
          title: title.trim(),
          company: company.trim(),
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          billingType,
          budgetMinor: parsedBudgetMinor || null,
          hourlyRateMajor: hourlyRateMajor.trim() ? parseFloat(hourlyRateMajor) : null,
          estimateHours: estimateHours.trim() ? parseFloat(estimateHours) : null,
          startDate: resolvedStartDate || null,
          dueDate: resolvedDueDate || null,
          revisionsIncluded: revisionsIncluded.trim() ? parseInt(revisionsIncluded, 10) : null,
          health,
        }

        const res = await updateProjectAction({
          id: projectToEdit.id,
          patch,
        })

        if (!res.ok) {
          setError({ message: res.error.message })
          return
        }

        onProjectUpdated?.(res.data)
        onClose()
      } else {
        const res = await createProjectAction({
          title: title.trim(),
          company: company.trim(),
          dealId: dealId || null,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          templateId,
          billingType,
          budgetMinor: parsedBudgetMinor || null,
          hourlyRateMinor: hourlyRateMajor.trim()
            ? Math.round(parseFloat(hourlyRateMajor) * 100)
            : null,
          estimateHours: estimateHours.trim() ? parseFloat(estimateHours) : null,
          paymentSchedule,
          startDate: resolvedStartDate,
          dueDate: resolvedDueDate,
          today,
        })

        if (!res.ok) {
          if (res.error.code === 'DEAL_ALREADY_HAS_PROJECT') {
            const linkedDeal = deals.find((d) => d.id === dealId)
            setError({
              message: 'This deal already has a project.',
              code: 'DEAL_ALREADY_HAS_PROJECT',
              dealHasProjectUrl: linkedDeal?.projectId
                ? `/projects/${linkedDeal.projectId}`
                : undefined,
            })
          } else {
            setError({ message: res.error.message })
          }
          return
        }

        onProjectCreated?.(res.data.project.id)
        onClose()
        router.push(`/projects/${res.data.project.id}`)
      }
    } catch (err: any) {
      setError({ message: err?.message || 'Operation failed' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!projectToEdit) return
    if (!confirm(`Are you sure you want to delete project "${projectToEdit.title}"?`)) {
      return
    }

    setIsSubmitting(true)
    try {
      const res = await deleteProjectAction({ id: projectToEdit.id })
      if (res.ok) {
        onProjectDeleted?.(projectToEdit.id)
        onClose()
        router.push('/?view=projects')
      } else {
        setError({ message: res.error.message })
      }
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
          onDelete: isEditing ? handleDelete : undefined,
        })
      }
    >
      <div
        className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-100"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 dark:text-slate-100">
            {isEditing ? 'Edit Project Details' : 'Start Project'}
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
            <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900/40 text-red-600 dark:text-red-400 flex items-center justify-between">
              <span>{error.message}</span>
              {error.dealHasProjectUrl && (
                <Link
                  href={error.dealHasProjectUrl}
                  onClick={onClose}
                  className="font-semibold underline ml-2 flex items-center gap-1"
                >
                  <span>Open it</span>
                  <ExternalLink size={12} />
                </Link>
              )}
            </div>
          )}

          {/* Title */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Project Title *
            </label>
            <input
              ref={titleInputRef}
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Acme Website Redesign"
              className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none focus:border-blue-500 text-slate-900 dark:text-slate-100 font-medium"
            />
          </div>

          {/* Client & Contact */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Client (Company) *
              </label>
              <Combobox
                value={company}
                onChange={setCompany}
                options={companies.map((c) => ({ label: c.name, value: c.name }))}
                placeholder="Select or enter company..."
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Contact Name
                </label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jana Nová"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Contact Email
                </label>
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="jana@acme.cz"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          </div>

          {/* Deal & Template (Start mode only) */}
          {!isEditing && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  From Deal (optional)
                </label>
                <select
                  value={dealId || ''}
                  onChange={(e) => handleDealChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200"
                >
                  <option value="">None (Scratch project)</option>
                  {deals.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.title} ({d.stage} · {d.company})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Template
                </label>
                <select
                  value={templateId}
                  onChange={(e) => handleTemplateChange(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200 font-medium"
                >
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Billing Type Radios */}
          <div className="space-y-1.5">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Billing Type
            </label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  value="fixed"
                  checked={billingType === 'fixed'}
                  onChange={() => setBillingType('fixed')}
                  className="text-blue-600"
                />
                <span>Fixed Price</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  value="hourly"
                  checked={billingType === 'hourly'}
                  onChange={() => setBillingType('hourly')}
                  className="text-blue-600"
                />
                <span>Hourly Rate</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="radio"
                  name="billingType"
                  value="retainer"
                  checked={billingType === 'retainer'}
                  onChange={() => setBillingType('retainer')}
                  className="text-blue-600"
                />
                <span>Monthly Retainer</span>
              </label>
            </div>
          </div>

          {/* Budget / Rate Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {billingType === 'fixed' || billingType === 'retainer' ? (
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  {billingType === 'retainer' ? 'Monthly Fee' : 'Budget'} (EUR)
                </label>
                <input
                  type="text"
                  value={budgetMajor}
                  onChange={(e) => setBudgetMajor(e.target.value)}
                  placeholder="8000"
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100 font-mono font-medium"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Hourly Rate
                  </label>
                  <input
                    type="text"
                    value={hourlyRateMajor}
                    onChange={(e) => setHourlyRateMajor(e.target.value)}
                    placeholder="100"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-slate-700 dark:text-slate-300">
                    Est. Hours
                  </label>
                  <input
                    type="text"
                    value={estimateHours}
                    onChange={(e) => setEstimateHours(e.target.value)}
                    placeholder="40"
                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100 font-mono"
                  />
                </div>
              </div>
            )}

            {!isEditing && (
              <div className="space-y-1">
                <label className="font-semibold text-slate-700 dark:text-slate-300">
                  Payment Schedule
                </label>
                <select
                  value={paymentSchedule}
                  onChange={(e) => setPaymentSchedule(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-800 dark:text-slate-200 font-medium"
                >
                  <option value="none">None (create invoices manually)</option>
                  <option value="upfront_100">100% Upfront</option>
                  <option value="split_50_50">50/50 (Deposit &amp; Final)</option>
                  <option value="split_30_40_30">30/40/30 (Three milestones)</option>
                  <option value="per_milestone">Per milestone</option>
                  <option value="monthly">Monthly retainer invoice</option>
                </select>
              </div>
            )}
          </div>

          {/* Dates: Start & Due */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Start Date
              </label>
              <input
                type="text"
                value={startDateText}
                onChange={(e) => setStartDateText(e.target.value)}
                placeholder='e.g. "today", "2026-10-01"'
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
              />
              <div className="text-[10px] text-slate-400 pl-1">{resolvedStartDate}</div>
            </div>

            <div className="space-y-1">
              <label className="font-semibold text-slate-700 dark:text-slate-300">
                Due Date
              </label>
              <input
                type="text"
                value={dueDateText}
                onChange={(e) => setDueDateText(e.target.value)}
                placeholder='e.g. "+5w", "fri", "2026-11-15"'
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
              />
              <div className="text-[10px] text-slate-400 pl-1">
                {resolvedDueDate || 'No due date'}
              </div>
            </div>
          </div>

          {/* Revisions Included */}
          <div className="space-y-1">
            <label className="font-semibold text-slate-700 dark:text-slate-300">
              Included Revision Rounds
            </label>
            <input
              type="number"
              min={0}
              max={20}
              value={revisionsIncluded}
              onChange={(e) => setRevisionsIncluded(e.target.value)}
              placeholder="e.g. 2"
              className="w-32 px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          {/* Scheduled Invoices preview (Start mode only) */}
          {!isEditing && scheduledInvoicesPreview && (
            <div className="p-2.5 rounded-lg bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 font-medium">
              Creates: {scheduledInvoicesPreview}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-850/50 flex items-center justify-between">
          <div>
            {isEditing && (
              <button
                type="button"
                onClick={handleDelete}
                className="text-xs text-red-600 dark:text-red-400 hover:text-red-700 flex items-center gap-1 cursor-pointer"
                title="Delete project (⌘⌫)"
              >
                <Trash2 size={13} />
                <span>Delete project</span>
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => handleSubmit()}
              disabled={isSubmitting}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isEditing ? 'Save changes' : 'Create project'} (⌘↵)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
