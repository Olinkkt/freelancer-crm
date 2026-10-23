import { parseDateInput } from './dates'
import { DomainError } from './errors'

export interface QuickAddOptions {
  today: string
  milestones: Array<{ id: string; title: string }>
}

export interface QuickAddResult {
  title: string
  dueDate: string | null
  focusToday: boolean
  milestoneId: string | null
}

export function parseQuickAdd(input: string, options: QuickAddOptions): QuickAddResult {
  const raw = (input || '').trim()
  if (!raw) {
    throw new DomainError('VALIDATION', 'Task title cannot be empty')
  }

  const rawWords = raw.split(/\s+/).filter(Boolean)
  let focusToday = false
  let milestoneId: string | null = null

  // 1. Extract '!' and '#milestone' tokens anywhere
  const remainingWords: string[] = []

  for (const word of rawWords) {
    if (word === '!') {
      focusToday = true
      continue
    }

    if (word.startsWith('#') && word.length > 1 && !milestoneId) {
      const tag = word.slice(1).toLowerCase()
      const match = options.milestones.find((m) =>
        m.title.toLowerCase().startsWith(tag)
      )
      if (match) {
        milestoneId = match.id
        continue
      }
    }

    remainingWords.push(word)
  }

  // 2. Trailing date phrase: longest suffix (2 words, then 1 word) where parseDateInput returns non-null
  let dueDate: string | null = null

  if (remainingWords.length >= 2) {
    const lastTwo = remainingWords.slice(-2).join(' ')
    const parsedTwo = parseDateInput(lastTwo, options.today)
    if (parsedTwo) {
      dueDate = parsedTwo
      remainingWords.splice(-2, 2)
    }
  }

  if (!dueDate && remainingWords.length >= 1) {
    const lastOne = remainingWords[remainingWords.length - 1]
    const parsedOne = parseDateInput(lastOne, options.today)
    if (parsedOne) {
      dueDate = parsedOne
      remainingWords.splice(-1, 1)
    }
  }

  const title = remainingWords.join(' ').trim()
  if (!title) {
    throw new DomainError('VALIDATION', 'Task title cannot be empty')
  }

  return {
    title,
    dueDate,
    focusToday,
    milestoneId,
  }
}
