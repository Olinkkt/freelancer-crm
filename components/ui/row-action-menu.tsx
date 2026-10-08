'use client'

import React, { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface RowActionMenuItem {
  label: string
  icon?: React.ComponentType<{ size?: number; className?: string }>
  onClick: () => void
  destructive?: boolean
  divider?: boolean
}

interface RowActionMenuProps {
  items: RowActionMenuItem[]
  triggerLabel?: string
  className?: string
  align?: 'left' | 'right'
}

export function RowActionMenu({
  items,
  triggerLabel = 'Options',
  className = '',
  align = 'right',
}: RowActionMenuProps) {
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen])

  return (
    <div
      ref={menuRef}
      className={`relative inline-flex items-center ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        type="button"
        className={`more-button ${isOpen ? 'bg-[#f0f2f5] text-[#1c1d1f]' : ''}`}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
      >
        <MoreHorizontal size={17} />
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label={triggerLabel}
          className={`absolute ${
            align === 'right' ? 'right-0' : 'left-0'
          } top-full mt-1 z-50 min-w-[180px] bg-white rounded-[9px] border border-[#edf0f3] shadow-[0_12px_30px_rgba(0,0,0,0.12)] p-1 text-[12px] animate-in fade-in zoom-in-95 duration-75`}
          onClick={(e) => e.stopPropagation()}
        >
          {items.map((item, idx) => {
            const Icon = item.icon
            return (
              <React.Fragment key={idx}>
                {item.divider && <div className="my-1 border-t border-[#f0f2f5]" />}
                <button
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation()
                    setIsOpen(false)
                    item.onClick()
                  }}
                  className={`w-full px-2.5 py-1.5 flex items-center gap-2 rounded-[6px] text-left transition-colors cursor-pointer select-none font-medium ${
                    item.destructive
                      ? 'text-[#d93025] hover:bg-[#fff1f1]'
                      : 'text-[#232529] hover:bg-[#f4f6fa]'
                  }`}
                >
                  {Icon && (
                    <Icon
                      size={14}
                      className={item.destructive ? 'text-[#d93025]' : 'text-[#6f7988]'}
                    />
                  )}
                  <span>{item.label}</span>
                </button>
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
