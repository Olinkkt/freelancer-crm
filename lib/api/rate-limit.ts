import { ApiError } from './errors'

/** Requests per minute per token (or per operator). Single-operator app, so in-memory is enough. */
const LIMIT_PER_MINUTE = Number(process.env.API_RATE_LIMIT_PER_MINUTE) || 120

const globalForRate = globalThis as unknown as { apiBuckets?: Map<string, { tokens: number; updated: number }> }
const buckets = (globalForRate.apiBuckets ??= new Map())

/** Token bucket: refills continuously at LIMIT_PER_MINUTE per minute */
export function takeRateLimit(key: string, now = Date.now()): void {
  const bucket = buckets.get(key) ?? { tokens: LIMIT_PER_MINUTE, updated: now }
  const refill = ((now - bucket.updated) / 60_000) * LIMIT_PER_MINUTE
  bucket.tokens = Math.min(LIMIT_PER_MINUTE, bucket.tokens + refill)
  bucket.updated = now
  if (bucket.tokens < 1) {
    buckets.set(key, bucket)
    const retry = Math.ceil(((1 - bucket.tokens) / LIMIT_PER_MINUTE) * 60)
    throw new ApiError('rate_limited', `Rate limit of ${LIMIT_PER_MINUTE} requests per minute reached`, {
      hint: `Retry in ${retry} seconds.`,
    })
  }
  bucket.tokens -= 1
  buckets.set(key, bucket)
}

export function resetRateLimits() {
  buckets.clear()
}
