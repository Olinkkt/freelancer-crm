import { isIsoDate } from '@/lib/projects/dates'
import type { Deal } from '@/lib/crm-types'

/**
 * GTD Exemption rule (R3):
 * dealNeedsNextAction(deal) = deal.stage !== 'Won'.
 * Won deals are exempt because their delivery is handled by projects.
 */
export function dealNeedsNextAction(deal: Pick<Deal, 'stage'>): boolean {
  return deal.stage !== 'Won'
}
