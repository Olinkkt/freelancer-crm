'use client'

import React, { useState, useEffect } from 'react'
import { X, User, Mail, DollarSign, Lock, AlertCircle, Loader2, Save, Globe } from 'lucide-react'
import { updateWorkspaceSettingsAction } from '@/app/actions/auth'
import { WorkspaceSettings } from '@/lib/crm-types'

interface EditSettingsModalProps {
  isOpen: boolean
  onClose: () => void
  currentSettings: WorkspaceSettings
  onSettingsUpdated: (updated: WorkspaceSettings) => void
}

const CURRENCIES = [
  { code: 'CZK', symbol: 'Kč', label: 'CZK (Kč) — Czech Koruna', locale: 'cs-CZ' },
  { code: 'USD', symbol: '$', label: 'USD ($) — United States Dollar', locale: 'en-US' },
  { code: 'EUR', symbol: '€', label: 'EUR (€) — Euro', locale: 'de-DE' },
  { code: 'GBP', symbol: '£', label: 'GBP (£) — British Pound', locale: 'en-GB' },
  { code: 'CAD', symbol: '$', label: 'CAD ($) — Canadian Dollar', locale: 'en-CA' },
  { code: 'AUD', symbol: '$', label: 'AUD ($) — Australian Dollar', locale: 'en-AU' },
  { code: 'CHF', symbol: 'CHF', label: 'CHF — Swiss Franc', locale: 'de-CH' },
]

const LOCALES = [
  { code: 'cs-CZ', label: 'cs-CZ — Čeština (Česká republika)' },
  { code: 'sk-SK', label: 'sk-SK — Slovenčina (Slovensko)' },
  { code: 'en-US', label: 'en-US — English (United States)' },
  { code: 'en-GB', label: 'en-GB — English (United Kingdom)' },
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
}: EditSettingsModalProps) {
  const [name, setName] = useState(currentSettings.operatorName)
  const [email, setEmail] = useState(currentSettings.operatorEmail)
  const [role, setRole] = useState(currentSettings.operatorRole)
  const initialCurrency =
    CURRENCIES.find((c) => c.code === currentSettings.currency) || CURRENCIES[0]
  const [currency, setCurrency] = useState(initialCurrency)
  const [locale, setLocale] = useState(currentSettings.locale || initialCurrency.locale || 'cs-CZ')
  const [newPasscode, setNewPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(currentSettings.operatorName || '')
      setEmail(currentSettings.operatorEmail || '')
      setRole(currentSettings.operatorRole || '')
      const found =
        CURRENCIES.find((c) => c.code === currentSettings.currency) || CURRENCIES[0]
      setCurrency(found)
      setLocale(currentSettings.locale || found.locale || 'cs-CZ')
      setNewPasscode('')
      setConfirmPasscode('')
      setError(null)
    }
  }, [isOpen, currentSettings])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
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
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10141c]/40 backdrop-blur-xs transition-all"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white rounded-[14px] shadow-xl border border-[#e4e7ec] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-[#edf0f3] flex items-center justify-between bg-[#fafbfc]">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#8f99a8] block">
              Preferences
            </span>
            <h2 className="text-[14px] font-semibold text-[#1c1d1f]">
              Edit Profile & Workspace Settings
            </h2>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-[10px] flex items-center justify-center text-[#9fa1a7] hover:text-[#1c1d1f] hover:bg-[#edf0f3] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto">
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
              Workspace Regional Locale *
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
              Controls date conventions and numeric formatting.
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

          <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#f0f1f3]">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-[12px] font-medium text-[#505967] hover:text-[#1c1d1f] rounded-[8px]"
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
      </div>
    </div>
  )
}
