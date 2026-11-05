'use client'

import { useSyncExternalStore } from 'react'
import { Bindings, DEFAULT_BINDINGS, ShortcutId } from '@/lib/shortcuts'

const STORAGE_KEY = 'crm.shortcuts'
const listeners = new Set<() => void>()
let cache: Bindings | null = null

function readOverrides(): Partial<Record<ShortcutId, string>> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function compute(): Bindings {
  const overrides = readOverrides()
  const out = { ...DEFAULT_BINDINGS }
  for (const id of Object.keys(DEFAULT_BINDINGS) as ShortcutId[]) {
    const v = overrides[id]
    if (typeof v === 'string' && v.trim()) out[id] = v
  }
  return out
}

function emit() {
  cache = null
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) emit()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

function getSnapshot(): Bindings {
  if (!cache) cache = compute()
  return cache
}

function writeOverrides(overrides: Partial<Record<ShortcutId, string>>) {
  try {
    if (Object.keys(overrides).length === 0) localStorage.removeItem(STORAGE_KEY)
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(overrides))
  } catch {
    // storage blocked: bindings just won't persist
  }
  emit()
}

/** Save a custom binding. Passing the default (or null) clears the override. */
export function setShortcut(id: ShortcutId, binding: string | null) {
  const overrides = readOverrides()
  if (binding === null || binding === DEFAULT_BINDINGS[id]) delete overrides[id]
  else overrides[id] = binding
  writeOverrides(overrides)
}

export function resetShortcuts() {
  writeOverrides({})
}

/** Current key bindings (defaults plus the user's overrides), kept in localStorage. */
export function useShortcuts(): Bindings {
  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_BINDINGS)
}
