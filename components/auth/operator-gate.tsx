'use client'

import React, { useState } from 'react'
import { ShieldCheck, Lock, ArrowRight, AlertCircle, Loader2 } from 'lucide-react'
import { loginOperator } from '@/app/actions/auth'

interface OperatorGateProps {
  onAuthenticated: () => void
}

export function OperatorGate({ onAuthenticated }: OperatorGateProps) {
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!passcode.trim() || loading) return

    setLoading(true)
    setError(null)

    try {
      const res = await loginOperator(passcode)
      if (res.success) {
        onAuthenticated()
      } else {
        setError(res.error || 'Incorrect passcode')
      }
    } catch (err: any) {
      setError(err?.message || 'Authentication error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen w-full bg-[#0d0f12] flex items-center justify-center p-4 selection:bg-[#266df0] selection:text-white">
      <div className="w-full max-w-sm">
        {/* Logo / Badge */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-[#1a1d24] border border-[#2e3440] text-[#3b82f6] shadow-lg mb-4">
            <Lock size={22} strokeWidth={2.2} />
          </div>
          <h1 className="text-xl font-semibold text-white tracking-tight">
            Oliver Seidl
          </h1>
          <p className="text-xs text-[#8f99a8] mt-1">
            Solo Operator Workspace &middot; Freelancer CRM
          </p>
        </div>

        {/* Card */}
        <div className="bg-[#16181d] border border-[#282c37] rounded-xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="passcode"
                className="block text-xs font-medium text-[#c5cdd8] mb-1.5"
              >
                Operator Passcode
              </label>
              <div className="relative">
                <input
                  id="passcode"
                  type="password"
                  autoFocus
                  required
                  value={passcode}
                  onChange={(e) => {
                    setPasscode(e.target.value)
                    if (error) setError(null)
                  }}
                  placeholder="Enter secret passcode..."
                  className="w-full px-3.5 py-2.5 bg-[#0e1013] border border-[#2d323e] rounded-lg text-sm text-white placeholder-[#5a6272] focus:outline-none focus:border-[#3b82f6] focus:ring-1 focus:ring-[#3b82f6] transition-all font-mono"
                />
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-red-950/40 border border-red-800/50 text-red-300 text-xs">
                <AlertCircle size={14} className="shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !passcode.trim()}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 bg-[#2563eb] hover:bg-[#1d4ed8] disabled:bg-[#202738] disabled:text-[#505a6e] text-white text-xs font-semibold rounded-lg shadow-sm transition-all cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <span>Unlock Workspace</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-[#232731] flex items-center justify-between text-[11px] text-[#697282]">
            <span className="flex items-center gap-1.5">
              <ShieldCheck size={13} className="text-emerald-500" />
              <span>Single-operator gate</span>
            </span>
            <span>AES / HMAC</span>
          </div>
        </div>
      </div>
    </div>
  )
}
