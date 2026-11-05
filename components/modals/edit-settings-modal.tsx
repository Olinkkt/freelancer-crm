'use client'

import React, { useState, useEffect } from 'react'
import {
  X,
  User,
  Mail,
  DollarSign,
  Lock,
  AlertCircle,
  Loader2,
  Save,
  Globe,
  Calendar,
  RefreshCw,
  Unlink,
  ExternalLink,
  Check,
  Sparkles,
  CheckCircle2,
  ChevronRight,
  Copy,
  Rss,
  CalendarPlus,
} from 'lucide-react'
import { updateWorkspaceSettingsAction } from '@/app/actions/auth'
import {
  getCalendarFeedInfoAction,
  regenerateCalendarFeedTokenAction,
  CalendarFeedInfo,
} from '@/app/actions/calendar-feed'
import { WorkspaceSettings } from '@/lib/crm-types'

interface EditSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: WorkspaceSettings
  onSettingsUpdated: (updated: WorkspaceSettings) => void
  initialTab?: 'profile' | 'calendar'
  onToast?: (message: string, shortcut?: string, type?: 'success' | 'warning' | 'info') => void
}

const CURRENCIES = [
  { code: 'USD', symbol: '$', label: 'USD ($) — United States Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) — Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) — British Pound', locale: 'en-GB' },
  { code: 'CZK', symbol: 'Kč', label: 'CZK (Kč) — Czech Koruna', locale: 'cs-CZ' },
  { code: 'CAD', symbol: '$', label: 'CAD ($) — Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: '$', label: 'AUD ($) — Australian Dollar', locale: 'en-AU' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF — Swiss Franc', locale: 'de-CH' },
]

const LOCALES = [
  { code: 'en-US', label: 'en-US — English (United States)' },
  { code: 'en-GB', label: 'en-GB — English (United Kingdom)' },
  { code: 'cs-CZ', label: 'cs-CZ — Čeština (Česká republika)' },
  { code: 'sk-SK', label: 'sk-SK — Slovenčina (Slovensko)' },
  { code: 'de-DE', label: 'de-DE — Deutsch (Deutschland)' },
  { code: 'de-CH', label: 'de-CH — Deutsch (Schweiz)' },
  { code: 'fr-FR', label: 'fr-FR — Français (France)' },
  { code: 'es-ES', label: 'es-ES — Español (España)' },
  { code: 'pl-PL', label: 'pl-PL — Polski (Polska)' },
]

