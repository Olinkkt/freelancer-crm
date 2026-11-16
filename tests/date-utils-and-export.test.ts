import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  getDateString,
  getFormattedToday,
  getDynamicGreeting,
} from '../lib/date-utils'
import { generateCSV } from '../lib/csv-export'
import { Deal } from '../lib/crm-types'

describe('Date Utilities', () => {
  it('getDateString formats dates as YYYY-MM-DD', () => {
    const d = new Date(2026, 8, 25) // Sep 25, 2026
    assert.equal(getDateString(d), '2026-09-25')
  })

  it('getFormattedToday formats full localized string', () => {
    const d = new Date(2026, 8, 25) // Friday
    const str = getFormattedToday(d)
    assert.match(str, /Friday/i)
    assert.match(str, /September/i)
    assert.match(str, /25/i)
    assert.match(str, /2026/i)
  })

  it('getDynamicGreeting changes greeting according to time of day', () => {
    const morning = new Date(2026, 8, 25, 9, 30)
    assert.equal(getDynamicGreeting('Oliver', morning), 'Good morning, Oliver.')

    const afternoon = new Date(2026, 8, 25, 14, 15)
    assert.equal(getDynamicGreeting('Oliver', afternoon), 'Good afternoon, Oliver.')

    const evening = new Date(2026, 8, 25, 19, 45)
    assert.equal(getDynamicGreeting('Oliver', evening), 'Good evening, Oliver.')
  })

})


describe('CSV Generation & Data Export', () => {
  it('generateCSV correctly escapes quotes, commas, and handles nulls', () => {
    const sampleData = [
      {
        id: '1',
        title: 'Project "Alpha", Redesign',
        value: '120,000 Kč',
        notes: null,
      },
    ]

    const headers = [
      { key: 'id' as const, label: 'ID' },
      { key: 'title' as const, label: 'Project Title' },
      { key: 'value' as const, label: 'Value' },
      { key: 'notes' as const, label: 'Notes' },
    ]

    const csv = generateCSV(sampleData, headers)
    const lines = csv.split('\n')
    assert.equal(lines.length, 2)
    assert.equal(lines[0], '"ID","Project Title","Value","Notes"')
    assert.equal(lines[1], '"1","Project ""Alpha"", Redesign","120,000 Kč",""')
  })

  it('generates well-formed CSV for CRM deals collection', () => {
    const mockDeals: Partial<Deal>[] = [
      {
        id: 'deal-1',
        title: 'Brand Refresh',
        contactName: 'Vortex Labs',
        value: '45,000 Kč',
        stage: 'Lead In' as any,
        next: 'Send brief draft',
      },
    ]

    const headers = [
      { key: 'id' as keyof Deal, label: 'Deal ID' },
      { key: 'title' as keyof Deal, label: 'Title' },
      { key: 'contactName' as keyof Deal, label: 'Client' },
      { key: 'stage' as keyof Deal, label: 'Stage' },
    ]

    const csv = generateCSV(mockDeals, headers)
    assert.match(csv, /"Deal ID","Title","Client","Stage"/)
    assert.match(csv, /"deal-1","Brand Refresh","Vortex Labs","Lead In"/)
  })
})
