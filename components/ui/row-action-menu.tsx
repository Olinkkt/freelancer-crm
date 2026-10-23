'use client'

import React, { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { useEscapeLayer } from '@/components/shortcuts/escape-layer'

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
  const [mounted, setMounted] = useState(false)
  const [menuPosition, setMenuPosition] = useState<{
    top?: number
    bottom?: number
    left?: number
    right?: number
  } | null>(null)

  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Calculate coordinates when open, and handle window scroll/resize
  useEffect(() => {
    if (!isOpen || !buttonRef.current) return

    const updatePosition = () => {
      if (!buttonRef.current) return
      const rect = buttonRef.current.getBoundingClientRect()
      const menuWidth = 190
      const approxMenuHeight = items.length * 36 + 16
      const spaceBelow = window.innerHeight - rect.bottom
      const spaceAbove = rect.top

      const shouldFlipUp = spaceBelow < approxMenuHeight && spaceAbove > spaceBelow

      let pos: { top?: number; bottom?: number; left?: number; right?: number } = {}

      if (shouldFlipUp) {
        pos.bottom = window.innerHeight - rect.top + 4
      } else {
        pos.top = rect.bottom + 4
      }

      if (align === 'left') {
        const left = Math.min(rect.left, window.innerWidth - menuWidth - 8)
        pos.left = Math.max(8, left)
      } else {
        const right = window.innerWidth - rect.right
        pos.right = Math.max(8, Math.min(right, window.innerWidth - menuWidth - 8))
      }

      setMenuPosition(pos)
    }

    updatePosition()
    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [isOpen, align, items.length])

  // Click outside and escape key handling
  useEffect(() => {
    if (!isOpen) return

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        buttonRef.current &&
        !buttonRef.current.contains(target)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  useEscapeLayer(() => setIsOpen(false), isOpen)

  return (
    <div
      className={`relative inline-flex items-center ${className}`}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className={`more-button ${isOpen ? 'bg-[#f0f2f5] text-[#1c1d1f]' : ''}`}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={(e) => {
          e.stopPropagation()
          setIsOpen((prev) => !prev)
        }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <MoreHorizontal size={17} />
      </button>

      {isOpen &&
        mounted &&
        menuPosition &&
        createPortal(
          <div
            ref={menuRef}
            role="menu"
            aria-label={triggerLabel}
            style={{
              position: 'fixed',
              top: menuPosition.top !== undefined ? `${menuPosition.top}px` : undefined,
              bottom: menuPosition.bottom !== undefined ? `${menuPosition.bottom}px` : undefined,
              left: menuPosition.left !== undefined ? `${menuPosition.left}px` : undefined,
              right: menuPosition.right !== undefined ? `${menuPosition.right}px` : undefined,
              zIndex: 9999,
            }}
            className="min-w-[180px] bg-white rounded-[9px] border border-[#edf0f3] shadow-[0_12px_30px_rgba(0,0,0,0.14)] p-1 text-[12px] animate-in fade-in zoom-in-95 duration-75 select-none"
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
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
          </div>,
          document.body
        )}
    </div>
  )
}
