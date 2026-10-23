import type React from 'react'
import { eventToStep, getPlatform } from '@/lib/shortcuts/keys'
import type { Platform } from '@/lib/shortcuts/types'

export interface FormKeyHandlers {
  onSubmit?: () => void
  onCancel?: () => void
  onDelete?: () => void
}

export function handleFormKeys(
  e: React.KeyboardEvent,
  handlers: FormKeyHandlers,
  platform?: Platform
): void {
  const p = platform ?? getPlatform()
  const step = eventToStep(e.nativeEvent, p)
  if (!step) return

  if (step === 'mod+enter' && handlers.onSubmit) {
    e.preventDefault()
    e.stopPropagation()
    handlers.onSubmit()
  } else if (step === 'escape' && handlers.onCancel) {
    e.preventDefault()
    e.stopPropagation()
    handlers.onCancel()
  } else if (step === 'mod+backspace' && handlers.onDelete) {
    e.preventDefault()
    e.stopPropagation()
    handlers.onDelete()
  }
}
