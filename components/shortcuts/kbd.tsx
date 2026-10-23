'use client'

import React from 'react'
import { formatBinding, getPlatform } from '@/lib/shortcuts/keys'
import type { Platform } from '@/lib/shortcuts/types'

export interface KbdProps {
  binding?: string
  platform?: Platform
  className?: string
}

export function Kbd({ binding, platform, className = '' }: KbdProps) {
  if (!binding) return null
  const p = platform ?? getPlatform()
  const formatted = formatBinding(binding, p)

  return (
    <kbd
      className={`inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-[#2e3238] text-[#bad0fa] rounded-[5px] border border-[#444a53] shadow-sm select-none ${className}`}
    >
      {formatted}
    </kbd>
  )
}
