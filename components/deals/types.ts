export type { DealStage } from '@/lib/crm-types'
import type { DealStage } from '@/lib/crm-types'

export type DealColor = 'blue' | 'violet' | 'amber' | 'green'

export interface Deal {
  id: string
  title: string
  contactName: string
  value: string
  stage: DealStage
  color: DealColor
  nextAction: string | null
  nextDueDate: string | null
  nextDueTone?: 'urgent' | 'normal' | 'warning'
}
