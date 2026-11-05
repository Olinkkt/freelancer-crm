/**
 * Tiny fuzzy matcher for the command palette. No dependency.
 * Returns a score (higher is better) or -1 when `term` doesn't match `text`.
 */
function fuzzyScore(term: string, text: string): number {
  if (!term) return 0
  const t = text.toLowerCase()
  const q = term.toLowerCase()

  // Exact substring beats scattered letters: prefix > word start > anywhere
  const idx = t.indexOf(q)
  if (idx === 0) return 1000 - t.length
  if (idx > 0) {
    const wordStart = /[\s\-_/:•.@#]/.test(t[idx - 1])
    return (wordStart ? 800 : 600) - idx
  }

  // Subsequence: letters in order, rewarding runs and word starts
  let score = 0
  let ti = 0
  let run = 0
  for (let qi = 0; qi < q.length; qi++) {
    const found = t.indexOf(q[qi], ti)
    if (found === -1) return -1
    if (found === ti) {
      run++
      score += 5 + run * 3
    } else {
      run = 0
      score += 1
    }
    if (found === 0 || /[\s\-_/:•.@#]/.test(t[found - 1])) score += 6
    ti = found + 1
  }
  // Only loose matches shouldn't outrank real substring hits
  return Math.min(score, 400) - (ti - q.length)
}

/** Best score for a query across fields; every whitespace token must match somewhere. */
export function fuzzyScoreFields(query: string, fields: Array<string | undefined>, weights: number[]): number {
  const tokens = query.split(/\s+/).filter(Boolean)
  if (tokens.length === 0) return 0
  let total = 0
  for (const token of tokens) {
    let best = -1
    fields.forEach((field, i) => {
      if (!field) return
      const s = fuzzyScore(token, field)
      if (s >= 0) best = Math.max(best, s * (weights[i] ?? 1))
    })
    if (best < 0) return -1
    total += best
  }
  return total
}
