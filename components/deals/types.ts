export type DealStage =
  | 'Lead'
  | 'Contacted'
  | 'Qualified'
  | 'Scope'
  | 'Quote sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'

export type DealColor = 'blue' | 'violet' | 'amber' | 'green'

export interface Deal {
  id: string
  title: string
  company: string
  value: string
  stage: DealStage
  probability: string
  color: DealColor
  nextAction: string | null
  nextDueDate: string | null
  nextDueTone?: 'urgent' | 'normal' | 'warning'
}
