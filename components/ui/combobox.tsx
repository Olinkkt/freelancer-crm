'use client'

import React, { useState, useRef, useEffect, useMemo, useId } from 'react'
import { ChevronDown, X, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ComboboxOption {
  id?: string
  label: string
  value?: string
  sublabel?: string
}

export interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: ComboboxOption[]
  placeholder?: string
  className?: string
  required?: boolean
  maxLength?: number
  autoFocus?: boolean
  name?: string
  id?: string
  disabled?: boolean
}

export function Combobox({
  value,
  onChange,
  options,
  placeholder = 'Select or type...',
  className,
  required,
  maxLength,
  autoFocus,
  name,
  id: propId,
  disabled = false,
}: ComboboxProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(-1)
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)
  const generatedId = useId()
  const id = propId || generatedId

  // Filter options based on input value
  const filteredOptions = useMemo(() => {
    if (!value || !value.trim()) return options
    const query = value.toLowerCase().trim()
    return options.filter((opt) => {
      const matchLabel = opt.label.toLowerCase().includes(query)
      const matchValue = opt.value ? opt.value.toLowerCase().includes(query) : false
      const matchSublabel = opt.sublabel ? opt.sublabel.toLowerCase().includes(query) : false
      return matchLabel || matchValue || matchSublabel
    })
  }, [options, value])

  // Close on outside click
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [])

  // Auto-scroll highlighted option into view
  useEffect(() => {
    if (isOpen && highlightedIndex >= 0 && listRef.current) {
      const optionElement = listRef.current.children[highlightedIndex] as HTMLElement
      if (optionElement) {
        optionElement.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [highlightedIndex, isOpen])

  const selectOption = (opt: ComboboxOption) => {
    const selectedVal = opt.value !== undefined ? opt.value : opt.label
    onChange(selectedVal)
    setIsOpen(false)
    setHighlightedIndex(-1)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (disabled) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(0)
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : 0))
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (!isOpen) {
        setIsOpen(true)
        setHighlightedIndex(filteredOptions.length - 1)
      } else if (filteredOptions.length > 0) {
        setHighlightedIndex((prev) => (prev > 0 ? prev - 1 : filteredOptions.length - 1))
      }
    } else if (e.key === 'Enter') {
      if (isOpen && highlightedIndex >= 0 && filteredOptions[highlightedIndex]) {
        e.preventDefault()
        selectOption(filteredOptions[highlightedIndex])
      }
    } else if (e.key === 'Escape') {
      if (isOpen) {
        e.preventDefault()
        e.stopPropagation()
        setIsOpen(false)
      }
    } else if (e.key === 'Tab') {
      setIsOpen(false)
    }
  }

  const handleClear = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    onChange('')
    setIsOpen(false)
    setHighlightedIndex(-1)
    inputRef.current?.focus()
  }

  const toggleDropdown = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled) return
    setIsOpen((prev) => !prev)
    inputRef.current?.focus()
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          id={id}
          name={name}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-autocomplete="list"
          aria-controls={`${id}-listbox`}
          required={required}
          maxLength={maxLength}
          autoFocus={autoFocus}
          disabled={disabled}
          value={value}
          placeholder={placeholder}
          autoComplete="off"
          onChange={(e) => {
            onChange(e.target.value)
            if (!isOpen) setIsOpen(true)
            setHighlightedIndex(-1)
          }}
          onClick={() => {
            if (!isOpen) setIsOpen(true)
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            'w-full h-10 pl-3 pr-14 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f]',
            'placeholder:text-[#9fa1a7] bg-white transition-all',
            'focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15',
            disabled && 'bg-[#f8f9fa] text-[#8f99a8] cursor-not-allowed',
            className
          )}
        />

        <div className="absolute right-2 flex items-center gap-0.5 text-[#8f99a8]">
          {value && !disabled && (
            <button
              type="button"
              tabIndex={-1}
              onClick={handleClear}
              aria-label="Clear value"
              className="p-1 rounded-[6px] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
            >
              <X size={14} />
            </button>
          )}

          <button
            type="button"
            tabIndex={-1}
            onClick={toggleDropdown}
            aria-label={isOpen ? 'Close options' : 'Open options'}
            className="p-1 rounded-[6px] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            <ChevronDown
              size={15}
              className={cn('transition-transform duration-150', isOpen && 'rotate-180')}
            />
          </button>
        </div>
      </div>

      {isOpen && (
        <ul
          ref={listRef}
          id={`${id}-listbox`}
          role="listbox"
          className="absolute left-0 right-0 top-full mt-1 z-50 max-h-56 overflow-y-auto bg-white rounded-[10px] border border-[#e4e7ec] shadow-lg py-1 text-[13px] animate-in fade-in zoom-in-95 duration-100"
        >
          {filteredOptions.length > 0 ? (
            filteredOptions.map((opt, idx) => {
              const optValue = opt.value !== undefined ? opt.value : opt.label
              const isSelected = value.trim() === optValue.trim()
              const isHighlighted = idx === highlightedIndex

              return (
                <li
                  key={opt.id || `${optValue}-${idx}`}
                  role="option"
                  aria-selected={isSelected}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  onMouseDown={(e) => {
                    e.preventDefault()
                    selectOption(opt)
                  }}
                  className={cn(
                    'px-3 py-2 cursor-pointer flex items-center justify-between transition-colors',
                    isHighlighted && 'bg-[#f4f7fe] text-[#266df0]',
                    isSelected && !isHighlighted && 'bg-[#f8f9fb] font-medium text-[#1c1d1f]',
                    !isSelected && !isHighlighted && 'text-[#1c1d1f]'
                  )}
                >
                  <div className="flex flex-col min-w-0 pr-2">
                    <span className="truncate">{opt.label}</span>
                    {opt.sublabel && (
                      <span className="text-[11px] text-[#8f99a8] truncate">
                        {opt.sublabel}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check size={14} className="shrink-0 text-[#266df0]" />
                  )}
                </li>
              )
            })
          ) : (
            <li className="px-3 py-2.5 text-center text-[12px] text-[#8f99a8]">
              {value.trim() ? (
                <span>
                  No matching options (using &ldquo;<strong className="text-[#1c1d1f]">{value}</strong>&rdquo;)
                </span>
              ) : (
                <span>No options available</span>
              )}
            </li>
          )}
        </ul>
      )}
    </div>
  )
}
