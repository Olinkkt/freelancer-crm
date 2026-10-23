/**
 * Feedback splitting and revision round helpers per §8.6
 */

export function splitFeedback(text: string): string[] {
  if (!text || typeof text !== 'string') return []

  // 1. Normalise CRLF
  const lines = text.replace(/\r\n/g, '\n').split('\n')

  // Truncate at reply headers or email signatures, and strip quoted reply lines (>)
  const cleanLines: string[] = []
  for (const line of lines) {
    const trimmed = line.trim()
    if (/^On .+wrote:$/i.test(trimmed) || /^-- ?$/.test(trimmed)) {
      break
    }
    if (trimmed.startsWith('>')) {
      continue
    }
    cleanLines.push(line)
  }

  // 2. Check for list markers:
  // - Markdown headings: ^#{1,6}\s+
  // - Bullets: ^[-*•]\s+
  // - Checkboxes: ^[-*•]?\s*\[[ xX]?\]\s*
  // - Numbered lists: ^\d+[.)]\s+
  const listMarkerRegex = /^(?:#{1,6}\s+|[-*•]\s*\[[ xX]?\]\s*|\[[ xX]?\]\s*|[-*•]\s+|\d+[.)]\s+)/

  const markedItems: string[] = []
  let hasListMarker = false

  for (const line of cleanLines) {
    const trimmed = line.trim()
    if (listMarkerRegex.test(trimmed)) {
      hasListMarker = true
      const stripped = trimmed.replace(listMarkerRegex, '').trim()
      if (stripped.length >= 3 && stripped.length <= 500) {
        markedItems.push(stripped)
      }
    }
  }

  let candidates: string[] = []

  if (hasListMarker) {
    candidates = markedItems
  } else {
    // 3. Otherwise split into sentences on /(?<=[.!?])\s+/
    const fullText = cleanLines.join(' ').trim()
    const sentences = fullText.split(/(?<=[.!?])\s+/)
    for (const s of sentences) {
      const trimmed = s.trim()
      if (trimmed.length >= 3 && trimmed.length <= 500) {
        candidates.push(trimmed)
      }
    }
  }

  // 4. Trim, drop empty items and duplicates (case-insensitive), cap at 50
  const result: string[] = []
  const seen = new Set<string>()

  for (const item of candidates) {
    const trimmed = item.trim()
    if (!trimmed) continue
    const lower = trimmed.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      result.push(trimmed)
      if (result.length >= 50) break
    }
  }

  return result
}

export function calculateRevisionRound(
  tasks: Array<{ revisionRound?: number | null; revision_round?: number | null }>,
  revisionsIncluded: number | null
): { round: number; overScope: boolean } {
  let maxRound = 0
  for (const t of tasks) {
    const r = t.revisionRound !== undefined ? t.revisionRound : t.revision_round
    if (r && r > maxRound) {
      maxRound = r
    }
  }
  const round = maxRound + 1
  const overScope = revisionsIncluded !== null && round > revisionsIncluded
  return { round, overScope }
}
