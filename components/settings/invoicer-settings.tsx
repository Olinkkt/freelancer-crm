'use client'

import { useEffect, useState } from 'react'
import { ArrowRight, FileText, RefreshCw } from 'lucide-react'
import {
  connectInvoicerAction,
  disconnectInvoicerAction,
  getInvoicerStatusAction,
  syncInvoicerNowAction,
} from '@/app/actions/invoicer'
import type { InvoicerStatus, SyncSummary } from '@/lib/invoicer/sync'

const CARD = 'bg-white border border-[#e4e7ec] rounded-xl shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]'
const INPUT = 'w-full border border-[#dce0e8] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#266df0]'

function formatWhen(iso?: string | null) {
  if (!iso) return 'never'
  const d = new Date(iso)
  return d.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function describe(s: SyncSummary) {
  const parts = [
    s.created && `${s.created} created`,
    s.updated && `${s.updated} updated`,
    s.unchanged && `${s.unchanged} already up to date`,
    s.failed && `${s.failed} failed`,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'No clients to sync'
}

/** Settings → Invoicer: push CRM clients to the Invoicer (one way) */
export function InvoicerSettings() {
  const [status, setStatus] = useState<InvoicerStatus | null>(null)
  const [url, setUrl] = useState('http://localhost:3100')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<'connect' | 'sync' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)

  useEffect(() => {
    getInvoicerStatusAction()
      .then(setStatus)
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
  }, [])

  const connect = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!url.trim() || !token.trim() || busy) return
    setBusy('connect')
    setError(null)
    setResult(null)
    const res = await connectInvoicerAction(url, token)
    setBusy(null)
    if (!res.ok) return setError(res.error)
    setToken('')
    setStatus(res.status)
    setResult(`Connected. ${describe(res.summary)}.`)
  }

  const syncNow = async () => {
    setBusy('sync')
    setError(null)
    setResult(null)
    const res = await syncInvoicerNowAction()
    setBusy(null)
    setStatus(res.status)
    if (!res.ok) return setError(res.error)
    setResult(`${describe(res.summary)}.`)
  }

  const disconnect = async () => {
    if (!window.confirm('Disconnect the Invoicer? Clients already there stay. New CRM changes stop syncing.')) return
    setBusy('disconnect')
    setResult(null)
    setStatus(await disconnectInvoicerAction())
    setBusy(null)
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
        <div>
          <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Invoicer</h3>
          <p className="text-[13px] text-[#6f7988] mt-0.5">
            Clients you add or edit here appear in the Invoicer. One way only: changes made in the Invoicer never come back.
          </p>
        </div>
      </div>

      {error && <p className="text-[13px] text-[#c4321f]">{error}</p>}
      {result && <p className="text-[13px] text-[#1c1d1f]">{result}</p>}

      {status === null ? null : status.connected ? (
        <div className={`${CARD} divide-y divide-[#e4e7ec]`}>
          <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className={`w-[7px] h-[7px] rounded-full shrink-0 ${status.lastError ? 'bg-[#c4321f]' : 'bg-[#50b884]'}`} />
                <span className="text-[14px] font-medium text-[#1c1d1f]">{status.lastError ? 'Last sync failed' : 'Connected'}</span>
              </div>
              <p className="text-[12px] text-[#6f7988] mt-1">
                <a href={status.url} target="_blank" rel="noreferrer" className="text-[#266df0] hover:underline">
                  {status.url}
                </a>{' '}
                · token <span className="font-mono">{status.tokenPrefix}</span> · last sync {formatWhen(status.lastSyncAt)}
              </p>
              {status.lastError && <p className="text-[12px] text-[#c4321f] mt-1">{status.lastError}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button type="button" onClick={syncNow} disabled={!!busy} className="primary-button text-[12px] py-2 px-4 min-h-0 disabled:opacity-50">
                <RefreshCw size={13} className={busy === 'sync' ? 'animate-spin' : ''} />
                <span>{busy === 'sync' ? 'Syncing…' : 'Sync all now'}</span>
              </button>
              <button type="button" onClick={disconnect} disabled={!!busy} className="select-button text-[12px] py-1.5 px-3">
                Disconnect
              </button>
            </div>
          </div>
          <div className="p-5 flex items-center gap-3 text-[13px] text-[#505967]">
            <FileText size={16} className="text-[#6f7988] shrink-0" />
            <span>
              {status.linkedClients} of {status.totalClients} client{status.totalClients === 1 ? '' : 's'} linked. Name, email and phone are
              kept in step; billing address, IČO and DIČ stay in the Invoicer.
            </span>
          </div>
        </div>
      ) : (
        <form onSubmit={connect} className={`${CARD} p-5 space-y-4`}>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="min-w-0">
              <span className="text-[12px] text-[#6f7988] block mb-1">Invoicer address</span>
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://localhost:3100" className={INPUT} />
            </label>
            <label className="min-w-0">
              <span className="text-[12px] text-[#6f7988] block mb-1">Invoicer API token</span>
              <input
                value={token}
                onChange={(e) => setToken(e.target.value)}
                type="password"
                autoComplete="off"
                placeholder="finv_…"
                className={`${INPUT} font-mono`}
              />
            </label>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-[12px] text-[#6f7988]">
              In the Invoicer: Settings → API → create a token with <strong className="font-medium text-[#1c1d1f]">Can make changes</strong>.
            </p>
            <button type="submit" disabled={!url.trim() || !token.trim() || !!busy} className="primary-button text-[12px] py-2 px-4 min-h-0 disabled:opacity-50 shrink-0">
              <span>{busy === 'connect' ? 'Connecting…' : 'Connect & sync'}</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
