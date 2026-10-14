'use server'

import {
  isAuthRequired,
  checkIsAuthenticated,
  verifyPassword,
  hashPasscode,
  verifyPasscode,
  setOperatorSession,
  clearOperatorSession,
} from '@/lib/auth/session'
import {
  getWorkspaceSettings,
  claimWorkspace,
  updateWorkspaceSettings,
} from '@/lib/db/repository'
import { WorkspaceSettings } from '@/lib/crm-types'

export async function getAuthStatus(): Promise<{
  required: boolean
  authenticated: boolean
  isSetupComplete: boolean
  envAuthRequired: boolean
  settings?: WorkspaceSettings
}> {
  const settings = await getWorkspaceSettings()
  const isSetupComplete = Boolean(settings && settings.isClaimed)
  const envAuthRequired = isAuthRequired()
  // Auth is required if AUTH_SECRET is set OR if the workspace has a passcodeHash set in db
  const required = envAuthRequired || Boolean(settings?.passcodeHash)
  const authenticated = required ? await checkIsAuthenticated() : true

  return {
    required,
    authenticated,
    isSetupComplete,
    envAuthRequired,
    settings: settings
      ? {
          operatorName: settings.operatorName,
          operatorEmail: settings.operatorEmail,
          operatorRole: settings.operatorRole,
          currency: settings.currency,
          currencySymbol: settings.currencySymbol,
          locale: settings.locale,
          isClaimed: settings.isClaimed,
          updatedAt: settings.updatedAt,
        }
      : undefined,
  }
}

export async function claimWorkspaceAction(params: {
  operatorName: string
  operatorEmail: string
  operatorRole?: string
  currency: string
  currencySymbol: string
  locale: string
  passcode?: string
  setupToken?: string
}): Promise<{ success: boolean; settings?: WorkspaceSettings; error?: string }> {
  try {
    const existing = await getWorkspaceSettings()
    if (existing && existing.isClaimed) {
      return { success: false, error: 'Workspace is already claimed.' }
    }

    // Claim protection: If AUTH_SECRET is set, claimant must provide matching setupToken
    if (isAuthRequired()) {
      if (!params.setupToken || !verifyPassword(params.setupToken)) {
        return {
          success: false,
          error: 'Unauthorized: Valid setup token (AUTH_SECRET) required to claim this workspace.',
        }
      }
    }

    const passcodeHash = params.passcode && params.passcode.trim() ? hashPasscode(params.passcode) : undefined
    const settings = await claimWorkspace({
      ...params,
      passcodeHash,
    })

    // If passcode was provided, grant immediate session to the claimant
    await setOperatorSession(passcodeHash)

    return { success: true, settings }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to claim workspace' }
  }
}

export async function updateWorkspaceSettingsAction(params: {
  operatorName?: string
  operatorEmail?: string
  operatorRole?: string
  currency?: string
  currencySymbol?: string
  locale?: string
  newPasscode?: string
}): Promise<{ success: boolean; settings?: WorkspaceSettings; error?: string }> {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    return { success: false, error: 'Unauthorized: You must be logged in to update workspace settings.' }
  }

  try {
    const passcodeHash = params.newPasscode && params.newPasscode.trim() ? hashPasscode(params.newPasscode) : undefined
    const settings = await updateWorkspaceSettings({
      ...params,
      passcodeHash,
    })
    if (passcodeHash) {
      await setOperatorSession(passcodeHash)
    }
    return { success: true, settings }
  } catch (err: any) {
    return { success: false, error: err?.message || 'Failed to update settings' }
  }
}

export async function loginOperator(passcode: string): Promise<{ success: boolean; error?: string }> {
  const settings = await getWorkspaceSettings()
  const envAuthRequired = isAuthRequired()

  if (!envAuthRequired && !settings?.passcodeHash) {
    return { success: true }
  }

  // 1. Check against DB passcode hash if configured
  if (settings?.passcodeHash) {
    if (verifyPasscode(passcode, settings.passcodeHash)) {
      await setOperatorSession(settings.passcodeHash)
      return { success: true }
    }
  }

  // 2. Fall back to AUTH_SECRET env check
  if (envAuthRequired && verifyPassword(passcode)) {
    await setOperatorSession()
    return { success: true }
  }

  return { success: false, error: 'Incorrect operator passcode.' }
}

export async function logoutOperator(): Promise<{ success: boolean }> {
  await clearOperatorSession()
  return { success: true }
}
