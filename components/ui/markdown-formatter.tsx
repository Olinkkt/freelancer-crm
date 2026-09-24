'use client'

import React from 'react'

interface MarkdownFormatterProps {
  content: string
  className?: string
  onToggleTodo?: (todoText: string, newCompleted: boolean) => void
}

/**
 * Format inline markdown tokens: **bold**, *italic*, `code`, and [links](url)
 */
function formatInlineMarkdown(text: string): React.ReactNode {
  if (!text) return null

  // Match: `inline code`, **bold**, *italic*, [label](url)
  const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*|\[[^\]]+\]\([^)]+\))/g
  const parts = text.split(regex)

  return parts.map((part, index) => {
    if (!part) return null

    // Inline Code
    if (part.startsWith('`') && part.endsWith('`') && part.length >= 2) {
      return (
        <code
          key={index}
          className="px-1.5 py-0.5 rounded font-mono text-[11px] bg-[#f0f2f5] text-[#1c1d1f] border border-[#e4e7ec]"
        >
          {part.slice(1, -1)}
        </code>
      )
    }

    // Bold
    if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
      return (
        <strong key={index} className="font-semibold text-[#1c1d1f]">
          {part.slice(2, -2)}
        </strong>
      )
    }

    // Italic
    if (part.startsWith('*') && part.endsWith('*') && part.length >= 2) {
      return (
        <em key={index} className="italic text-[#505967]">
          {part.slice(1, -1)}
        </em>
      )
    }

    // Links
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (linkMatch) {
      return (
        <a
          key={index}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#266df0] underline font-medium hover:text-[#1952b8]"
        >
          {linkMatch[1]}
        </a>
      )
    }

    return part
  })
}

/**
 * Clean, lightweight Markdown formatter tailored for CRM meeting notes,
 * scope deliverables, and commercial quotes.
 */
export function MarkdownFormatter({
  content,
  className = '',
  onToggleTodo,
}: MarkdownFormatterProps) {
  if (!content) return null

  const lines = content.split('\n')

  return (
    <div className={`space-y-1 text-[12px] leading-relaxed text-[#334155] ${className}`}>
      {lines.map((line, idx) => {
        const trimmed = line.trim()

        // 1. Empty lines
        if (!trimmed) {
          return <div key={idx} className="h-1.5" />
        }

        // 2. Horizontal divider
        if (trimmed === '---' || trimmed === '***' || trimmed === '___') {
          return <hr key={idx} className="my-2 border-[#edf0f3]" />
        }

        // 3. Headings
        if (trimmed.startsWith('# ')) {
          return (
            <h1
              key={idx}
              className="text-[15px] font-bold text-[#1c1d1f] tracking-tight mt-3 mb-1.5 first:mt-0 pb-1 border-b border-[#edf0f3]"
            >
              {formatInlineMarkdown(trimmed.slice(2))}
            </h1>
          )
        }
        if (trimmed.startsWith('## ')) {
          return (
            <h2
              key={idx}
              className="text-[14px] font-bold text-[#1c1d1f] tracking-tight mt-2.5 mb-1 first:mt-0"
            >
              {formatInlineMarkdown(trimmed.slice(3))}
            </h2>
          )
        }
        if (trimmed.startsWith('### ')) {
          return (
            <h3
              key={idx}
              className="text-[13px] font-bold text-[#1c1d1f] tracking-tight mt-2 mb-1 first:mt-0 flex items-center gap-1.5"
            >
              {formatInlineMarkdown(trimmed.slice(4))}
            </h3>
          )
        }
        if (trimmed.startsWith('#### ')) {
          return (
            <h4
              key={idx}
              className="text-[12px] font-semibold text-[#1c1d1f] mt-1.5 mb-0.5 first:mt-0"
            >
              {formatInlineMarkdown(trimmed.slice(5))}
            </h4>
          )
        }

        // 4. Blockquotes
        if (trimmed.startsWith('> ')) {
          return (
            <blockquote
              key={idx}
              className="border-l-2 border-[#266df0] pl-2.5 my-1 text-[#505967] italic text-[11px]"
            >
              {formatInlineMarkdown(trimmed.slice(2))}
            </blockquote>
          )
        }

        // 5. Checklist items (- [ ] or - [x])
        const checkMatch = line.match(/^(\s*)-\s*\[([ xX])\]\s*(.*)$/)
        if (checkMatch) {
          const indentSpaces = checkMatch[1].length
          const isChecked = checkMatch[2].toLowerCase() === 'x'
          const taskText = checkMatch[3]

          return (
            <div
              key={idx}
              className="flex items-start gap-2 py-0.5"
              style={{ paddingLeft: `${Math.min(indentSpaces * 8, 32)}px` }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                readOnly={!onToggleTodo}
                onChange={() => {
                  if (onToggleTodo) {
                    onToggleTodo(taskText, !isChecked)
                  }
                }}
                className="mt-1 h-3.5 w-3.5 rounded border-[#c7ccd6] text-[#266df0] focus:ring-0 cursor-pointer accent-[#266df0]"
              />
              <span
                className={`flex-1 ${
                  isChecked
                    ? 'line-through text-[#8f99a8]'
                    : 'text-[#232529] font-medium'
                }`}
              >
                {formatInlineMarkdown(taskText)}
              </span>
            </div>
          )
        }

        // 6. Bullet list items (- item, * item, • item)
        const bulletMatch = line.match(/^(\s*)([-*•])\s+(.*)$/)
        if (bulletMatch) {
          const indentSpaces = bulletMatch[1].length
          const bulletText = bulletMatch[3]

          return (
            <div
              key={idx}
              className="flex items-start gap-2 py-0.5 text-[#334155]"
              style={{ paddingLeft: `${Math.min(indentSpaces * 8, 32)}px` }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#8f99a8] mt-1.5 shrink-0" />
              <span className="flex-1 leading-relaxed">
                {formatInlineMarkdown(bulletText)}
              </span>
            </div>
          )
        }

        // 7. Regular paragraph text
        return (
          <p key={idx} className="py-0.5 text-[#334155] leading-relaxed">
            {formatInlineMarkdown(line)}
          </p>
        )
      })}
    </div>
  )
}
