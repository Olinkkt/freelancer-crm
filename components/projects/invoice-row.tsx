'use client'

import React from 'react'
import { ExternalLink, Clock, Check, AlertCircle, Ban } from 'lucide-react'
import type { Invoice } from '@/lib/projects/types'
import { formatMinor, isOverdue } from '@/lib/projects/money'
import { formatRelativeDate, localToday, diffDays } from '@/lib/projects/dates'
import { OPERATOR_CONFIG } from '@/lib/config'

interface InvoiceRowProps {
  invoice: Invoice
  isSelected?: boolean
  isReadOnly?: boolean
  onSelect?: () => void
  onEdit?: () => void
  onMarkSent?: () => void
  onMarkPaid?: () => void
  onVoid?: () => void
  onDelete?: () => void
}

export function InvoiceRow({
  invoice,
  isSelected = false,
  isReadOnly = false,
  onSelect,
  onEdit,
  onMarkSent,
  onMarkPaid,
  onVoid,
  onDelete,
}: InvoiceRowProps) {
  const today = localToday()
  const overdue = isOverdue(invoice, today)

  const formattedAmount = formatMinor(invoice.amountMinor, invoice.currency, {
    currency: invoice.currency,
    currencySymbol: invoice.currency === 'EUR' ? '€' : '$',
    locale: OPERATOR_CONFIG.locale || 'en-US',
  })

  // Status chip content
  let statusText = ''
  let statusColor = ''

  if (invoice.status === 'draft') {
    statusText = 'draft'
    statusColor = 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
  } else if (invoice.status === 'sent') {
    if (overdue && invoice.dueDate) {
      const days = diffDays(invoice.dueDate, today)
      statusText = `overdue ${days}d`
      statusColor = 'bg-red-50 dark:bg-red-950/50 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/40 font-semibold'
    } else if (invoice.dueDate) {
      statusText = `due ${formatRelativeDate(invoice.dueDate, today)}`
      statusColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
    } else {
      statusText = 'sent'
      statusColor = 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400'
    }
  } else if (invoice.status === 'paid') {
    statusText = invoice.paidDate ? `paid ${invoice.paidDate.slice(0, 10)}` : 'paid'
    statusColor = 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 font-semibold'
  } else if (invoice.status === 'void') {
    statusText = 'void'
    statusColor = 'bg-slate-100 dark:bg-slate-800 text-slate-400 line-through'
  }

  return (
    <div
      onClick={onSelect}
      onDoubleClick={onEdit}
      className={`group flex items-center justify-between p-2 rounded-lg text-xs transition-colors cursor-pointer select-none ${
        isSelected
          ? 'bg-blue-50/80 dark:bg-blue-950/40 ring-1 ring-blue-500/50'
          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
      }`}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span
              className={`font-semibold ${
                invoice.status === 'void'
                  ? 'line-through text-slate-400 dark:text-slate-500'
                  : 'text-slate-900 dark:text-slate-100'
              }`}
            >
              {invoice.label}
            </span>
            {invoice.number && (
              <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                #{invoice.number}
              </span>
            )}
            {invoice.externalUrl && (
              <a
                href={invoice.externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-blue-500 hover:text-blue-600 dark:hover:text-blue-400 inline-flex items-center"
                title="Open external invoice"
              >
                <ExternalLink size={10} />
              </a>
            )}
          </div>
          {invoice.hours !== null && invoice.hours > 0 && (
            <div className="text-[10px] text-slate-400">
              {invoice.hours} hour{invoice.hours === 1 ? '' : 's'}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0 ml-2">
        <span
          className={`font-mono font-medium ${
            invoice.status === 'void'
              ? 'line-through text-slate-400'
              : 'text-slate-800 dark:text-slate-200'
          }`}
        >
          {formattedAmount}
        </span>
        <span className={`px-2 py-0.5 rounded-full text-[10px] ${statusColor}`}>
          {statusText}
        </span>
      </div>
    </div>
  )
}
