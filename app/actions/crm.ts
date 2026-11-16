'use server'

import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import {
  Deal,
  Contact,
  FollowUpItem,
  DealStage,
  DeliverableItem,
  WorkspaceData,
} from '@/lib/crm-types'
import { sanitizeErrorMessage } from '@/lib/errors'
import { z } from 'zod'
import {
  ChecklistSchema,
  ContactActionSchema,
  ContactUpdateActionSchema,
  DealActionSchema,
  DealStageSchema,
  DealUpdateActionSchema,
  FollowUpActionSchema,
  IdInput,
} from '@/lib/validations'
import { queueContactSync } from '@/lib/invoicer/sync'

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
}

/** Checks an action's input and reports the first problem in plain words */
function parseInput<S extends z.ZodType>(schema: S, input: unknown): z.output<S> {
  const result = schema.safeParse(input)
  if (result.success) return result.data
  const issue = result.error.issues[0]
  const field = issue?.path.join('.')
  throw new Error(field ? `${field}: ${issue.message}` : issue?.message || 'Invalid input')
}

// 1. Fetch entire workspace
export async function fetchWorkspaceData(): Promise<WorkspaceData> {
  await assertAuth()
  try {
    return await repo.getWorkspaceData()
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to fetch workspace data'))
  }
}

// 2. Deals actions
export async function createDealAction(dealData: Omit<Deal, 'id'>): Promise<Deal> {
  await assertAuth()
  try {
    return await repo.createDeal(parseInput(DealActionSchema, dealData) as Omit<Deal, 'id'>)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create deal'))
  }
}

export async function updateDealAction(deal: Deal): Promise<Deal> {
  await assertAuth()
  try {
    const updated = await repo.updateDeal(parseInput(DealUpdateActionSchema, deal) as Deal)
    if (!updated) {
      throw new Error('Deal not found')
    }
    return updated
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update deal'))
  }
}

export async function deleteDealAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteDeal(parseInput(IdInput, id))
    if (!success) {
      throw new Error('Deal not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete deal'))
  }
}

export async function moveDealStageAction(dealId: string, stage: DealStage): Promise<Deal | null> {
  await assertAuth()
  try {
    return await repo.moveDealStage(parseInput(IdInput, dealId), parseInput(DealStageSchema, stage))
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update deal stage'))
  }
}

export async function updateDealChecklistAction(
  dealId: string,
  items: DeliverableItem[]
): Promise<Deal | null> {
  await assertAuth()
  try {
    return await repo.setDealChecklist(parseInput(IdInput, dealId), parseInput(ChecklistSchema, items))
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update checklist'))
  }
}

// 3. Contacts actions
export async function createContactAction(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await assertAuth()
  try {
    const created = await repo.createContact(parseInput(ContactActionSchema, contactData))
    queueContactSync(created.id)
    return created
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create contact'))
  }
}

export async function updateContactAction(contact: Contact): Promise<Contact> {
  await assertAuth()
  try {
    const updated = await repo.updateContact(parseInput(ContactUpdateActionSchema, contact))
    if (!updated) {
      throw new Error('Contact not found')
    }
    queueContactSync(updated.id)
    return updated
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update contact'))
  }
}

export async function deleteContactAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteContact(parseInput(IdInput, id))
    if (!success) {
      throw new Error('Contact not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete contact'))
  }
}

// 4. Follow-ups actions
export async function toggleFollowUpAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    return await repo.toggleFollowUp(parseInput(IdInput, id))
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to toggle follow-up'))
  }
}

export async function updateFollowUpAction(followUp: FollowUpItem): Promise<FollowUpItem> {
  await assertAuth()
  try {
    return await repo.updateFollowUp(parseInput(FollowUpActionSchema, followUp))
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update follow-up'))
  }
}

export async function deleteFollowUpAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteFollowUp(parseInput(IdInput, id))
    if (!success) {
      throw new Error('Follow-up not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete follow-up'))
  }
}
