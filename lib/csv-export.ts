import { Deal, Company, Contact, Activity, FollowUpItem } from '@/lib/crm-types'

/**
 * Escapes a cell value and encloses in quotes if necessary
 */
function escapeCSV(val: any): string {
  if (val === null || val === undefined) return '""'
  if (typeof val === 'object') {
    val = JSON.stringify(val)
  }
  const str = String(val).replace(/"/g, '""')
  return `"${str}"`
}

/**
 * Converts an array of objects to a RFC 4180 compliant CSV string
 */
export function generateCSV<T extends Record<string, any>>(
  data: T[],
  headers: { key: keyof T; label: string }[]
): string {
  const headerRow = headers.map((h) => escapeCSV(h.label)).join(',')
  const rows = data.map((item) =>
    headers.map((h) => escapeCSV(item[h.key])).join(',')
  )
  return [headerRow, ...rows].join('\n')
}

/**
 * Initiates client-side download of a generated CSV file
 */
export function triggerDownload(content: string, filename: string): void {
  const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' }) // \uFEFF for Excel UTF-8 BOM
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Export Deals as CSV
 */
export function exportDealsCSV(deals: Deal[]): void {
  const headers = [
    { key: 'id' as const, label: 'Deal ID' },
    { key: 'title' as const, label: 'Title' },
    { key: 'company' as const, label: 'Company' },
    { key: 'value' as const, label: 'Value (Display)' },
    { key: 'rawAmount' as const, label: 'Raw Amount (CZK)' },
    { key: 'stage' as const, label: 'Stage' },
    { key: 'probability' as const, label: 'Probability' },
    { key: 'next' as const, label: 'Next Action' },
    { key: 'nextDueDate' as const, label: 'Next Due Date' },
    { key: 'startDate' as const, label: 'Start Date' },
    { key: 'endDate' as const, label: 'End Date' },
    { key: 'contactName' as const, label: 'Contact Name' },
    { key: 'contactEmail' as const, label: 'Contact Email' },
    { key: 'notes' as const, label: 'Internal Notes' },
    { key: 'createdAt' as const, label: 'Created At' },
  ]
  const csv = generateCSV(deals, headers)
  const dateStr = new Date().toISOString().split('T')[0]
  triggerDownload(csv, `freelancer-crm-deals-${dateStr}.csv`)
}

/**
 * Export Companies as CSV
 */
export function exportCompaniesCSV(companies: Company[]): void {
  const headers = [
    { key: 'id' as const, label: 'Company ID' },
    { key: 'name' as const, label: 'Company Name' },
    { key: 'type' as const, label: 'Type' },
    { key: 'contact' as const, label: 'Primary Contact' },
    { key: 'email' as const, label: 'Email' },
    { key: 'deals' as const, label: 'Active Deals Count' },
    { key: 'value' as const, label: 'Total Value' },
    { key: 'status' as const, label: 'Status' },
    { key: 'color' as const, label: 'Color Tag' },
  ]
  const csv = generateCSV(companies, headers)
  const dateStr = new Date().toISOString().split('T')[0]
  triggerDownload(csv, `freelancer-crm-companies-${dateStr}.csv`)
}

/**
 * Export Contacts as CSV
 */
export function exportContactsCSV(contacts: Contact[]): void {
  const headers = [
    { key: 'id' as const, label: 'Contact ID' },
    { key: 'name' as const, label: 'Full Name' },
    { key: 'role' as const, label: 'Role' },
    { key: 'company' as const, label: 'Company' },
    { key: 'email' as const, label: 'Email' },
    { key: 'phone' as const, label: 'Phone' },
    { key: 'deals' as const, label: 'Deals Count' },
    { key: 'lastTouch' as const, label: 'Last Touch' },
  ]
  const csv = generateCSV(contacts, headers)
  const dateStr = new Date().toISOString().split('T')[0]
  triggerDownload(csv, `freelancer-crm-contacts-${dateStr}.csv`)
}

/**
 * Export Activities as CSV
 */
export function exportActivitiesCSV(activities: Activity[]): void {
  const headers = [
    { key: 'id' as const, label: 'Activity ID' },
    { key: 'type' as const, label: 'Type' },
    { key: 'title' as const, label: 'Title' },
    { key: 'person' as const, label: 'Person' },
    { key: 'company' as const, label: 'Company' },
    { key: 'date' as const, label: 'Date' },
    { key: 'status' as const, label: 'Status' },
    { key: 'summary' as const, label: 'Summary' },
    { key: 'dealId' as const, label: 'Linked Deal ID' },
  ]
  const csv = generateCSV(activities, headers)
  const dateStr = new Date().toISOString().split('T')[0]
  triggerDownload(csv, `freelancer-crm-activities-${dateStr}.csv`)
}

/**
 * Export Follow-ups as CSV
 */
export function exportFollowUpsCSV(followUps: FollowUpItem[]): void {
  const headers = [
    { key: 'id' as const, label: 'Follow-up ID' },
    { key: 'company' as const, label: 'Company' },
    { key: 'action' as const, label: 'Action Task' },
    { key: 'time' as const, label: 'Scheduled Time' },
    { key: 'day' as const, label: 'Target Day' },
    { key: 'tone' as const, label: 'Tone / Priority' },
    { key: 'completed' as const, label: 'Completed' },
  ]
  const csv = generateCSV(followUps, headers)
  const dateStr = new Date().toISOString().split('T')[0]
  triggerDownload(csv, `freelancer-crm-followups-${dateStr}.csv`)
}
