'use client'

import React, { useState, useEffect } from 'react'
import { X, Trash2 } from 'lucide-react'
import { CalendarEvent } from './types'

interface EventModalProps {
  isOpen: boolean
  onClose: () => void
  onSaveEvent?: (event: Partial<CalendarEvent>) => void
  onDeleteEvent?: (eventId: string) => void
  selectedEvent?: CalendarEvent | null
  defaultDayIndex?: number
  defaultStartHour?: number
}

// Generate time options from 08:00 to 18:00 in 30-min intervals
const TIME_OPTIONS: Array<{ value: number; label: string }> = []
for (let h = 8; h <= 18; h++) {
  TIME_OPTIONS.push({
    value: h,
    label: `${String(h).padStart(2, '0')}:00`,
  })
  if (h < 18) {
    TIME_OPTIONS.push({
      value: h + 0.5,
      label: `${String(h).padStart(2, '0')}:30`,
    })
  }
}

export function EventModal({
  isOpen,
  onClose,
  onSaveEvent,
  onDeleteEvent,
  selectedEvent,
  defaultDayIndex = 1,
  defaultStartHour = 10,
}: EventModalProps) {
  const isEditing = !!selectedEvent

  const [name, setName] = useState('')
  const [dayIndex, setDayIndex] = useState(defaultDayIndex)
  const [startHour, setStartHour] = useState(defaultStartHour)
  const [endHour, setEndHour] = useState(defaultStartHour + 1.0)
  const [description, setDescription] = useState('')

  // Initialize form state
  useEffect(() => {
    if (selectedEvent) {
      const sHour = selectedEvent.startHour ?? 10
      const dHours = selectedEvent.durationHours ?? 1.0
      setName(selectedEvent.title || '')
      setDayIndex(selectedEvent.dayIndex ?? 1)
      setStartHour(sHour)
      setEndHour(sHour + dHours)
      setDescription(selectedEvent.description || selectedEvent.subtitle || '')
    } else {
      setName('')
      setDayIndex(defaultDayIndex)
      setStartHour(defaultStartHour)
      setEndHour(defaultStartHour + 1.0)
      setDescription('')
    }
  }, [selectedEvent, defaultDayIndex, defaultStartHour])

  if (!isOpen) return null

  const handleStartHourChange = (newStart: number) => {
    setStartHour(newStart)
    if (endHour <= newStart) {
      setEndHour(newStart + 1.0)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !onSaveEvent) return

    const duration = Math.max(0.5, endHour - startHour)

    const startH = Math.floor(startHour)
    const startM = Math.round((startHour - startH) * 60)
    const endH = Math.floor(endHour)
    const endM = Math.round((endHour - endH) * 60)

    const formatHour = (h: number, m: number) => {
      const displayH = String(h).padStart(2, '0')
      const displayM = String(m).padStart(2, '0')
      return `${displayH}:${displayM}`
    }

    const startTimeLabel = formatHour(startH, startM)
    const endTimeLabel = formatHour(endH, endM)

    onSaveEvent({
      id: selectedEvent?.id || `ev-${Date.now()}`,
      title: name.trim(),
      description: description.trim() || undefined,
      subtitle: description.trim() || undefined,
      dayIndex,
      dateString: `2026-09-${21 + dayIndex}`,
      startHour,
      durationHours: duration,
      startTimeLabel,
      endTimeLabel,
      category: selectedEvent?.category || 'meeting',
      colorTheme: 'blue',
      attendees: selectedEvent?.attendees || [],
    })
    onClose()
  }

  const availableEndHours = TIME_OPTIONS.filter((time) => time.value > startHour)

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="composer" onClick={(e) => e.stopPropagation()} style={{ width: 'min(100%, 450px)', borderRadius: '12px' }}>
        {/* Header */}
        <div className="composer-top">
          <div>
            <p className="section-kicker">Workspace schedule</p>
            <h2>{isEditing ? 'Edit event' : 'Add event'}</h2>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>

        {/* Clean minimal form: Name, Date, From & To, Description */}
        <form onSubmit={handleSubmit}>
          {/* 1. Name */}
          <label>
            Name
            <input
              required
              autoFocus
              placeholder="e.g. Follow up on quote"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>

          {/* 2. Date */}
          <label>
            Date
            <select value={dayIndex} onChange={(e) => setDayIndex(Number(e.target.value))}>
              <option value={0}>Mon 21 Sep</option>
              <option value={1}>Tue 22 Sep (Today)</option>
              <option value={2}>Wed 23 Sep</option>
              <option value={3}>Thu 24 Sep</option>
              <option value={4}>Fri 25 Sep</option>
            </select>
          </label>

          {/* 3. From & To Time Pickers */}
          <div className="composer-grid">
            <label>
              From
              <select value={startHour} onChange={(e) => handleStartHourChange(Number(e.target.value))}>
                {TIME_OPTIONS.filter((time) => time.value < 18).map((time) => (
                  <option key={`from-${time.value}`} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              To
              <select value={endHour} onChange={(e) => setEndHour(Number(e.target.value))}>
                {availableEndHours.map((time) => (
                  <option key={`to-${time.value}`} value={time.value}>
                    {time.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {/* 4. Description */}
          <label>
            Description
            <textarea
              rows={3}
              placeholder="Add details, notes, or agenda..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{
                display: 'block',
                width: '100%',
                marginTop: '7px',
                padding: '9px 12px',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                outline: 0,
                color: '#1c1d1f',
                fontSize: '13px',
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />
          </label>

          {/* Action Footer */}
          <div
            style={{
              display: 'flex',
              justifyContent: isEditing ? 'space-between' : 'flex-end',
              alignItems: 'center',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #f0f1f3',
            }}
          >
            {isEditing && onDeleteEvent ? (
              <button
                type="button"
                onClick={() => {
                  onDeleteEvent(selectedEvent.id)
                  onClose()
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  border: 0,
                  background: 'transparent',
                  color: '#dc2626',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  padding: '6px 8px',
                }}
              >
                <Trash2 size={14} /> Delete
              </button>
            ) : null}

            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="button" className="select-button" onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className="primary-button"
                style={{ minHeight: '36px', padding: '0 16px' }}
                disabled={!name.trim()}
              >
                {isEditing ? 'Save changes' : 'Add event'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  )
}
