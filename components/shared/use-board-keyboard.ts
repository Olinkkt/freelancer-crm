'use client'

import { useState, useCallback, useMemo } from 'react'
import { useShortcut } from '@/components/shortcuts/shortcut-provider'

export interface BoardColumn<T> {
  id: string
  name: string
  items: T[]
}

export interface UseBoardKeyboardOptions<T> {
  columns: BoardColumn<T>[]
  selectedColumnId: string | null
  selectedItemId: string | null
  getItemId: (item: T) => string
  onSelectColumn: (columnId: string) => void
  onSelectItem: (itemId: string | null) => void
  onOpenItem?: (item: T) => void
  onMovePrevStage?: (item: T) => void
  onMoveNextStage?: (item: T) => void
  onFocusFilter?: () => void
  enabled?: boolean
}

export function useBoardKeyboard<T>({
  columns,
  selectedColumnId,
  selectedItemId,
  getItemId,
  onSelectColumn,
  onSelectItem,
  onOpenItem,
  onMovePrevStage,
  onMoveNextStage,
  onFocusFilter,
  enabled = true,
}: UseBoardKeyboardOptions<T>) {
  const currentColumnIndex = useMemo(() => {
    return columns.findIndex((c) => c.id === selectedColumnId)
  }, [columns, selectedColumnId])

  const currentColumn = useMemo(() => {
    if (currentColumnIndex >= 0 && currentColumnIndex < columns.length) {
      return columns[currentColumnIndex]
    }
    return columns[0] || null
  }, [columns, currentColumnIndex])

  const selectedItem = useMemo(() => {
    if (!currentColumn || !selectedItemId) return null
    return currentColumn.items.find((item) => getItemId(item) === selectedItemId) || null
  }, [currentColumn, selectedItemId, getItemId])

  // Move column left
  const moveLeft = useCallback(() => {
    if (columns.length === 0) return
    const idx = currentColumnIndex <= 0 ? columns.length - 1 : currentColumnIndex - 1
    const nextCol = columns[idx]
    onSelectColumn(nextCol.id)
    onSelectItem(nextCol.items.length > 0 ? getItemId(nextCol.items[0]) : null)
  }, [columns, currentColumnIndex, onSelectColumn, onSelectItem, getItemId])

  // Move column right
  const moveRight = useCallback(() => {
    if (columns.length === 0) return
    const idx = currentColumnIndex >= columns.length - 1 ? 0 : currentColumnIndex + 1
    const nextCol = columns[idx]
    onSelectColumn(nextCol.id)
    onSelectItem(nextCol.items.length > 0 ? getItemId(nextCol.items[0]) : null)
  }, [columns, currentColumnIndex, onSelectColumn, onSelectItem, getItemId])

  // Move card up
  const moveUp = useCallback(() => {
    if (!currentColumn || currentColumn.items.length === 0) return
    const itemIndex = currentColumn.items.findIndex((item) => getItemId(item) === selectedItemId)
    if (itemIndex <= 0) {
      onSelectItem(getItemId(currentColumn.items[currentColumn.items.length - 1]))
    } else {
      onSelectItem(getItemId(currentColumn.items[itemIndex - 1]))
    }
  }, [currentColumn, selectedItemId, onSelectItem, getItemId])

  // Move card down
  const moveDown = useCallback(() => {
    if (!currentColumn || currentColumn.items.length === 0) return
    const itemIndex = currentColumn.items.findIndex((item) => getItemId(item) === selectedItemId)
    if (itemIndex === -1 || itemIndex >= currentColumn.items.length - 1) {
      onSelectItem(getItemId(currentColumn.items[0]))
    } else {
      onSelectItem(getItemId(currentColumn.items[itemIndex + 1]))
    }
  }, [currentColumn, selectedItemId, onSelectItem, getItemId])

  useShortcut('board.left', moveLeft, { enabled })
  useShortcut('board.right', moveRight, { enabled })
  useShortcut('board.up', moveUp, { enabled })
  useShortcut('board.down', moveDown, { enabled })

  useShortcut(
    'board.open',
    () => {
      if (selectedItem && onOpenItem) {
        onOpenItem(selectedItem)
      }
    },
    { enabled: enabled && !!selectedItem }
  )

  useShortcut(
    'board.stagePrev',
    () => {
      if (selectedItem && onMovePrevStage) {
        onMovePrevStage(selectedItem)
      }
    },
    { enabled: enabled && !!selectedItem }
  )

  useShortcut(
    'board.stageNext',
    () => {
      if (selectedItem && onMoveNextStage) {
        onMoveNextStage(selectedItem)
      }
    },
    { enabled: enabled && !!selectedItem }
  )

  useShortcut(
    'board.filter',
    () => {
      onFocusFilter?.()
    },
    { enabled }
  )

  return {
    currentColumn,
    selectedItem,
    moveLeft,
    moveRight,
    moveUp,
    moveDown,
  }
}
