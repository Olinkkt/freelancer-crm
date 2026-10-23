import type { Selectable } from 'kysely'
import type { DealsTable } from '@/lib/db/schema'

export function createLegacyDealFixture(overrides: Partial<Selectable<DealsTable>> = {}): Selectable<DealsTable> {
  const now = new Date().toISOString()
  return {
    id: `deal-fixture-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    title: 'Acme Redesign',
    company: 'Acme Corp',
    company_id: null,
    value: '100 000 Kč',
    raw_amount: 100000,
    stage: 'Won',
    probability: '100%',
    next: 'Deliver work',
    next_due_date: '2026-11-01',
    color: 'blue',
    contact_name: 'John Doe',
    contact_email: 'john@acme.com',
    notes: 'Important client',
    start_date: '2026-10-01',
    end_date: '2026-11-15',
    deliverables: null,
    invoices: null,
    created_at: now,
    updated_at: now,
    ...overrides,
  }
}
