'use client'

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
} from 'react'
import { SHORTCUTS, ShortcutId } from '@/lib/shortcuts/registry'
import { CONTEXT_SCOPES, ShortcutContext } from '@/lib/shortcuts/contexts'
import type { Platform, ShortcutDef } from '@/lib/shortcuts/types'
import { eventToStep, isTypingTarget, getPlatform, formatStep } from '@/lib/shortcuts/keys'
import { resolveBindings } from '@/lib/shortcuts/overrides'
import { handleTopmostEscape } from './escape-layer'

interface ShortcutHandlerEntry {
  id: ShortcutId
  handler: () => void
  enabled: boolean
}

interface ShortcutContextValue {
  activeContext: ShortcutContext
  pushContext: (ctx: ShortcutContext) => () => void
  registerShortcut: (id: ShortcutId, handler: () => void, enabled?: boolean) => () => void
  effectiveBindings: Record<ShortcutId, string[]>
  overrides: Record<string, string[]>
  setOverrides: (overrides: Record<string, string[]>) => void
  platform: Platform
}

const ShortcutStateContext = createContext<ShortcutContextValue | null>(null)

export function useShortcuts() {
  const ctx = useContext(ShortcutStateContext)
  if (!ctx) {
    throw new Error('useShortcuts must be used within a ShortcutProvider')
  }
  return ctx
}

export function useShortcutContext(context: ShortcutContext) {
  const { pushContext } = useShortcuts()

  useEffect(() => {
    const unregister = pushContext(context)
    return unregister
  }, [context, pushContext])
}

export function useShortcut(
  id: ShortcutId,
  handler: () => void,
  options?: { enabled?: boolean }
) {
  const { registerShortcut } = useShortcuts()
  const enabled = options?.enabled ?? true

  const handlerRef = useRef(handler)
  handlerRef.current = handler

  useEffect(() => {
    if (!enabled) return
    const unregister = registerShortcut(id, () => handlerRef.current(), enabled)
    return unregister
  }, [id, enabled, registerShortcut])
}

interface ShortcutProviderProps {
  children: React.ReactNode
  initialOverrides?: Record<string, string[]>
}

