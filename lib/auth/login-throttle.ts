/**
 * Slows down passcode guessing. In memory, which is enough for a single-operator app:
 * a restart clears it, and an existing session cookie is never affected.
 *
 * Per client (IP): 5 wrong passcodes in a row start a pause that doubles each time,
 * 30 seconds up to 15 minutes. A workspace-wide cap covers clients that fake their IP.
 */

const FREE_ATTEMPTS = 5
const BASE_LOCK_MS = 30_000
const MAX_LOCK_MS = 15 * 60_000
const FORGET_AFTER_MS = 60 * 60_000

const GLOBAL_WINDOW_MS = 5 * 60_000
const GLOBAL_LIMIT = 30
const GLOBAL_LOCK_MS = 60_000

interface Entry {
  failures: number
  lockedUntil: number
  lastFailure: number
}

const globalForThrottle = globalThis as unknown as {
  loginThrottle?: { clients: Map<string, Entry>; recent: number[]; globalLockedUntil: number }
}
const state = (globalForThrottle.loginThrottle ??= { clients: new Map(), recent: [], globalLockedUntil: 0 })

/** Seconds the client still has to wait, or 0 when it may try now */
export function loginRetryAfter(client: string, now = Date.now()): number {
  const until = Math.max(state.clients.get(client)?.lockedUntil ?? 0, state.globalLockedUntil)
  return until > now ? Math.ceil((until - now) / 1000) : 0
}

export function recordLoginFailure(client: string, now = Date.now()): void {
  for (const [key, entry] of state.clients) {
    if (now - entry.lastFailure > FORGET_AFTER_MS) state.clients.delete(key)
  }

  const entry = state.clients.get(client) ?? { failures: 0, lockedUntil: 0, lastFailure: now }
  entry.failures += 1
  entry.lastFailure = now
  if (entry.failures >= FREE_ATTEMPTS) {
    const lock = Math.min(MAX_LOCK_MS, BASE_LOCK_MS * 2 ** (entry.failures - FREE_ATTEMPTS))
    entry.lockedUntil = now + lock
  }
  state.clients.set(client, entry)

  state.recent = state.recent.filter((t) => now - t < GLOBAL_WINDOW_MS)
  state.recent.push(now)
  if (state.recent.length >= GLOBAL_LIMIT) {
    state.globalLockedUntil = now + GLOBAL_LOCK_MS
    state.recent = []
  }
}

export function recordLoginSuccess(client: string): void {
  state.clients.delete(client)
}

export function resetLoginThrottle(): void {
  state.clients.clear()
  state.recent = []
  state.globalLockedUntil = 0
}
