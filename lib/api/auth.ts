import { hasOperatorSession } from '@/lib/auth/session'
import { TOKEN_PREFIX, verifyApiToken, type ApiScope } from '@/lib/db/api-tokens'
import { ApiError } from './errors'

export type Principal =
  | { kind: 'token'; tokenId: string; tokenName: string; scopes: ApiScope[] }
  /** The operator in the browser (session cookie), or anyone when the workspace has no passcode */
  | { kind: 'operator'; scopes: ApiScope[] }

function bearer(req: Request): string | null {
  const header = req.headers.get('authorization')
  if (header) {
    const [scheme, value] = header.split(' ')
    if (scheme?.toLowerCase() === 'bearer' && value) return value.trim()
  }
  return req.headers.get('x-api-key')?.trim() || null
}

/**
 * Authenticates a /api/v1 or /api/mcp request.
 * A scoped token (fcrm_…) wins. Without one, the browser session cookie counts.
 * The raw passcode / AUTH_SECRET is never accepted here.
 */
export async function authenticateApi(req: Request): Promise<Principal> {
  const presented = bearer(req)
  if (presented) {
    if (!presented.startsWith(TOKEN_PREFIX)) {
      throw new ApiError('unauthorized', 'Unknown credential', {
        hint: `Use an API token (starts with "${TOKEN_PREFIX}"). Create one in Settings → API.`,
      })
    }
    const token = await verifyApiToken(presented)
    if (!token) {
      throw new ApiError('unauthorized', 'Invalid or revoked API token', {
        hint: 'Create a new token in Settings → API.',
      })
    }
    return { kind: 'token', tokenId: token.id, tokenName: token.name, scopes: token.scopes }
  }

  if (await hasOperatorSession(req)) {
    return { kind: 'operator', scopes: ['read', 'write'] }
  }

  throw new ApiError('unauthorized', 'Authentication required', {
    hint: 'Send "Authorization: Bearer fcrm_…". Create a token in Settings → API.',
  })
}

export function requireScope(principal: Principal, scope: ApiScope): void {
  if (!principal.scopes.includes(scope)) {
    throw new ApiError('insufficient_scope', `This token lacks the "${scope}" scope`, {
      hint: 'Ask the operator for a token with write access, or use a read-only operation.',
    })
  }
}

export const principalTokenId = (p: Principal) => (p.kind === 'token' ? p.tokenId : null)
