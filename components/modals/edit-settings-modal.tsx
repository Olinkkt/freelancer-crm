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
  KeyRound,
  Copy,
  Rss,
  CalendarPlus,
} from 'lucide-react'
import { updateWorkspaceSettingsAction } from '@/app/actions/auth'
import {
  getGoogleCalendarStatusAction,
  disconnectGoogleCalendarAction,
  triggerGoogleCalendarSyncAction,
  updateGoogleCalendarSettingsAction,
} from '@/app/actions/google-calendar'
import {
  getCalendarFeedInfoAction,
  regenerateCalendarFeedTokenAction,
  CalendarFeedInfo,
} from '@/app/actions/calendar-feed'
import { WorkspaceSettings } from '@/lib/crm-types'
import { GoogleCalendarStatusResponse } from '@/lib/google-calendar/types'

interface EditSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: WorkspaceSettings
  onSettingsUpdated: (updated: WorkspaceSettings) => void
  initialTab?: 'profile' | 'integrations'
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
  const [activeTab, setActiveTab] = useState<'profile' | 'integrations'>(initialTab)

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

  // Google Calendar Integration state
  const [gcalStatus, setGcalStatus] = useState<GoogleCalendarStatusResponse | null>(null)
  const [loadingGcal, setLoadingGcal] = useState(false)
  const [connecting, setConnecting] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [togglingAutoSync, setTogglingAutoSync] = useState(false)
  const [gcalError, setGcalError] = useState<string | null>(null)
  const [gcalSuccess, setGcalSuccess] = useState<string | null>(null)

  // Calendar Subscription Feed (.ics) state
  const [feedInfo, setFeedInfo] = useState<CalendarFeedInfo | null>(null)
  const [loadingFeed, setLoadingFeed] = useState(false)
  const [feedCopied, setFeedCopied] = useState(false)
  const [rotatingFeed, setRotatingFeed] = useState(false)

  const fetchGcalStatus = async () => {
    setLoadingGcal(true)
    try {
      const status = await getGoogleCalendarStatusAction()
      setGcalStatus(status)
    } catch (err: any) {
      console.error('Failed to load Google Calendar status:', err)
    } finally {
      setLoadingGcal(false)
    }
  }

  const fetchCalendarFeedInfo = async () => {
    setLoadingFeed(true)
    try {
      const info = await getCalendarFeedInfoAction()
      setFeedInfo(info)
    } catch (err: any) {
      console.error('Failed to load calendar feed info:', err)
    } finally {
      setLoadingFeed(false)
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
      setGcalError(msg)
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
      setGcalError(null)
      setGcalSuccess(null)
      setActiveTab(initialTab)
      fetchGcalStatus()
      fetchCalendarFeedInfo()
    }
  }, [isOpen, currentSettings, initialTab])

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

  // Google Calendar: Connect
  const handleConnectGcal = async () => {
    setConnecting(true)
    setGcalError(null)
    setGcalSuccess(null)
    try {
      const res = await fetch('/api/integrations/google-calendar/auth-url')
      const data = await res.json()
      if (!res.ok || !data.url) {
        throw new Error(data.error || 'Failed to obtain Google OAuth authorization URL')
      }
      window.location.href = data.url
    } catch (err: any) {
      const msg = err?.message || 'Failed to initiate Google Calendar connection'
      setGcalError(msg)
      onToast?.(msg, undefined, 'warning')
      setConnecting(false)
    }
  }

  // Google Calendar: Disconnect
  const handleDisconnectGcal = async () => {
    if (!window.confirm('Disconnect Google Calendar? Scheduled events will no longer automatically sync.')) {
      return
    }
    setDisconnecting(true)
    setGcalError(null)
    setGcalSuccess(null)
    try {
      await disconnectGoogleCalendarAction()
      await fetchGcalStatus()
      const msg = 'Google Calendar disconnected successfully'
      setGcalSuccess(msg)
      onToast?.(msg, undefined, 'info')
    } catch (err: any) {
      const msg = err?.message || 'Failed to disconnect Google Calendar'
      setGcalError(msg)
      onToast?.(msg, undefined, 'warning')
    } finally {
      setDisconnecting(false)
    }
  }

  // Google Calendar: Sync Now
  const handleSyncNow = async () => {
    setSyncing(true)
    setGcalError(null)
    setGcalSuccess(null)
    try {
      const result = await triggerGoogleCalendarSyncAction()
      if (!result.success) {
        throw new Error(result.error || 'Failed to sync with Google Calendar')
      }
      await fetchGcalStatus()
      const msg = `Synced ${result.syncedCount} item${result.syncedCount === 1 ? '' : 's'} to Google Calendar`
      setGcalSuccess(msg)
      onToast?.(msg, undefined, 'success')
    } catch (err: any) {
      const msg = err?.message || 'Sync failed'
      setGcalError(msg)
      onToast?.(msg, undefined, 'warning')
    } finally {
      setSyncing(false)
    }
  }

  // Google Calendar: Toggle Auto-sync
  const handleToggleAutoSync = async () => {
    if (!gcalStatus?.connected || togglingAutoSync) return
    const nextAutoSync = !gcalStatus.autoSync
    setTogglingAutoSync(true)
    setGcalError(null)
    try {
      const updated = await updateGoogleCalendarSettingsAction({ autoSync: nextAutoSync })
      setGcalStatus(updated)
      const msg = `Auto-sync ${nextAutoSync ? 'enabled' : 'disabled'}`
      setGcalSuccess(msg)
      onToast?.(msg, undefined, 'success')
    } catch (err: any) {
      const msg = err?.message || 'Failed to update auto-sync setting'
      setGcalError(msg)
      onToast?.(msg, undefined, 'warning')
    } finally {
      setTogglingAutoSync(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/40 backdrop-blur-xs transition-all"
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
              Preferences & Integrations
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
            onClick={() => setActiveTab('integrations')}
            className={`py-2.5 text-[12px] font-semibold border-b-2 -mb-px transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'integrations'
                ? 'border-[#266df0] text-[#1c1d1f]'
                : 'border-transparent text-[#6f7988] hover:text-[#1c1d1f]'
            }`}
          >
            <Calendar size={13} />
            <span>Integrations</span>
            {gcalStatus?.connected ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#12b76a]" />
            ) : gcalStatus && !gcalStatus.configured ? (
              <span className="w-1.5 h-1.5 rounded-full bg-[#f79009]" />
            ) : null}
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

            {/* Quick Link to Integrations */}
            <div className="pt-2 border-t border-[#f0f1f3]">
              <div className="p-3 rounded-[10px] bg-[#fafbfc] border border-[#e4e7ec] flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-[7px] bg-[#f0f4fe] border border-[#d6e4fd] flex items-center justify-center text-[#266df0]">
                    <Calendar size={14} />
                  </div>
                  <div>
                    <span className="text-[12px] font-semibold text-[#1c1d1f] block">
                      Google Calendar Integration
                    </span>
                    <span className="text-[11px] text-[#6f7988] block">
                      {gcalStatus?.connected
                        ? `Connected (${gcalStatus.calendarName || 'primary'})`
                        : gcalStatus?.configured
                        ? 'Ready to connect'
                        : '1-click web links active'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('integrations')}
                  className="text-[11px] font-semibold text-[#266df0] hover:text-[#1853bf] flex items-center gap-1 cursor-pointer"
                >
                  <span>Configure</span>
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

        {/* TAB CONTENT: INTEGRATIONS */}
        {activeTab === 'integrations' && (
          <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
            {/* Feedback messages */}
            {gcalError && (
              <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#fff1f0] border border-[#ffccc7] text-[#cf1322] text-[12px]">
                <AlertCircle size={14} className="shrink-0" />
                <span>{gcalError}</span>
              </div>
            )}
            {gcalSuccess && (
              <div className="flex items-center gap-2 p-3 rounded-[8px] bg-[#ecfdf3] border border-[#d1fadf] text-[#027a48] text-[12px]">
                <CheckCircle2 size={14} className="shrink-0" />
                <span>{gcalSuccess}</span>
              </div>
            )}

            {/* 1. UNIVERSAL ICAL / GOOGLE CALENDAR SUBSCRIPTION FEED (RECOMMENDED ZERO-CONFIG) */}
            <div className="bg-white border-2 border-[#b2ccff] rounded-xl p-5 shadow-[rgba(38,109,240,0.06)_0px_4px_12px_-2px] relative overflow-hidden">
              <div className="absolute top-0 right-0 bg-[#e9f0ff] border-b border-l border-[#c4dafe] text-[#266df0] text-[10px] font-bold px-2.5 py-0.5 rounded-bl-[8px] uppercase tracking-wider">
                Recommended • Zero Config
              </div>

              {/* Card Header */}
              <div className="flex items-start gap-3 pb-4 border-b border-[#f0f1f3]">
                <div className="w-10 h-10 rounded-[10px] bg-[#eef4ff] border border-[#d0e0fd] flex items-center justify-center text-[#266df0] shrink-0">
                  <Rss size={20} />
                </div>
                <div className="min-w-0 pr-16">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-semibold text-[#1c1d1f]">
                      Calendar Subscription Feed (.ics)
                    </h3>
                  </div>
                  <p className="text-[12px] text-[#6f7988] mt-0.5">
                    Live feed of all upcoming deal milestones, calls, and meetings. Works out-of-the-box in Google Calendar, Apple Calendar, and phone calendars.
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
                    Zero setup required. Google Calendar automatically updates in background.
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

            {/* 2. GOOGLE CALENDAR OAUTH CARD (ADVANCED) */}
            <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.03)_0px_2px_4px_-1px]">
              {/* Card Header & Status Badge */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#f0f1f3]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-[10px] bg-[#f0f4fe] border border-[#d6e4fd] flex items-center justify-center text-[#266df0] shrink-0">
                    <Calendar size={20} />
                  </div>
                  <div>
                    <h3 className="text-[14px] font-semibold text-[#1c1d1f]">
                      Google Calendar API (Two-Way OAuth)
                    </h3>
                    <p className="text-[12px] text-[#6f7988]">
                      Advanced: Direct push sync into your primary Google Calendar (requires Google Cloud project)
                    </p>
                  </div>
                </div>

                {/* Connection Status Badges */}
                <div className="shrink-0">
                  {loadingGcal ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-[#6f7988] bg-[#f4f5f6] border border-[#e4e7ec] px-2.5 py-1 rounded-[7px]">
                      <Loader2 size={11} className="animate-spin text-[#8f99a8]" />
                      Checking...
                    </span>
                  ) : gcalStatus?.connected ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#027a48] bg-[#ecfdf3] border border-[#d1fadf] px-2.5 py-1 rounded-[7px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#12b76a] animate-pulse" />
                      Connected
                    </span>
                  ) : gcalStatus?.configured ? (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#505967] bg-[#f4f5f6] border border-[#e4e7ec] px-2.5 py-1 rounded-[7px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#9fa1a7]" />
                      Disconnected
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#b54708] bg-[#fffaeb] border border-[#fedf89] px-2.5 py-1 rounded-[7px]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#f79009]" />
                      Setup Needed / Missing API Keys
                    </span>
                  )}
                </div>
              </div>

              {/* Card Body depending on status */}
              <div className="pt-4 space-y-4">
                {gcalStatus?.connected ? (
                  <>
                    {/* Connection details */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[12px]">
                      <div className="p-3 rounded-[9px] bg-[#fafbfc] border border-[#e4e7ec]">
                        <span className="text-[#8f99a8] block text-[10.5px] uppercase font-bold tracking-wider mb-0.5">
                          Synced Calendar
                        </span>
                        <span className="font-semibold text-[#1c1d1f] truncate block">
                          {gcalStatus.calendarName || 'primary'}
                        </span>
                      </div>
                      <div className="p-3 rounded-[9px] bg-[#fafbfc] border border-[#e4e7ec]">
                        <span className="text-[#8f99a8] block text-[10.5px] uppercase font-bold tracking-wider mb-0.5">
                          Last Synchronized
                        </span>
                        <span className="font-medium text-[#1c1d1f] block">
                          {gcalStatus.lastSyncedAt
                            ? new Date(gcalStatus.lastSyncedAt).toLocaleString(undefined, {
                                dateStyle: 'medium',
                                timeStyle: 'short',
                              })
                            : 'Not yet synchronized'}
                        </span>
                      </div>
                    </div>

                    {/* Auto-sync Toggle */}
                    <div
                      onClick={handleToggleAutoSync}
                      className="flex items-center justify-between p-3.5 rounded-[10px] bg-[#fafbfc] border border-[#e4e7ec] cursor-pointer hover:bg-[#f5f7fa] transition-colors select-none"
                    >
                      <div className="pr-3">
                        <span className="text-[12px] font-semibold text-[#1c1d1f] block">
                          Auto-sync Activities
                        </span>
                        <span className="text-[11px] text-[#6f7988] block">
                          Automatically push scheduled calls, meetings, and follow-ups to Google Calendar as they are logged or modified.
                        </span>
                      </div>
                      <div className="shrink-0">
                        <button
                          type="button"
                          disabled={togglingAutoSync}
                          aria-label="Toggle Auto-sync"
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                            gcalStatus.autoSync ? 'bg-[#266df0]' : 'bg-[#d0d5dd]'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                              gcalStatus.autoSync ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </div>
                    </div>

                    {/* Action buttons: Sync Now + Disconnect */}
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                      <button
                        type="button"
                        onClick={handleSyncNow}
                        disabled={syncing}
                        className="px-3.5 py-2 bg-[#232529] hover:bg-[#101113] text-white text-[12px] font-semibold rounded-[8px] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
                        <span>{syncing ? 'Syncing...' : 'Sync Now'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={handleDisconnectGcal}
                        disabled={disconnecting}
                        className="px-3 py-2 text-[12px] font-medium text-[#d92d20] hover:bg-[#fff1f0] border border-[#fda29b]/40 rounded-[8px] transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                      >
                        {disconnecting ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Unlink size={13} />
                        )}
                        <span>Disconnect</span>
                      </button>
                    </div>
                  </>
                ) : gcalStatus?.configured ? (
                  <>
                    <p className="text-[12px] text-[#505967] leading-relaxed">
                      Your Google OAuth credentials are ready. Connect your account to automatically synchronize meetings, appointments, and deal deadlines directly with your Google Calendar.
                    </p>
                    <div>
                      <button
                        type="button"
                        onClick={handleConnectGcal}
                        disabled={connecting}
                        className="px-4 py-2.5 bg-[#266df0] hover:bg-[#1f5acc] text-white text-[12px] font-semibold rounded-[9px] transition-colors flex items-center gap-2 shadow-xs cursor-pointer disabled:opacity-50"
                      >
                        {connecting ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Calendar size={14} />
                        )}
                        <span>Connect Google Calendar</span>
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-[12px] text-[#505967] leading-relaxed">
                      To enable automated two-way synchronization, configure your Google OAuth 2.0 API credentials in your CRM environment.
                    </p>

                    {/* Setup Environment Variables Help Box */}
                    <div className="p-3.5 rounded-[9px] bg-[#fafbfc] border border-[#e4e7ec] space-y-2">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#505967]">
                        <KeyRound size={13} className="text-[#8f99a8]" />
                        <span>Required Environment Variables (.env)</span>
                      </div>
                      <div className="font-mono text-[11px] bg-[#1c1d1f] text-[#d6e4fd] p-2.5 rounded-[7px] overflow-x-auto space-y-1">
                        <div><span className="text-[#85b7eb]">GOOGLE_CLIENT_ID</span>=&quot;your-client-id.apps.googleusercontent.com&quot;</div>
                        <div><span className="text-[#85b7eb]">GOOGLE_CLIENT_SECRET</span>=&quot;your-client-secret&quot;</div>
                      </div>
                      <p className="text-[11px] text-[#8f99a8] leading-normal">
                        Create credentials in Google Cloud Console with authorized redirect URI:{' '}
                        <code className="text-[#1c1d1f] font-mono font-medium">/api/integrations/google-calendar/callback</code>
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* 1-CLICK INSTANT FALLBACK HIGHLIGHT BANNER */}
            <div className="p-4 rounded-[12px] bg-[#f0f9ff] border border-[#b9e6fe] text-[#026aa2] space-y-1.5">
              <div className="flex items-center gap-2">
                <Sparkles size={15} className="text-[#0284c7] shrink-0" />
                <h4 className="text-[12.5px] font-bold text-[#0c4a6e] tracking-tight">
                  Instant 1-Click Calendar Links (Zero Setup Required)
                </h4>
              </div>
              <p className="text-[11.5px] text-[#0369a1] leading-relaxed">
                Even without Google OAuth API keys or configuration, <strong>1-click fallback Google Calendar links work immediately</strong>! Whenever you view or schedule an activity or deal follow-up, click the <span className="font-semibold">&quot;Add to Google Calendar&quot;</span> button to instantly create a pre-filled event in your browser with title, notes, and dates.
              </p>
            </div>

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
