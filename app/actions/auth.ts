'use server'

import {
  isAuthRequired,
  checkIsAuthenticated,
  verifyPassword,
  setOperatorSession,
  clearOperatorSession,
} from '@/lib/auth/session'

export async function getAuthStatus(): Promise<{ required: boolean; authenticated: boolean }> {
  const required = isAuthRequired()
  const authenticated = await checkIsAuthenticated()
  return { required, authenticated }
}

export async function loginOperator(passcode: string): Promise<{ success: boolean; error?: string }> {
  if (!isAuthRequired()) {
    return { success: true }
  }

  const isValid = verifyPassword(passcode)
  if (!isValid) {
    return { success: false, error: 'Incorrect operator passcode.' }
  }

  await setOperatorSession()
  return { success: true }
}

export async function logoutOperator(): Promise<{ success: boolean }> {
  await clearOperatorSession()
  return { success: true }
}