export function EditSettingsModal({
  isOpen,
  onClose,
  currentSettings,
  onSettingsUpdated,
  initialTab = 'profile',
  onToast,
}: EditSettingsModalProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<'profile' | 'calendar'>(initialTab)

  // Profile Form state
  const [name, setName] = useState(currentSettings.operatorName)
  const [email, setEmail] = useState(currentSettings.operatorEmail)
  const [role, setRole] = useState(currentSettings.operatorRole)
  const initialCurrency =
    CURRENCIES.find((c) => c.code === currentSettings.currency) || CURRENCIES[0]
  const [currency, setCurrency] = useState(initialCurrency)
  const [locale, setLocale] = useState(currentSettings.locale || initialCurrency.locale || 'en-US')
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Calendar Subscription Feed (.ics) state
  const [feedInfo, setFeedInfo] = useState<CalendarFeedInfo | null>(null)
  const [feedCopied, setFeedCopied] = useState(false)
  const [rotatingFeed, setRotatingFeed] = useState(false)
  const [feedError, setFeedError] = useState<string | null>(null)

  const fetchCalendarFeedInfo = async () => {
    try {
      const info = await getCalendarFeedInfoAction()
      setFeedInfo(info)
    } catch (err: any) {
      console.error('Failed to load calendar feed info:', err)
    }
  }

  const handleCopyFeed = async () => {
    if (!feedInfo?.feedUrl) return
    try {
      await navigator.clipboard.writeText(feedInfo.feedUrl)
      setFeedCopied(true)
      setTimeout(() => setFeedCopied(false), 2000)
      onToast?.('Calendar feed URL copied to clipboard!', undefined, 'success')
    } catch {
      // Fallback
    }
  }

  const handleRotateFeedToken = async () => {
    if (
      !confirm(
        'Rotate calendar feed secret? Any calendars previously subscribed to the old URL will stop syncing until updated.'
      )
    ) {
      return
    }

    setRotatingFeed(true)
    try {
      const updated = await regenerateCalendarFeedTokenAction()
      setFeedInfo(updated)
      onToast?.('Calendar feed secret rotated successfully', undefined, 'success')
    } catch (err: any) {
      const msg = err?.message || 'Failed to rotate feed secret'
      setFeedError(msg)
      onToast?.(msg, undefined, 'warning')
    } finally {
      setRotatingFeed(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      setName(currentSettings.operatorName || '')
      setEmail(currentSettings.operatorEmail || '')
      setRole(currentSettings.operatorRole || '')
      const found =
        CURRENCIES.find((c) => c.code === currentSettings.currency) || CURRENCIES[0]
      setCurrency(found)
      setLocale(currentSettings.locale || found.locale || 'en-US')
      setNewPasscode('')
      setConfirmPasscode('')
      setError(null)
      setFeedError(null)
      setActiveTab(initialTab)
      fetchCalendarFeedInfo()
    }
  }, [isOpen, currentSettings, initialTab])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Profile submit
  const handleSubmitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Name and Email are required.')
      return
    }

    if (newPasscode.trim() && newPasscode !== confirmPasscode) {
      setError('Passcodes do not match.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await updateWorkspaceSettingsAction({
        operatorName: name.trim(),
        operatorEmail: email.trim(),
        operatorRole: role.trim(),
        currency: currency.code,
        currencySymbol: currency.symbol,
        locale: locale.trim(),
        newPasscode: newPasscode.trim() || undefined,
      })

      if (res.success && res.settings) {
        onSettingsUpdated(res.settings)
        onToast?.('Settings updated successfully', undefined, 'success')
        onClose()
      } else {
        setError(res.error || 'Failed to update settings')
      }
    } catch (err: any) {
      setError(err?.message || 'Update error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-white rounded-[14px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-5 border-b border-[#edf0f3] flex items-center justify-between bg-[#fafbfc]">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f99a8] block">
              Preferences
            </span>
            <h2 className="text-[15px] font-semibold text-[#1c1d1f]">
              Workspace Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors cursor-pointer"
          >
            <X size={16} />
          </button>
        </div>

        {/* TABS HEADER */}
        <div className="flex border-b border-[#edf0f3] px-6 bg-[#fafbfc] gap-4">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'border-[#266df0] text-[#1c1d1f]'
                : 'border-transparent text-[#6f7988] hover:text-[#1c1d1f]'
            }`}
          >
            <User size={13} />
            <span>General & Profile</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('calendar')}
            className={`py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'calendar'
                ? 'border-[#266df0] text-[#1c1d1f]'
                : 'border-transparent text-[#6f7988] hover:text-[#1c1d1f]'
            }`}
          >
            <Rss size={13} />
            <span>Calendar feed</span>
          </button>
        </div>

        {/* TAB CONTENT: PROFILE */}
        {activeTab === 'profile' && (
          <form onSubmit={handleSubmitProfile} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#fff1f0] border border-[#ffccc7] text-[#cf1322] text-[12px]">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Operator Full Name *
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f99a8]" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Work Email *
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#8f99a8]" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full h-10 pl-8 pr-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Role / Title
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                Currency *
              </label>
              <select
                value={currency.code}
                onChange={(e) => {
                  const found = CURRENCIES.find((c) => c.code === e.target.value)
                  if (found) {
                    setCurrency(found)
                    setLocale(found.locale)
                  }
                }}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 cursor-pointer"
              >
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5 flex items-center gap-1.5">
                <Globe size={13} className="text-[#6f7988]" />
                Locale (date & number format) *
              </label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value)}
                className="w-full h-10 px-3 border border-[#e4e7ec] rounded-[10px] text-[13px] text-[#1c1d1f] bg-white focus:outline-none focus:border-[#266df0] focus:ring-2 focus:ring-[#266df0]/15 cursor-pointer"
              >
                {LOCALES.map((l) => (
                  <option key={l.code} value={l.code}>
                    {l.label}
                  </option>
                ))}
              </select>
              <span className="block text-[11px] text-[#8f99a8] mt-1">
                Controls how dates and thousands separators are formatted.
              </span>
            </div>

            <div className="pt-2 border-t border-[#f0f1f3]">
              <div className="mb-2">
                <span className="block text-[11px] font-bold uppercase tracking-wider text-[#505967]">
                  Update Passcode (Optional)
                </span>
                <span className="text-[11px] text-[#8f99a8]">
                  Leave blank to keep current master passcode.
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="password"
                  value={newPasscode}
                  onChange={(e) => setNewPasscode(e.target.value)}
                  placeholder="New passcode"
                  className="w-full h-9 px-3 border border-[#e4e7ec] rounded-[8px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
                />
                <input
                  type="password"
                  value={confirmPasscode}
                  onChange={(e) => setConfirmPasscode(e.target.value)}
                  placeholder="Confirm"
                  className="w-full h-9 px-3 border border-[#e4e7ec] rounded-[8px] text-[12px] text-[#1c1d1f] focus:outline-none focus:border-[#266df0]"
                />
              </div>
            </div>

            {/* Quick link to the calendar feed */}
            <div className="pt-2 border-t border-[#f0f1f3]">
              <div className="p-3 rounded-[10px] bg-[#fafbfc] border border-[#e4e7ec] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[7px] bg-[#f0f4fe] border border-[#d6e4fd] flex items-center justify-center text-[#266df0]">
                    <Rss size={14} />
                  </div>
                  <div>
                    <span className="text-[12px] font-semibold text-[#1c1d1f] block">
                      Calendar feed (.ics)
                    </span>
                    <span className="text-[11px] text-[#6f7988] block">
                      Deal next actions in any calendar app
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('calendar')}
                  className="text-[11px] font-semibold text-[#266df0] hover:text-[#1853bf] flex items-center gap-1 cursor-pointer"
                >
                  <span>Manage</span>
                  <ChevronRight size={13} />
                </button>
              </div>
            </div>

            <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0f1f3]">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-2 text-[12px] font-medium text-[#505967] hover:text-[#1c1d1f] rounded-[8px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-semibold rounded-[9px] shadow-xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loading ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Save size={13} />
                )}
                <span>Save Preferences</span>
              </button>
            </div>
          </form>
        )}

        {/* TAB CONTENT: CALENDAR FEED */}
        {activeTab === 'calendar' && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {feedError && (
              <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#fff1f0] border border-[#ffccc7] text-[#cf1322] text-[12px]">
                <AlertCircle size={14} className="shrink-0" />
                <span>{feedError}</span>
              </div>
            )}

            {/* 1. UNIVERSAL ICAL / GOOGLE CALENDAR SUBSCRIPTION FEED (RECOMMENDED ZERO-CONFIG) */}
            <div className="bg-white border-2 border-[#b2ccff] rounded-xl p-5 shadow-[rgba(38,109,240,0.06)_0px_4px_12px_-2px] relative overflow-hidden">

              {/* Card Header */}
              <div className="flex items-start gap-3 pb-4 border-b border-[#f0f1f3]">
                <div className="w-10 h-10 rounded-[10px] bg-[#eef4ff] border border-[#d0e0fd] flex items-center justify-center text-[#266df0] shrink-0">
                  <Rss size={20} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#1c1d1f]">
                      Calendar Subscription Feed (.ics)
                    </h3>
                  </div>
                  <p className="text-[12px] text-[#6f7988] mt-0.5">
                    A read-only feed of your deals’ next actions and logged calls and meetings. Subscribe once in Google Calendar, Apple Calendar or your phone; it refreshes on its own.
                  </p>
                </div>
              </div>

              {/* Feed URL input & Actions */}
              <div className="pt-4 space-y-3.5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#505967] mb-1.5">
                    Private Calendar Feed URL
                  </label>
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        readOnly
                        value={feedInfo?.feedUrl || 'Generating feed URL...'}
                        className="w-full h-9.5 px-3 bg-[#fafbfc] border border-[#e4e7ec] rounded-[9px] text-[12px] font-mono text-[#1c1d1f] focus:outline-none select-all"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleCopyFeed}
                      disabled={!feedInfo?.feedUrl}
                      className="h-9.5 px-3.5 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-semibold rounded-[9px] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      {feedCopied ? <Check size={13} className="text-[#55b467]" /> : <Copy size={13} />}
                      <span>{feedCopied ? 'Copied!' : 'Copy Feed URL'}</span>
                    </button>
                  </div>
                </div>

                {/* 1-Click Subscribe Buttons */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <a
                    href={feedInfo?.googleCalendarUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-[9px] bg-[#f0f4fe] hover:bg-[#e4edfd] border border-[#d2e3fc] text-[#1a73e8] text-[12px] font-semibold transition-colors text-center"
                  >
                    <Calendar size={14} />
                    <span>Subscribe in Google Calendar</span>
                    <ExternalLink size={12} className="opacity-70" />
                  </a>

                  <a
                    href={feedInfo?.webcalUrl || '#'}
                    className="flex items-center justify-center gap-2 py-2 px-3 rounded-[9px] bg-[#fafbfc] hover:bg-[#f2f4f7] border border-[#e4e7ec] text-[#344054] text-[12px] font-semibold transition-colors text-center"
                  >
                    <CalendarPlus size={14} className="text-[#667085]" />
                    <span>Subscribe in Apple / Desktop</span>
                  </a>
                </div>

                {/* Footer notes & Rotate secret */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#f0f1f3] text-[11px] text-[#8f99a8]">
                  <span>
                    Calendar apps refresh subscribed feeds every few hours.
                  </span>
                  <button
                    type="button"
                    onClick={handleRotateFeedToken}
                    disabled={rotatingFeed}
                    className="text-[#6f7988] hover:text-[#cf1322] flex items-center gap-1 transition-colors self-start sm:self-auto cursor-pointer"
                    title="Rotate the secret token in the URL if needed"
                  >
                    <RefreshCw size={11} className={rotatingFeed ? 'animate-spin' : ''} />
                    <span>Rotate Secret Key</span>
                  </button>
                </div>
              </div>
            </div>

            <p className="text-[12px] text-[#6f7988] leading-relaxed">
              Need a single event instead? Each deal page has an <span className="font-semibold text-[#1c1d1f]">Add to Google Calendar</span> link for its next action.
            </p>

            {/* MODAL FOOTER */}
            <div className="pt-2 flex items-center justify-end border-t border-[#f0f1f3]">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-[#f4f5f6] hover:bg-[#e4e7ec] text-[#1c1d1f] text-[12px] font-semibold rounded-[8px] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
