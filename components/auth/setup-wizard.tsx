'use client'

import React, { useState } from 'react'
import { Sparkles, ArrowRight, ShieldCheck, User, Mail, DollarSign, Lock, AlertCircle, Loader2, Globe } from 'lucide-react'
import { claimWorkspaceAction } from '@/app/actions/auth'
import { WorkspaceSettings } from '@/lib/crm-types'

interface SetupWizardProps {
  onSetupComplete: (settings: WorkspaceSettings) => void
  envAuthRequired?: boolean
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

export function SetupWizard({ onSetupComplete, envAuthRequired }: SetupWizardProps) {
  const [operatorName, setOperatorName] = useState('')
  const [operatorEmail, setOperatorEmail] = useState('')
  const [operatorRole, setOperatorRole] = useState('Full-Stack Engineer & Consultant')
  const [selectedCurrency, setSelectedCurrency] = useState(CURRENCIES[0])
  const [selectedLocale, setSelectedLocale] = useState(CURRENCIES[0].locale)
  const [setupToken, setSetupToken] = useState('')
  const [passcode, setPasscode] = useState('')
  const [confirmPasscode, setConfirmPasscode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!operatorName.trim() || !operatorEmail.trim()) {
      setError('Please provide your name and email.')
      return
    }

    if (envAuthRequired && !setupToken.trim()) {
      setError('AUTH_SECRET is required to claim this deployment.')
      return
    }

    if (passcode.trim() && passcode !== confirmPasscode) {
      setError('Passcodes do not match. Please verify your entry.')
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await claimWorkspaceAction({
        operatorName: operatorName.trim(),
        operatorEmail: operatorEmail.trim(),
        operatorRole: operatorRole.trim(),
        currency: selectedCurrency.code,
        currencySymbol: selectedCurrency.symbol,
        locale: selectedLocale.trim(),
        passcode: passcode.trim() || undefined,
        setupToken: setupToken.trim() || undefined,
      })

      if (res.success && res.settings) {
        onSetupComplete(res.settings)
      } else {
        setError(res.error || 'Failed to initialize workspace')
      }
    } catch (err: any) {
      setError(err?.message || 'Setup error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0d0f12] flex items-center justify-center p-4 selection:bg-[#266df0] selection:text-white">
      <div className="w-full max-w-lg">
        {/* Header Branding */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a1d24] border border-[#2e3440] text-[#3b82f6] shadow-lg mb-3">
            <Sparkles size={22} strokeWidth={2.2} />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Claim Your Workspace
          </h1>
          <p className="text-xs text-[#8f99a8] mt-1 max-w-sm mx-auto">
            Welcome to Freelancer CRM. Configure your operator profile and preferred currency to get started.
          </p>
        </div>

        {/* Setup Card */}
        <div className="bg-[#16181d] border border-[#282c37] rounded-2xl p-6 sm:p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-[#3b1219] border border-[#671e2b] text-[#fca5a5] text-xs">
                <AlertCircle size={15} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Operator Name */}
            <div>
              <label className="block text-xs font-medium text-[#c5cdd8] mb-1.5">
                Your Full Name *
              </label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                <input
                  type="text"
                  required
                  autoFocus
                  value={operatorName}
                  onChange={(e) => setOperatorName(e.target.value)}
                  placeholder="e.g. Alex Morgan"
                  className="w-full h-10 pl-9 pr-3 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                />
              </div>
            </div>

            {/* Operator Email */}
            <div>
              <label className="block text-xs font-medium text-[#c5cdd8] mb-1.5">
                Work Email *
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                <input
                  type="email"
                  required
                  value={operatorEmail}
                  onChange={(e) => setOperatorEmail(e.target.value)}
                  placeholder="alex@studio.design"
                  className="w-full h-10 pl-9 pr-3 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                />
              </div>
            </div>

            {/* Operator Role */}
            <div>
              <label className="block text-xs font-medium text-[#c5cdd8] mb-1.5">
                Role / Title
              </label>
              <input
                type="text"
                value={operatorRole}
                onChange={(e) => setOperatorRole(e.target.value)}
                placeholder="e.g. Freelance Brand Designer"
                className="w-full h-10 px-3 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
              />
            </div>

            {/* Default Currency */}
            <div>
              <label className="block text-xs font-medium text-[#c5cdd8] mb-1.5">
                Default Currency *
              </label>
              <div className="relative">
                <DollarSign size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                <select
                  value={selectedCurrency.code}
                  onChange={(e) => {
                    const found = CURRENCIES.find((c) => c.code === e.target.value)
                    if (found) {
                      setSelectedCurrency(found)
                      setSelectedLocale(found.locale)
                    }
                  }}
                  className="w-full h-10 pl-9 pr-8 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] cursor-pointer appearance-none"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code} className="bg-[#16181d] text-white">
                      {c.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636c7e] pointer-events-none text-xs">
                  ▼
                </div>
              </div>
            </div>

            {/* Regional Locale */}
            <div>
              <label className="block text-xs font-medium text-[#c5cdd8] mb-1.5">
                Workspace Regional Locale (Formát data a čísel) *
              </label>
              <div className="relative">
                <Globe size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                <select
                  value={selectedLocale}
                  onChange={(e) => setSelectedLocale(e.target.value)}
                  className="w-full h-10 pl-9 pr-8 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] cursor-pointer appearance-none"
                >
                  {LOCALES.map((l) => (
                    <option key={l.code} value={l.code} className="bg-[#16181d] text-white">
                      {l.label}
                    </option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[#636c7e] pointer-events-none text-xs">
                  ▼
                </div>
              </div>
              <p className="text-[11px] text-[#8f99a8] mt-1">
                Určuje způsob formátování kalendářních datumů a oddělovače tisíců.
              </p>
            </div>

            {/* Environment AUTH_SECRET Setup Key */}
            {envAuthRequired && (
              <div className="pt-2 border-t border-[#232731]">
                <div className="mb-2">
                  <span className="block text-xs font-semibold text-amber-400">
                    Deployment Setup Key (AUTH_SECRET) *
                  </span>
                  <span className="text-[11px] text-[#8f99a8]">
                    This server deployment is protected by an environment AUTH_SECRET. Please enter it to claim ownership.
                  </span>
                </div>
                <div className="relative">
                  <ShieldCheck size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" />
                  <input
                    type="password"
                    required
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    placeholder="Enter AUTH_SECRET"
                    className="w-full h-10 pl-8 pr-3 bg-[#0f1115] border border-amber-500/40 rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                  />
                </div>
              </div>
            )}

            {/* Master Passcode */}
            <div className="pt-2 border-t border-[#232731]">
              <div className="mb-2">
                <span className="block text-xs font-semibold text-white">
                  Workspace Passcode Protection
                </span>
                <span className="text-[11px] text-[#8f99a8]">
                  Optional: Set a master passcode to lock your CRM. Leave blank for open mode.
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                  <input
                    type="password"
                    value={passcode}
                    onChange={(e) => setPasscode(e.target.value)}
                    placeholder="Set passcode"
                    className="w-full h-10 pl-8 pr-3 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  />
                </div>
                <div className="relative">
                  <Lock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#636c7e]" />
                  <input
                    type="password"
                    value={confirmPasscode}
                    onChange={(e) => setConfirmPasscode(e.target.value)}
                    placeholder="Confirm passcode"
                    className="w-full h-10 pl-8 pr-3 bg-[#0f1115] border border-[#282c37] rounded-lg text-sm text-white placeholder:text-[#525968] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6]"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-3">
              <button
                type="submit"
                disabled={loading}
                className="w-full h-10 bg-[#2563eb] hover:bg-[#1d4ed8] text-white font-medium rounded-lg text-sm transition-colors flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer shadow-md"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Setting up workspace...</span>
                  </>
                ) : (
                  <>
                    <span>Enter My Cockpit</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