export function ShortcutProvider({
  children,
  initialOverrides = {},
}: ShortcutProviderProps) {
  const [contextStack, setContextStack] = useState<ShortcutContext[]>(['default'])
  const [overrides, setOverrides] = useState<Record<string, string[]>>(initialOverrides)
  const [pendingSequenceStep, setPendingSequenceStep] = useState<string | null>(null)
  const pendingTimerRef = useRef<NodeJS.Timeout | null>(null)

  // Keep internal copy of overrides updated if initialOverrides prop changes
  useEffect(() => {
    setOverrides(initialOverrides)
  }, [initialOverrides])

  const handlersRef = useRef<ShortcutHandlerEntry[]>([])
  const platform = useMemo<Platform>(() => (typeof navigator !== 'undefined' ? getPlatform() : 'other'), [])

  const pushContext = useCallback((ctx: ShortcutContext) => {
    setContextStack((prev) => [...prev, ctx])
    return () => {
      setContextStack((prev) => {
        const idx = prev.lastIndexOf(ctx)
        if (idx === -1) return prev
        const next = [...prev]
        next.splice(idx, 1)
        return next.length === 0 ? ['default'] : next
      })
    }
  }, [])

  const registerShortcut = useCallback(
    (id: ShortcutId, handler: () => void, enabled = true) => {
      const entry: ShortcutHandlerEntry = { id, handler, enabled }
      handlersRef.current.push(entry)
      return () => {
        const idx = handlersRef.current.indexOf(entry)
        if (idx !== -1) {
          handlersRef.current.splice(idx, 1)
        }
      }
    },
    []
  )

  const effectiveBindings = useMemo(() => {
    return resolveBindings(SHORTCUTS, overrides)
  }, [overrides])

  const activeContext = contextStack[contextStack.length - 1] ?? 'default'

  // Global keydown dispatcher
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inTypingTarget = isTypingTarget(e.target)
      const step = eventToStep(e, platform)
      if (!step) return

      // In typing targets, only mod+ and escape are handled as shortcuts
      const hasMod = step.startsWith('mod+') || step.includes('+mod+')
      const isEscape = step === 'escape'
      if (inTypingTarget && !hasMod && !isEscape) {
        return
      }

      // 1. ESCAPE handling
      if (step === 'escape') {
        // If in sequence mode, cancel sequence
        if (pendingSequenceStep) {
          if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
          pendingTimerRef.current = null
          setPendingSequenceStep(null)
          e.preventDefault()
          return
        }

        // Check escape layers (modals, drawers, popups)
        const handledByLayer = handleTopmostEscape()
        if (handledByLayer) {
          e.preventDefault()
          return
        }

        // Otherwise check registered ui.escape handler
        const escapeHandler = handlersRef.current.find(
          (h) => h.id === 'ui.escape' && h.enabled
        )
        if (escapeHandler) {
          escapeHandler.handler()
          e.preventDefault()
          return
        }
        return
      }

      // Collect active shortcuts in current context
      const scopes = CONTEXT_SCOPES[activeContext] || ['global']
      const activeDefs: ShortcutDef[] = SHORTCUTS.filter((s) => {
        if (activeContext === 'form' || activeContext === 'help') {
          return scopes.includes(s.scope) || (s.scope === 'global' && s.locked)
        }
        return scopes.includes(s.scope)
      })

      // If we have a pending sequence step (e.g. 'g')
      if (pendingSequenceStep) {
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = null
        const fullBinding = `${pendingSequenceStep} ${step}`
        setPendingSequenceStep(null)

        // Try to find matching shortcut for 2-step binding
        for (const def of activeDefs) {
          const bindings = effectiveBindings[def.id] || def.defaults
          if (bindings.includes(fullBinding)) {
            const registered = handlersRef.current.find(
              (h) => h.id === def.id && h.enabled
            )
            if (registered) {
              e.preventDefault()
              registered.handler()
              return
            }
          }
        }
        // If not matched, fall through or return
        return
      }

      // Check if this step is the first step of an active sequence
      let isSequencePrefix = false
      for (const def of activeDefs) {
        const bindings = effectiveBindings[def.id] || def.defaults
        for (const b of bindings) {
          const parts = b.split(' ')
          if (parts.length === 2 && parts[0] === step) {
            isSequencePrefix = true
            break
          }
        }
        if (isSequencePrefix) break
      }

      if (isSequencePrefix) {
        e.preventDefault()
        setPendingSequenceStep(step)
        if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
        pendingTimerRef.current = setTimeout(() => {
          setPendingSequenceStep(null)
          pendingTimerRef.current = null
        }, 1000)
        return
      }

      // Match 1-step binding
      for (const def of activeDefs) {
        const bindings = effectiveBindings[def.id] || def.defaults
        if (bindings.includes(step)) {
          const registered = handlersRef.current.find(
            (h) => h.id === def.id && h.enabled
          )
          if (registered) {
            e.preventDefault()
            registered.handler()
            return
          }
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      if (pendingTimerRef.current) clearTimeout(pendingTimerRef.current)
    }
  }, [activeContext, effectiveBindings, pendingSequenceStep, platform])

  const contextValue = useMemo<ShortcutContextValue>(
    () => ({
      activeContext,
      pushContext,
      registerShortcut,
      effectiveBindings,
      overrides,
      setOverrides,
      platform,
    }),
    [activeContext, pushContext, registerShortcut, effectiveBindings, overrides, platform]
  )

  return (
    <ShortcutStateContext.Provider value={contextValue}>
      {children}
      {pendingSequenceStep && (
        <div className="fixed bottom-6 right-6 z-[9999] pointer-events-none px-3 py-1.5 bg-[#232529] text-[#bad0fa] rounded-[8px] shadow-[0_12px_30px_rgba(0,0,0,0.3)] border border-[#343840] font-mono text-xs font-semibold animate-in fade-in zoom-in-95 duration-100 flex items-center gap-1.5">
          <span>{formatStep(pendingSequenceStep, platform)}</span>
          <span className="text-[#8f99a8]">…</span>
        </div>
      )}
    </ShortcutStateContext.Provider>
  )
}
