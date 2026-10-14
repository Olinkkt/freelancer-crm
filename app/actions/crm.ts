'use server'

import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import {
  Deal,
  Contact,
  Company,
  Activity,
  FollowUpItem,
  DealStage,
  WorkspaceData,
} from '@/lib/crm-types'
import { sanitizeErrorMessage } from '@/lib/errors'

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
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
    return await repo.createDeal(dealData)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create deal'))
  }
}

export async function updateDealAction(deal: Deal): Promise<Deal> {
  await assertAuth()
  try {
    const updated = await repo.updateDeal(deal)
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
    const success = await repo.deleteDeal(id)
    if (!success) {
      throw new Error('Deal not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete deal'))
  }
}

export async function fetchDealByIdAction(idOrSlug: string): Promise<Deal | null> {
  await assertAuth()
  try {
    return await repo.getDealById(idOrSlug)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to fetch deal'))
  }
}

export async function fetchDealActivitiesAction(dealId: string): Promise<Activity[]> {
  await assertAuth()
  try {
    return await repo.getDealActivities(dealId)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to fetch deal activities'))
  }
}

export async function moveDealStageAction(dealId: string, stage: DealStage): Promise<Deal | null> {
  await assertAuth()
  try {
    return await repo.moveDealStage(dealId, stage)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update deal stage'))
  }
}

// 3. Contacts actions
export async function createContactAction(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await assertAuth()
  try {
    return await repo.createContact(contactData)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create contact'))
  }
}

export async function updateContactAction(contact: Contact): Promise<Contact> {
  await assertAuth()
  try {
    const updated = await repo.updateContact(contact)
    if (!updated) {
      throw new Error('Contact not found')
    }
    return updated
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update contact'))
  }
}

export async function deleteContactAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteContact(id)
    if (!success) {
      throw new Error('Contact not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete contact'))
  }
}

export async function setPrimaryContactAction(
  companyName: string,
  contactId: string
): Promise<Company | null> {
  await assertAuth()
  try {
    return await repo.setPrimaryContact(companyName, contactId)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to set primary contact'))
  }
}

// 4. Companies actions
export async function createCompanyAction(companyData: Omit<Company, 'id'>): Promise<Company> {
  await assertAuth()
  try {
    return await repo.createCompany(companyData)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create company'))
  }
}

export async function updateCompanyAction(company: Company): Promise<Company> {
  await assertAuth()
  try {
    const updated = await repo.updateCompany(company)
    if (!updated) {
      throw new Error('Company not found')
    }
    return updated
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update company'))
  }
}

export async function deleteCompanyAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteCompany(id)
    if (!success) {
      throw new Error('Company not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete company'))
  }
}

// 5. Activities & Follow-ups actions
export async function logActivityAction(
  activityData: Omit<Activity, 'id'>,
  followUpData?: Omit<FollowUpItem, 'id'>,
  dealId?: string
): Promise<{
  activity: Activity
  followUp?: FollowUpItem
  updatedDeal?: Deal
}> {
  await assertAuth()
  try {
    return await repo.logActivity(activityData, followUpData, dealId)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to log activity'))
  }
}

export async function toggleFollowUpAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    return await repo.toggleFollowUp(id)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to toggle follow-up'))
  }
}

export async function syncTodosAction(
  todos: string[],
  companyName: string = 'Workspace',
  dealId?: string
): Promise<FollowUpItem[]> {
  await assertAuth()
  try {
    return await repo.syncTodos(todos, companyName, dealId)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to sync todos'))
  }
}

export async function updateActivityAction(activity: Activity): Promise<Activity> {
  await assertAuth()
  try {
    return await repo.updateActivity(activity)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update activity'))
  }
}

export async function updateFollowUpAction(followUp: FollowUpItem): Promise<FollowUpItem> {
  await assertAuth()
  try {
    return await repo.updateFollowUp(followUp)
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to update follow-up'))
  }
}

export async function deleteActivityAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteActivity(id)
    if (!success) {
      throw new Error('Activity not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete activity'))
  }
}

export async function deleteFollowUpAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    const success = await repo.deleteFollowUp(id)
    if (!success) {
      throw new Error('Follow-up not found')
    }
    return success
  } catch (err: any) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to delete follow-up'))
  }
}
