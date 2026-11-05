'use server'

import { headers } from 'next/headers'
import { checkIsAuthenticated } from '@/lib/auth/session'
import { createApiToken, listApiTokens, revokeApiToken, type ApiScope, type ApiToken } from '@/lib/db/api-tokens'
import { sanitizeErrorMessage } from '@/lib/errors'

async function assertAuth() {
  const isAuthed = await checkIsAuthenticated()
  if (!isAuthed) {
    throw new Error('Unauthorized: Please authenticate to access workspace')
  }
}

export async function listApiTokensAction(): Promise<{ tokens: ApiToken[]; origin: string }> {
  await assertAuth()
  try {
    let origin = 'http://localhost:3000'
    try {
      const h = await headers()
      const host = h.get('x-forwarded-host') || h.get('host')
      if (host) origin = `${h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')}://${host}`
    } catch {}
    return { tokens: await listApiTokens(), origin }
  } catch (err) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to list API tokens'))
  }
}

/** Returns the plaintext once; it is never readable again */
export async function createApiTokenAction(name: string, scopes: ApiScope[]): Promise<{ token: ApiToken; plaintext: string }> {
  await assertAuth()
  try {
    return await createApiToken({ name, scopes })
  } catch (err) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to create API token'))
  }
}

export async function revokeApiTokenAction(id: string): Promise<boolean> {
  await assertAuth()
  try {
    return await revokeApiToken(id)
  } catch (err) {
    throw new Error(sanitizeErrorMessage(err, 'Failed to revoke API token'))
  }
}
