'use client'

import React, { useState, useEffect, useCallback, useMemo } from 'react'
import {
  Lock,
  Copy,
  Edit2,
  Trash2,
  Plus,
  ArrowUp,
  ArrowDown,
  RefreshCw,
  AlertCircle,
  Check,
} from 'lucide-react'
import { useShortcutContext, useShortcut } from '@/components/shortcuts/shortcut-provider'
import type { ProjectStage, ProjectTemplate } from '@/lib/projects/types'
import {
  fetchProjectConfigAction,
  upsertStageAction,
  reorderStagesAction,
  deleteStageAction,
  duplicateTemplateAction,
  deleteTemplateAction,
  updateProjectSettingsAction,
} from '@/app/actions/projects'
import { TemplateEditor } from '@/components/settings/template-editor'

interface ProjectSettingsProps {
  showToast?: (message: string, type?: 'info' | 'success' | 'warning' | 'error') => void
}

const CATEGORY_LABELS: Record<string, string> = {
  planned: 'Planned / Discovery',
  active: 'Active',
  review: 'In Review',
  delivered: 'Delivered',
  closed: 'Closed',
}

const COLOR_OPTIONS = [
  'blue',
  'violet',
  'amber',
  'emerald',
  'slate',
  'rose',
  'indigo',
  'orange',
]

