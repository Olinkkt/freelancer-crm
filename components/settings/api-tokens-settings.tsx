'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, KeyRound } from 'lucide-react'
import { createApiTokenAction, listApiTokensAction, revokeApiTokenAction } from '@/app/actions/api-tokens'
import type { ApiToken } from '@/lib/db/api-tokens'

const CARD = 'bg-white border border-[#e4e7ec] rounded-xl shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]'

function formatWhen(iso?: string) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      className="select-button text-[12px] py-1.5 px-3 shrink-0"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text)
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        } catch {}
      }}
    >
      {copied ? <Check size={13} /> : <Copy size={13} />}
      <span>{copied ? 'Copied' : label}</span>
    </button>
  )
}

/** Settings → API: scoped tokens for agents, the REST API and MCP */
export function ApiTokensSettings() {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [origin, setOrigin] = useState('http://localhost:3000')
  const [name, setName] = useState('')
  const [canWrite, setCanWrite] = useState(false)
  const [created, setCreated] = useState<{ name: string; plaintext: string } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    try {
      const res = await listApiTokensAction()
      setTokens(res.tokens)
      setOrigin(res.origin)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tokens')
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || busy) return
    setBusy(true)
    setError(null)
    try {
      const res = await createApiTokenAction(name.trim(), canWrite ? ['read', 'write'] : ['read'])
      setCreated({ name: res.token.name, plaintext: res.plaintext })
      setName('')
      setCanWrite(false)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create token')
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (t: ApiToken) => {
    if (!window.confirm(`Revoke "${t.name}"? Agents using it stop working immediately.`)) return
    try {
      await revokeApiTokenAction(t.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to revoke token')
    }
  }

  const active = tokens.filter((t) => !t.revokedAt)
  const revoked = tokens.filter((t) => t.revokedAt)
  const mcpCommand = created
    ? `claude mcp add --transport http freelancer-crm ${origin}/api/mcp --header "Authorization: Bearer ${created.plaintext}"`
    : ''

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
        <div>
          <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">API &amp; agents</h3>
          <p className="text-[13px] text-[#6f7988] mt-0.5">
            Tokens for AI agents, the REST API and MCP.{' '}
            <a href="/api/docs" target="_blank" rel="noreferrer" className="text-[#266df0] hover:underline">
              API docs
            </a>
          </p>
        </div>
      </div>

      {error && <p className="text-[13px] text-[#c4321f]">{error}</p>}

      {created && (
        <div className={`${CARD} p-5 space-y-3 border-[#d6e4fd]`}>
          <div>
            <strong className="text-[14px] font-semibold text-[#1c1d1f]">“{created.name}” created</strong>
            <p className="text-[12px] text-[#6f7988] mt-1">Copy it now. It is shown only once.</p>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 truncate font-mono text-[12px] bg-[#f4f5f6] border border-[#e4e7ec] rounded-md px-3 py-2">
              {created.plaintext}
            </code>
            <CopyButton text={created.plaintext} />
          </div>
          <div>
            <p className="text-[12px] text-[#6f7988] mb-1">Connect Claude Code:</p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 truncate font-mono text-[11px] bg-[#f4f5f6] border border-[#e4e7ec] rounded-md px-3 py-2">
                {mcpCommand}
              </code>
              <CopyButton text={mcpCommand} />
            </div>
          </div>
          <button type="button" className="text-[12px] text-[#6f7988] hover:text-[#1c1d1f]" onClick={() => setCreated(null)}>
            Done, hide it
          </button>
        </div>
      )}

      <form onSubmit={create} className={`${CARD} p-5 flex flex-col sm:flex-row sm:items-end gap-4`}>
        <label className="flex-1 min-w-0">
          <span className="text-[12px] text-[#6f7988] block mb-1">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={80}
            placeholder="Claude Code on laptop"
            className="w-full border border-[#dce0e8] rounded-md px-3 py-2 text-[13px] outline-none focus:border-[#266df0]"
          />
        </label>
        <label className="flex items-center gap-2 text-[13px] text-[#1c1d1f] select-none pb-2">
          <input type="checkbox" checked={canWrite} onChange={(e) => setCanWrite(e.target.checked)} />
          Can make changes
        </label>
        <button type="submit" disabled={!name.trim() || busy} className="primary-button text-[12px] py-2 px-4 min-h-0 disabled:opacity-50">
          Create token
        </button>
      </form>

      <div className={`${CARD} divide-y divide-[#e4e7ec]`}>
        {active.length === 0 && (
          <div className="p-5 flex items-center gap-3 text-[13px] text-[#6f7988]">
            <KeyRound size={16} /> No tokens yet. Read-only is the safe default for a new agent.
          </div>
        )}
        {active.map((t) => (
          <div key={t.id} className="p-4 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-medium text-[#1c1d1f] truncate">{t.name}</span>
                <span
                  className={`text-[11px] px-1.5 py-0.5 rounded border ${
                    t.scopes.includes('write')
                      ? 'text-[#266df0] border-[#d6e4fd] bg-[#f0f4fe]'
                      : 'text-[#505967] border-[#e4e7ec] bg-[#f4f5f6]'
                  }`}
                >
                  {t.scopes.includes('write') ? 'Read & write' : 'Read only'}
                </span>
              </div>
              <p className="text-[12px] text-[#6f7988] mt-0.5 font-mono">
                {t.prefix}… · created {formatWhen(t.createdAt)} · last used {formatWhen(t.lastUsedAt)}
              </p>
            </div>
            <button type="button" onClick={() => revoke(t)} className="select-button text-[12px] py-1.5 px-3 shrink-0">
              Revoke
            </button>
          </div>
        ))}
      </div>

      {revoked.length > 0 && (
        <p className="text-[12px] text-[#8f99a8]">
          {revoked.length} revoked token{revoked.length === 1 ? '' : 's'}: {revoked.map((t) => t.name).join(', ')}
        </p>
      )}
    </div>
  )
}
