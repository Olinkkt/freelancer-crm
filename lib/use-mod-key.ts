'use client'

import { useEffect, useState } from 'react'

/** True on macOS / iOS, where shortcuts use ⌘ instead of Ctrl */
function isApplePlatform(): boolean {
  if (typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { userAgentData?: { platform?: string } }
  const platform = nav.userAgentData?.platform || nav.platform || nav.userAgent || ''
  return /mac|iphone|ipad|ipod/i.test(platform)
}

/** The primary shortcut modifier label for this platform: "⌘" on Apple, "Ctrl" elsewhere */
export function useModKey(): string {
  const [modKey, setModKey] = useState('Ctrl')
  useEffect(() => {
    if (isApplePlatform()) setModKey('⌘')
  }, [])
  return modKey
}