export function ProjectSettings({ showToast }: ProjectSettingsProps) {
  useShortcutContext('stageSettings')

  const [isLoading, setIsLoading] = useState(true)
  const [stages, setStages] = useState<ProjectStage[]>([])
  const [templates, setTemplates] = useState<ProjectTemplate[]>([])
  const [invoiceNetDays, setInvoiceNetDays] = useState(14)
  const [isSavingSettings, setIsSavingSettings] = useState(false)

  // Stage selection / editing
  const [selectedStageIndex, setSelectedStageIndex] = useState(0)
  const [editingStageId, setEditingStageId] = useState<string | null>(null)
  const [stageNameDraft, setStageNameDraft] = useState('')

  // Template editor modal
  const [editingTemplate, setEditingTemplate] = useState<ProjectTemplate | null>(null)
  const [isTemplateEditorOpen, setIsTemplateEditorOpen] = useState(false)

  // Stage delete confirmation / fallback modal
  const [deletingStage, setDeletingStage] = useState<ProjectStage | null>(null)
  const [fallbackStageId, setFallbackStageId] = useState<string>('')

  // Load config
  const loadConfig = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetchProjectConfigAction()
      if (res.ok) {
        setStages(res.data.stages)
        setTemplates(res.data.templates)
        setInvoiceNetDays(res.data.invoiceNetDays)
      } else {
        showToast?.(res.error.message || 'Failed to load project settings', 'error')
      }
    } catch (err: any) {
      showToast?.(err.message || 'Error loading project settings', 'error')
    } finally {
      setIsLoading(false)
    }
  }, [showToast])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

  // Save invoice net days
  const handleSaveNetDays = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSavingSettings(true)
    try {
      const res = await updateProjectSettingsAction({
        invoiceNetDays: Number(invoiceNetDays),
      })
      if (res.ok) {
        showToast?.('Settings saved', 'success')
      } else {
        showToast?.(res.error.message || 'Failed to save settings', 'error')
      }
    } finally {
      setIsSavingSettings(false)
    }
  }

  // Keyboard navigation for stages
  useShortcut('stages.down', () => {
    if (editingStageId) return
    setSelectedStageIndex((prev) => Math.min(stages.length - 1, prev + 1))
  })

  useShortcut('stages.up', () => {
    if (editingStageId) return
    setSelectedStageIndex((prev) => Math.max(0, prev - 1))
  })

  useShortcut('stages.rename', () => {
    if (editingStageId) {
      // Save
      handleSaveStageName()
    } else {
      const cur = stages[selectedStageIndex]
      if (cur) {
        setEditingStageId(cur.id)
        setStageNameDraft(cur.name)
      }
    }
  })

  useShortcut('stages.moveUp', async () => {
    const cur = stages[selectedStageIndex]
    if (!cur) return
    const sameCatStages = stages.filter((s) => s.category === cur.category)
    const idxInCat = sameCatStages.findIndex((s) => s.id === cur.id)
    if (idxInCat <= 0) return

    const prevStage = sameCatStages[idxInCat - 1]
    const updated = [...stages]
    const idxA = updated.findIndex((s) => s.id === cur.id)
    const idxB = updated.findIndex((s) => s.id === prevStage.id)
    updated[idxA] = prevStage
    updated[idxB] = cur

    const res = await reorderStagesAction({ orderedIds: updated.map((s) => s.id) })
    if (res.ok) {
      setStages(updated)
      setSelectedStageIndex(idxB)
      showToast?.('Stage moved up', 'success')
    }
  })

  useShortcut('stages.moveDown', async () => {
    const cur = stages[selectedStageIndex]
    if (!cur) return
    const sameCatStages = stages.filter((s) => s.category === cur.category)
    const idxInCat = sameCatStages.findIndex((s) => s.id === cur.id)
    if (idxInCat >= sameCatStages.length - 1) return

    const nextStage = sameCatStages[idxInCat + 1]
    const updated = [...stages]
    const idxA = updated.findIndex((s) => s.id === cur.id)
    const idxB = updated.findIndex((s) => s.id === nextStage.id)
    updated[idxA] = nextStage
    updated[idxB] = cur

    const res = await reorderStagesAction({ orderedIds: updated.map((s) => s.id) })
    if (res.ok) {
      setStages(updated)
      setSelectedStageIndex(idxB)
      showToast?.('Stage moved down', 'success')
    }
  })

  const handleSaveStageName = async () => {
    if (!editingStageId || !stageNameDraft.trim()) {
      setEditingStageId(null)
      return
    }
    const stage = stages.find((s) => s.id === editingStageId)
    if (!stage) return

    const res = await upsertStageAction({
      id: stage.id,
      name: stageNameDraft.trim(),
      category: stage.category,
      color: stage.color,
    })

    if (res.ok) {
      setStages((prev) => prev.map((s) => (s.id === stage.id ? res.data : s)))
      showToast?.('Stage renamed', 'success')
    } else {
      showToast?.(res.error.message || 'Failed to rename stage', 'error')
    }
    setEditingStageId(null)
  }

  const handleDeleteStage = async (stage: ProjectStage, fallbackId: string | null = null) => {
    const res = await deleteStageAction({
      id: stage.id,
      moveProjectsToStageId: fallbackId,
    })

    if (res.ok) {
      showToast?.(`Stage ${stage.name} deleted`, 'success')
      setDeletingStage(null)
      loadConfig()
    } else {
      if (res.error.code === 'STAGE_IN_USE') {
        setDeletingStage(stage)
        const otherStages = stages.filter((s) => s.id !== stage.id)
        if (otherStages.length > 0) setFallbackStageId(otherStages[0].id)
      } else {
        showToast?.(res.error.message || 'Failed to delete stage', 'error')
      }
    }
  }

  const handleAddStage = async (category: ProjectStage['category']) => {
    const res = await upsertStageAction({
      name: `New ${CATEGORY_LABELS[category]} Stage`,
      category,
      color: 'blue',
    })

    if (res.ok) {
      showToast?.('Stage added', 'success')
      loadConfig()
    } else {
      showToast?.(res.error.message || 'Failed to add stage', 'error')
    }
  }

  // Template actions
  const handleDuplicateTemplate = async (templateId: string) => {
    const res = await duplicateTemplateAction({ id: templateId })
    if (res.ok) {
      showToast?.(`Duplicated template as ${res.data.name}`, 'success')
      loadConfig()
    } else {
      showToast?.(res.error.message || 'Failed to duplicate template', 'error')
    }
  }

  const handleDeleteTemplate = async (template: ProjectTemplate) => {
    if (template.isBuiltin) {
      showToast?.('Built-in templates cannot be deleted', 'warning')
      return
    }
    const res = await deleteTemplateAction({ id: template.id })
    if (res.ok) {
      showToast?.(`Template ${template.name} deleted`, 'success')
      loadConfig()
    } else {
      showToast?.(res.error.message || 'Failed to delete template', 'error')
    }
  }

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[300px]">
        <RefreshCw size={16} className="animate-spin text-blue-500" />
      </div>
    )
  }

  const groupedStages = {
    planned: stages.filter((s) => s.category === 'planned'),
    active: stages.filter((s) => s.category === 'active'),
    review: stages.filter((s) => s.category === 'review'),
    delivered: stages.filter((s) => s.category === 'delivered'),
    closed: stages.filter((s) => s.category === 'closed'),
  }

  return (
    <div className="p-6 max-w-4xl space-y-8">
      {/* 1. Payment Terms */}
      <section className="space-y-3 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Invoice Payment Terms
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Default number of days before a new invoice becomes due.
          </p>
        </div>

        <form onSubmit={handleSaveNetDays} className="flex items-center gap-3">
          <input
            type="number"
            min={0}
            max={120}
            value={invoiceNetDays}
            onChange={(e) => setInvoiceNetDays(Number(e.target.value))}
            className="w-24 px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 outline-none"
          />
          <span className="text-xs text-slate-500">days net</span>
          <button
            type="submit"
            disabled={isSavingSettings}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white disabled:opacity-50 cursor-pointer"
          >
            Save
          </button>
        </form>
      </section>

      {/* 2. Stages Manager */}
      <section className="space-y-4 pb-6 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Project Stages
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Customize workflow stages grouped by category. Reorder within category or rename.
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {(['planned', 'active', 'review', 'delivered', 'closed'] as const).map((cat) => {
            const catStages = groupedStages[cat]
            return (
              <div
                key={cat}
                className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm"
              >
                <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center justify-between">
                  <span>{CATEGORY_LABELS[cat]}</span>
                  <button
                    type="button"
                    onClick={() => handleAddStage(cat)}
                    className="text-blue-600 hover:text-blue-500 flex items-center gap-1 font-medium text-[11px]"
                  >
                    <Plus size={12} />
                    <span>Add stage</span>
                  </button>
                </div>

                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {catStages.map((stage) => {
                    const flatIdx = stages.findIndex((s) => s.id === stage.id)
                    const isSelected = flatIdx === selectedIndexSafe(selectedStageIndex, stages.length)
                    const isEditing = editingStageId === stage.id

                    return (
                      <div
                        key={stage.id}
                        onClick={() => setSelectedStageIndex(flatIdx)}
                        className={`px-4 py-2 flex items-center justify-between text-xs transition-colors ${
                          isSelected
                            ? 'bg-blue-50/70 dark:bg-blue-950/40 ring-1 ring-inset ring-blue-500/50'
                            : 'hover:bg-slate-50 dark:hover:bg-slate-800/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          {/* Color picker */}
                          <div className="relative">
                            <span
                              className={`w-3 h-3 rounded-full inline-block bg-${stage.color}-500`}
                              style={{ backgroundColor: stage.color }}
                            />
                          </div>

                          {/* Name / Inline editor */}
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={stageNameDraft}
                              onChange={(e) => setStageNameDraft(e.target.value)}
                              onBlur={handleSaveStageName}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveStageName()
                                if (e.key === 'Escape') setEditingStageId(null)
                              }}
                              className="px-2 py-0.5 rounded border border-blue-500 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => {
                                setEditingStageId(stage.id)
                                setStageNameDraft(stage.name)
                              }}
                              className="font-medium text-slate-800 dark:text-slate-200 cursor-pointer"
                            >
                              {stage.name}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditingStageId(stage.id)
                              setStageNameDraft(stage.name)
                            }}
                            className="p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                            title="Rename stage (↵)"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStage(stage)}
                            className="p-1 text-slate-400 hover:text-rose-500"
                            title="Delete stage"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* 3. Templates Manager */}
      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Project Templates
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Pre-defined milestones and task structures for fast project creation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingTemplate(null)
              setIsTemplateEditorOpen(true)
            }}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus size={14} />
            <span>New Template</span>
          </button>
        </div>

        <div className="border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 shadow-sm divide-y divide-slate-100 dark:divide-slate-800">
          {templates.map((tpl) => (
            <div
              key={tpl.id}
              className="p-4 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/40 text-xs transition-colors"
            >
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-slate-900 dark:text-slate-100">
                    {tpl.name}
                  </span>
                  {tpl.isBuiltin && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-500">
                      <Lock size={10} />
                      <span>Built-in</span>
                    </span>
                  )}
                  <span className="text-[11px] text-slate-400 uppercase tracking-wider">
                    {tpl.billingType} · {tpl.paymentSchedule}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {tpl.milestones.length} milestone{tpl.milestones.length === 1 ? '' : 's'} ·{' '}
                  {tpl.tasks.length} task{tpl.tasks.length === 1 ? '' : 's'}
                  {tpl.durationDays ? ` · ${tpl.durationDays} days duration` : ''}
                </p>
              </div>

              <div className="flex items-center gap-2">
                {tpl.isBuiltin ? (
                  <button
                    type="button"
                    onClick={() => handleDuplicateTemplate(tpl.id)}
                    className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Duplicate to edit</span>
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTemplate(tpl)
                        setIsTemplateEditorOpen(true)
                      }}
                      className="px-2.5 py-1 text-xs font-medium rounded border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 flex items-center gap-1.5 cursor-pointer"
                    >
                      <Edit2 size={12} />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteTemplate(tpl)}
                      className="p-1 text-slate-400 hover:text-rose-500"
                      title="Delete template"
                    >
                      <Trash2 size={14} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Delete Stage Fallback Modal (STAGE_IN_USE) */}
      {deletingStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Stage In Use: {deletingStage.name}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Projects currently in this stage must be moved before deleting. Select a destination stage:
            </p>

            <div>
              <select
                value={fallbackStageId}
                onChange={(e) => setFallbackStageId(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100"
              >
                {stages
                  .filter((s) => s.id !== deletingStage.id)
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({CATEGORY_LABELS[s.category]})
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingStage(null)}
                className="px-3 py-1 text-xs text-slate-500 hover:text-slate-800"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteStage(deletingStage, fallbackStageId)}
                className="px-3 py-1 rounded bg-rose-600 text-white text-xs font-medium hover:bg-rose-500"
              >
                Move Projects & Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Template Editor Modal */}
      {isTemplateEditorOpen && (
        <TemplateEditor
          template={editingTemplate}
          isOpen={isTemplateEditorOpen}
          onClose={() => setIsTemplateEditorOpen(false)}
          onSaved={loadConfig}
          showToast={showToast}
        />
      )}
    </div>
  )
}

function selectedIndexSafe(idx: number, len: number) {
  if (len === 0) return 0
  return Math.max(0, Math.min(len - 1, idx))
}
