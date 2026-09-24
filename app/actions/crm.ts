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

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
}

// 1. Fetch entire workspace
export async function fetchWorkspaceData(): Promise<WorkspaceData> {
  await assertAuth()
  return await repo.getWorkspaceData()
}

// 2. Deals actions
export async function createDealAction(dealData: Omit<Deal, 'id'>): Promise<Deal> {
  await assertAuth()
  return await repo.createDeal(dealData)
}

export async function updateDealAction(deal: Deal): Promise<Deal> {
  await assertAuth()
  return await repo.updateDeal(deal)
}

export async function deleteDealAction(id: string): Promise<boolean> {
  await assertAuth()
  return await repo.deleteDeal(id)
}

export async function moveDealStageAction(dealId: string, stage: DealStage): Promise<Deal | null> {
  await assertAuth()
  return await repo.moveDealStage(dealId, stage)
}

// 3. Contacts actions
export async function createContactAction(contactData: Omit<Contact, 'id'>): Promise<Contact> {
  await assertAuth()
  return await repo.createContact(contactData)
}

export async function updateContactAction(contact: Contact): Promise<Contact> {
  await assertAuth()
  return await repo.updateContact(contact)
}

export async function deleteContactAction(id: string): Promise<boolean> {
  await assertAuth()
  return await repo.deleteContact(id)
}

// 4. Companies actions
export async function createCompanyAction(companyData: Omit<Company, 'id'>): Promise<Company> {
  await assertAuth()
  return await repo.createCompany(companyData)
}

export async function updateCompanyAction(company: Company): Promise<Company> {
  await assertAuth()
  return await repo.updateCompany(company)
}

export async function deleteCompanyAction(id: string): Promise<boolean> {
  await assertAuth()
  return await repo.deleteCompany(id)
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
  return await repo.logActivity(activityData, followUpData, dealId)
}

export async function toggleFollowUpAction(id: string): Promise<boolean> {
  await assertAuth()
  return await repo.toggleFollowUp(id)
}

export async function syncTodosAction(
  todos: string[],
  companyName: string = 'Workspace',
  dealId?: string
): Promise<FollowUpItem[]> {
  await assertAuth()
  return await repo.syncTodos(todos, companyName, dealId)
}
