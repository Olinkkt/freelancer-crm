'use server'

import { checkIsAuthenticated } from '@/lib/auth/session'
import {
  connectInvoicer,
  disconnectInvoicer,
  getInvoicerStatus,
  syncAllContactsToInvoicer,
  type InvoicerStatus,
  type SyncSummary,
} from '@/lib/invoicer/sync'

async function assertAuth() {
  if (!(await checkIsAuthenticated())) throw new Error('Unauthorized: Please authenticate to access workspace')
}

const message = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback)

export async function getInvoicerStatusAction(): Promise<InvoicerStatus> {
  await assertAuth()
  return getInvoicerStatus()
}

/** Saves the connection, then pushes every client once */
export async function connectInvoicerAction(
  url: string,
  token: string
): Promise<{ ok: true; status: InvoicerStatus; summary: SyncSummary } | { ok: false; error: string }> {
  await assertAuth()
  try {
    await connectInvoicer(url, token)
    const summary = await syncAllContactsToInvoicer()
    return { ok: true, status: await getInvoicerStatus(), summary }
  } catch (e) {
    return { ok: false, error: message(e, 'Could not connect to the Invoicer') }
  }
}

export async function syncInvoicerNowAction(): Promise<{ ok: true; status: InvoicerStatus; summary: SyncSummary } | { ok: false; error: string; status: InvoicerStatus }> {
  await assertAuth()
  try {
    const summary = await syncAllContactsToInvoicer()
    return { ok: true, status: await getInvoicerStatus(), summary }
  } catch (e) {
    return { ok: false, error: message(e, 'Sync failed'), status: await getInvoicerStatus() }
  }
}

export async function disconnectInvoicerAction(): Promise<InvoicerStatus> {
  await assertAuth()
  await disconnectInvoicer()
  return getInvoicerStatus()
}
