'use client'

import { useEffect, useRef } from 'react'

type EscapeHandler = () => void

const escapeStack: EscapeHandler[] = []

export function registerEscapeHandler(handler: EscapeHandler): () => void {
  escapeStack.push(handler)
  return () => {
    const idx = escapeStack.lastIndexOf(handler)
    if (idx !== -1) {
      escapeStack.splice(idx, 1)
    }
  }
}

export function handleTopmostEscape(): boolean {
  if (escapeStack.length > 0) {
    const handler = escapeStack.pop()
    if (handler) {
      handler()
      return true
    }
  }
  return false
}

export function hasEscapeLayers(): boolean {
  return escapeStack.length > 0
}

export function useEscapeLayer(onClose: () => void, enabled: boolean = true) {
  const handlerRef = useRef(onClose)
  handlerRef.current = onClose

  useEffect(() => {
    if (!enabled) return
    const unregister = registerEscapeHandler(() => handlerRef.current())
    return unregister
  }, [enabled])
}
