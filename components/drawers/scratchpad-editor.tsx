'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  PhoneCall,
  ListTodo,
  Calculator,
  CheckSquare,
  Sparkles,
  Command,
  ArrowRight,
  Check,
  Eye,
  Edit2,
  Share2,
  Bold,
  Italic,
  Heading,
  List,
  Code,
} from 'lucide-react'
import { MarkdownFormatter } from '../ui/markdown-formatter'

interface ScratchpadEditorProps {
  notes: string
  onChangeNotes: (notes: string) => void
  onSave?: () => void
  onSyncTodos?: (todos: string[]) => void
  dealContext?: {
    title: string
    company: string
    contactName?: string
    value?: string
  }
}

interface SlashCommand {
  id: string
  command: string
  title: string
  description: string
  icon: React.ReactNode
  template: (context?: ScratchpadEditorProps['dealContext']) => string
}

export function ScratchpadEditor({
  notes,
  onChangeNotes,
  onSave,
  onSyncTodos,
  dealContext,
}: ScratchpadEditorProps) {
  const [isSlashMenuOpen, setIsSlashMenuOpen] = useState(false)
  const [slashSearch, setSlashSearch] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0 })
  const [isPreview, setIsPreview] = useState(false)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)

  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const slashCommands: SlashCommand[] = [
    {
      id: 'call',
      command: '/call',
      title: 'Call / Meeting Log',
      description: 'Timestamped call notes, attendees & decision points',
      icon: <PhoneCall size={14} className="text-[#266df0]" />,
      template: (ctx) => {
        const now = new Date()
        const timeStr = now.toLocaleDateString('cs-CZ', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })
        return `### 📞 Client Call — ${timeStr}
- **Client:** ${ctx?.contactName || ctx?.company || 'Client'}
- **Focus:** ${ctx?.title || 'Scope & Timeline Discussion'}
- **Key Takeaways:**
  • Client requirements: 
  • Timeline preference: 
- **Agreed Decisions:**
  • `
      },
    },
    {
      id: 'scope',
      command: '/scope',
      title: 'Deliverables & Scope',
      description: 'Structured checklist of milestone deliverables',
      icon: <ListTodo size={14} className="text-[#805ad5]" />,
      template: (ctx) => `### 📋 Project Scope: ${ctx?.title || 'Deliverables'}
- [ ] Phase 1: Information Architecture & Wireframes
- [ ] Phase 2: High-fidelity Design & Brand Polish
- [ ] Phase 3: Next.js Implementation & Tailwind build
- [ ] Phase 4: Production Deployment & Client Sign-off`,
    },
    {
      id: 'quote',
      command: '/quote',
      title: 'Budget & Quote Calculation',
      description: 'Milestone deposit breakdown and price summary',
      icon: <Calculator size={14} className="text-[#43a878]" />,
      template: (ctx) => {
        const val = ctx?.value || '30 000 Kč'
        return `### 💰 Commercial Quote Calculation
- **Total Project Fee:** ${val}
- **Milestone 1 (50% Deposit):** Due upon project kickoff
- **Milestone 2 (50% Final):** Due upon deployment & source code release
- **Terms:** Net 14 days, VAT invoice provided`
      },
    },
    {
      id: 'todo',
      command: '/todo',
      title: 'GTD Next Action Checklist',
      description: 'Add urgent todo items to sync to dashboard follow-ups',
      icon: <CheckSquare size={14} className="text-[#c4882b]" />,
      template: (ctx) =>
        `- [ ] Send revised scope and milestones to ${ctx?.contactName || ctx?.company || 'client'} by tomorrow 14:00`,
    },
  ]

  const filteredCommands = slashCommands.filter(
    (c) =>
      c.command.toLowerCase().includes(slashSearch.toLowerCase()) ||
      c.title.toLowerCase().includes(slashSearch.toLowerCase())
  )

  // Detect slash typing
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value
    onChangeNotes(val)

    const cursor = e.target.selectionStart
    const textBeforeCursor = val.slice(0, cursor)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    // Check if slash was just typed
    if (
      lastSlashIndex !== -1 &&
      (lastSlashIndex === 0 || textBeforeCursor[lastSlashIndex - 1] === '\n' || textBeforeCursor[lastSlashIndex - 1] === ' ')
    ) {
      const query = textBeforeCursor.slice(lastSlashIndex + 1)
      if (!query.includes(' ') && !query.includes('\n')) {
        setSlashSearch(query)
        setIsSlashMenuOpen(true)
        setSelectedIndex(0)
        return
      }
    }

    setIsSlashMenuOpen(false)
  }

  const applyCommand = (command: SlashCommand) => {
    const textarea = textareaRef.current
    if (!textarea) return

    const cursor = textarea.selectionStart
    const textBeforeCursor = notes.slice(0, cursor)
    const textAfterCursor = notes.slice(cursor)
    const lastSlashIndex = textBeforeCursor.lastIndexOf('/')

    const snippet = command.template(dealContext)

    let newNotes = ''
    if (lastSlashIndex !== -1) {
      newNotes = textBeforeCursor.slice(0, lastSlashIndex) + snippet + textAfterCursor
    } else {
      newNotes = notes ? `${notes}\n\n${snippet}` : snippet
    }

    onChangeNotes(newNotes)
    setIsSlashMenuOpen(false)

    setTimeout(() => {
      textarea.focus()
      const newCursorPos = (lastSlashIndex !== -1 ? lastSlashIndex : notes.length) + snippet.length
      textarea.setSelectionRange(newCursorPos, newCursorPos)
    }, 20)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!isSlashMenuOpen || filteredCommands.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % filteredCommands.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      applyCommand(filteredCommands[selectedIndex])
    } else if (e.key === 'Escape') {
      e.preventDefault()
      setIsSlashMenuOpen(false)
    }
  }

  // Extract todos matching "- [ ]"
  const extractTodos = (): string[] => {
    const lines = notes.split('\n')
    return lines
      .filter((l) => l.trim().startsWith('- [ ]'))
      .map((l) => l.trim().replace(/^- \[ \]\s*/, ''))
      .filter(Boolean)
  }

  const pendingTodos = extractTodos()

  const handleSyncTodos = () => {
    if (onSyncTodos && pendingTodos.length > 0) {
      onSyncTodos(pendingTodos)
      setSyncedCount(pendingTodos.length)
      setTimeout(() => setSyncedCount(null), 3500)
    }
  }

  const insertFormatting = (prefix: string, suffix: string = '') => {
    if (!textareaRef.current) return
    const el = textareaRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    const selectedText = notes.substring(start, end)
    const replacement = `${prefix}${selectedText || 'text'}${suffix}`
    const newNotes = notes.substring(0, start) + replacement + notes.substring(end)
    onChangeNotes(newNotes)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + prefix.length, start + prefix.length + (selectedText.length || 4))
    }, 10)
  }

  return (
    <div className="relative space-y-2">
      {/* Quick Access Action Bar */}
      <div className="flex items-center justify-between gap-1 flex-wrap pb-1 border-b border-[#f0f1f3]">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[10px] font-bold text-[#8f99a8] uppercase tracking-wider flex items-center gap-1 mr-1">
            <Command size={11} />
            Slash:
          </span>
          {slashCommands.map((cmd) => (
            <button
              key={cmd.id}
              type="button"
              onClick={() => applyCommand(cmd)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-mono font-medium text-[#505967] bg-[#f4f5f6] hover:bg-[#e9f0ff] hover:text-[#266df0] hover:border-[#bad0fa] border border-[#e4e7ec] transition-all cursor-pointer"
              title={cmd.description}
            >
              {cmd.icon}
              <span>{cmd.command}</span>
            </button>
          ))}

          {/* Quick Markdown Formatter Buttons */}
          <div className="flex items-center gap-0.5 border-l border-[#e4e7ec] pl-1.5 ml-1">
            <button
              type="button"
              onClick={() => insertFormatting('**', '**')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Bold (**text**)"
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('*', '*')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Italic (*text*)"
            >
              <Italic size={12} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('### ')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Heading (### Title)"
            >
              <Heading size={12} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- ')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Bullet list (- item)"
            >
              <List size={12} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('- [ ] ')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Checklist task (- [ ] todo)"
            >
              <CheckSquare size={12} />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('`', '`')}
              className="p-1 rounded-[5px] text-[#505967] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
              title="Inline code (`code`)"
            >
              <Code size={12} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 ml-auto">
          <button
            type="button"
            onClick={() => setIsPreview(!isPreview)}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-[6px] text-[11px] font-medium text-[#6f7988] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            {isPreview ? <Edit2 size={11} /> : <Eye size={11} />}
            <span>{isPreview ? 'Edit' : 'Preview'}</span>
          </button>
        </div>
      </div>

      {/* Editor or Preview */}
      {isPreview ? (
        <div className="w-full min-h-[160px] p-3.5 bg-[#fafbfc] border border-[#edf0f3] rounded-[10px] overflow-y-auto max-h-[300px]">
          {notes ? (
            <MarkdownFormatter content={notes} />
          ) : (
            <span className="text-[#9fa1a7] italic text-[11px]">
              Empty scratchpad. Use /call, /scope, /quote or formatting tools to start.
            </span>
          )}
        </div>
      ) : (
        <div className="relative">
          <textarea
            ref={textareaRef}
            rows={7}
            value={notes}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type meeting takeaways or press '/' for fast commands (/call, /scope, /quote, /todo)..."
            className="w-full p-3.5 border border-[#e4e7ec] rounded-[10px] text-[12px] text-[#1c1d1f] placeholder:text-[#9fa1a7] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 leading-relaxed font-sans resize-y"
          />

          {/* Floating Slash Command Autocomplete Popover */}
          {isSlashMenuOpen && filteredCommands.length > 0 && (
            <div className="absolute top-12 left-4 z-50 w-72 bg-white rounded-[10px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-100">
              <div className="px-3 py-1.5 bg-[#fafbfc] border-b border-[#edf0f3] flex items-center justify-between text-[10px] font-semibold text-[#8f99a8] uppercase tracking-wider">
                <span>Slash Commands</span>
                <span>↵ Insert</span>
              </div>
              <div className="p-1 max-h-52 overflow-y-auto space-y-0.5">
                {filteredCommands.map((cmd, idx) => (
                  <button
                    key={cmd.id}
                    type="button"
                    onClick={() => applyCommand(cmd)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`w-full flex items-start gap-2.5 px-2.5 py-2 rounded-[7px] text-left transition-colors cursor-pointer ${
                      selectedIndex === idx ? 'bg-[#f0f4ff] text-[#1c1d1f]' : 'hover:bg-[#fafbfc] text-[#505967]'
                    }`}
                  >
                    <div className="p-1 rounded-[5px] bg-white border border-[#e4e7ec] shrink-0 mt-0.5">
                      {cmd.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <strong className="text-[12px] font-semibold text-[#1c1d1f]">
                          {cmd.title}
                        </strong>
                        <span className="font-mono text-[10px] text-[#266df0] font-semibold">
                          {cmd.command}
                        </span>
                      </div>
                      <p className="text-[10px] text-[#8f99a8] line-clamp-1">{cmd.description}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sync GTD Todos Banner (if action items detected) */}
      {pendingTodos.length > 0 && onSyncTodos && (
        <div className="flex items-center justify-between p-2.5 bg-[#f8faff] border border-[#d6e3fc] rounded-[8px] animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <CheckSquare size={13} className="text-[#266df0]" />
            <span className="text-[11px] font-medium text-[#1c1d1f]">
              Found <strong>{pendingTodos.length}</strong> action items in scratchpad
            </span>
          </div>

          <button
            type="button"
            onClick={handleSyncTodos}
            disabled={syncedCount !== null}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-[#266df0] hover:bg-[#1a55c2] text-white text-[11px] font-medium rounded-[6px] shadow-2xs transition-colors cursor-pointer disabled:bg-[#43a878]"
          >
            {syncedCount !== null ? (
              <>
                <Check size={12} />
                <span>Synced {syncedCount} to Follow-ups!</span>
              </>
            ) : (
              <>
                <ArrowRight size={12} />
                <span>Sync to Follow-ups</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
