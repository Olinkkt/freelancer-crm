'use client'

import { useState } from 'react'
import { Calendar, ChevronRight, Download, Edit3, Upload } from 'lucide-react'
import { exportContactsCSV, exportDealsCSV, exportFollowUpsCSV } from '@/lib/csv-export'
import { getOperatorInitials } from '@/lib/config'
import { Contact, Deal, FollowUpItem, WorkspaceSettings } from '@/lib/crm-types'
import { ShortcutsSettings } from '@/components/settings/shortcuts-settings'
import { ApiTokensSettings } from '@/components/settings/api-tokens-settings'
import { InvoicerSettings } from '@/components/settings/invoicer-settings'
import type { ToastHUDItem } from '@/components/ui/toast-hud'

interface SettingsViewProps {
  settings: WorkspaceSettings
  /** A passcode or AUTH_SECRET protects the workspace */
  authRequired: boolean
  deals: Deal[]
  contacts: Contact[]
  followUps: FollowUpItem[]
  addToast: (message: string, shortcut?: string, type?: ToastHUDItem['type']) => void
  onLock: () => void
  /** Open the settings modal on the given tab */
  onEditSettings: (tab: 'profile' | 'calendar') => void
  /** Reload the workspace after a backup was restored */
  onRestored: () => Promise<void>
}

export function SettingsView({
  settings,
  authRequired,
  deals,
  contacts,
  followUps,
  addToast,
  onLock,
  onEditSettings,
  onRestored,
}: SettingsViewProps) {
  const [settingsTab, setSettingsTab] = useState<'profile' | 'shortcuts' | 'export' | 'api' | 'invoicer'>('profile')

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Settings</h1>
        </div>
      </section>

      {/* ATTIO TAB BAR */}
      <div className="tabs mb-8">
        <button
          type="button"
          className={settingsTab === 'profile' ? 'tab-active' : ''}
          onClick={() => setSettingsTab('profile')}
        >
          Profile
        </button>
        <button
          type="button"
          className={settingsTab === 'shortcuts' ? 'tab-active' : ''}
          onClick={() => setSettingsTab('shortcuts')}
        >
          Shortcuts
        </button>
        <button
          type="button"
          className={settingsTab === 'export' ? 'tab-active' : ''}
          onClick={() => setSettingsTab('export')}
        >
          Data
        </button>
        <button
          type="button"
          className={settingsTab === 'api' ? 'tab-active' : ''}
          onClick={() => setSettingsTab('api')}
        >
          API
        </button>
        <button
          type="button"
          className={settingsTab === 'invoicer' ? 'tab-active' : ''}
          onClick={() => setSettingsTab('invoicer')}
        >
          Invoicer
        </button>
      </div>

      {/* TAB 1: GENERAL & PROFILE */}
      {settingsTab === 'profile' && (
        <div className="space-y-8 max-w-4xl">
          {/* SECTION 1: OPERATOR IDENTITY */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-8 border-b border-[#e4e7ec]">
            <div className="md:col-span-4">
              <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Profile</h3>
              <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                Your name, email and role.
              </p>
            </div>
            <div className="md:col-span-8">
              <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4 min-w-0">
                    <span className="avatar large shrink-0 font-semibold text-[15px]">
                      {getOperatorInitials(settings.operatorName)}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight truncate">
                          {settings.operatorName}
                        </strong>
                      </div>
                      <span className="text-[13px] text-[#6f7988] truncate block mt-0.5">
                        {settings.operatorEmail}
                      </span>
                      <div className="mt-2">
                        <span className="inline-flex items-center text-[11px] font-medium text-[#2e3238] bg-[#f4f5f6] border border-[#e4e7ec] px-2.5 py-0.5 rounded-[7px]">
                          {settings.operatorRole}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditSettings('profile')}
                    className="select-button self-start sm:self-center shrink-0"
                  >
                    <Edit3 size={13} className="text-[#6f7988]" />
                    <span>Edit</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: REGIONAL & CURRENCY */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pb-8 border-b border-[#e4e7ec]">
            <div className="md:col-span-4">
              <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Currency & locale</h3>
              <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                Used for deal values and dates.
              </p>
            </div>
            <div className="md:col-span-8">
              <div className="bg-white border border-[#e4e7ec] rounded-xl divide-y divide-[#f0f1f3] shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px] text-[13px]">
                <div className="flex items-center justify-between p-4">
                  <div>
                    <span className="text-[#1c1d1f] font-medium block">Currency</span>
                    <span className="text-[#6f7988] text-[12px]">Deal values and totals</span>
                  </div>
                  <strong className="font-mono text-[#1c1d1f]">
                    {settings.currency} <span className="text-[#8f99a8] font-normal">({settings.currencySymbol.trim()})</span>
                  </strong>
                </div>
                <div className="flex items-center justify-between p-4">
                  <div>
                    <span className="text-[#1c1d1f] font-medium block">Locale</span>
                    <span className="text-[#6f7988] text-[12px]">Date and number format</span>
                  </div>
                  <span className="font-mono text-[#505967]">{settings.locale}</span>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: WORKSPACE SECURITY */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4">
              <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Security</h3>
              <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                Passcode and session.
              </p>
            </div>
            <div className="md:col-span-8">
              <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <strong className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">
                        {authRequired ? 'Passcode on' : 'Passcode off'}
                      </strong>
                    </div>
                    <p className="text-[12px] text-[#6f7988] mt-1">
                      {authRequired
                        ? 'Session lasts 30 days.'
                        : 'Anyone who can reach this app can open it.'}
                    </p>
                  </div>
                  {authRequired ? (
                    <button
                      type="button"
                      onClick={onLock}
                      className="primary-button text-[12px] py-1.5 px-3 min-h-0 self-start sm:self-center shrink-0"
                    >
                      Lock
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => onEditSettings('profile')}
                      className="select-button text-[12px] self-start sm:self-center shrink-0"
                    >
                      Set passcode
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: CALENDAR FEED */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start pt-8 border-t border-[#e4e7ec]">
            <div className="md:col-span-4">
              <h3 className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">Calendar</h3>
              <p className="text-[13px] text-[#6f7988] mt-1 leading-relaxed">
                Subscribe to next actions from any calendar app.
              </p>
            </div>
            <div className="md:col-span-8">
              <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-10 h-10 rounded-[10px] bg-[#f0f4fe] border border-[#d6e4fd] flex items-center justify-center text-[#266df0] shrink-0 mt-0.5">
                      <Calendar size={20} />
                    </div>
                    <div className="min-w-0">
                      <strong className="text-[15px] font-semibold text-[#1c1d1f] tracking-tight">
                        Calendar feed (.ics)
                      </strong>
                      <p className="text-[12px] text-[#6f7988] mt-1 leading-normal">
                        Works with Google, Apple and phone calendars.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onEditSettings('calendar')}
                    className="select-button text-[12px] py-1.5 px-3 font-semibold text-[#1c1d1f] cursor-pointer self-start sm:self-center shrink-0"
                  >
                    <span>Get link</span>
                    <ChevronRight size={13} className="text-[#6f7988]" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: KEYBOARD SHORTCUTS */}
      {settingsTab === 'shortcuts' && <ShortcutsSettings />}

      {settingsTab === 'api' && <ApiTokensSettings />}

      {settingsTab === 'invoicer' && <InvoicerSettings />}

      {/* TAB 3: DATA & PORTABILITY */}
      {settingsTab === 'export' && (
        <div className="space-y-6 max-w-4xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#e4e7ec]">
            <div>
              <h3 className="text-[16px] font-semibold text-[#1c1d1f] tracking-tight">Export</h3>
              <p className="text-[13px] text-[#6f7988] mt-0.5">
                CSV files for Excel, Sheets or Notion.
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                exportDealsCSV(deals, settings.currency)
                exportContactsCSV(contacts)
                exportFollowUpsCSV(followUps)
                addToast('Exported 3 CSV files', 'Export')
              }}
              className="primary-button text-[12px] py-1.5 px-3 min-h-0 shrink-0"
            >
              <Download size={13} />
              <span>Export all</span>
            </button>
          </div>

          <div className="bg-white border border-[#e4e7ec] rounded-xl overflow-hidden shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px]">
            <div className="divide-y divide-[#f0f1f3]">
              {[
                {
                  title: 'Deals',
                  desc: 'Stages, values, next actions, deliverables',
                  count: deals.length,
                  action: () => {
                    exportDealsCSV(deals, settings.currency)
                    addToast(`Exported ${deals.length} deals to CSV`, 'CSV')
                  },
                },
                {
                  title: 'Clients',
                  desc: 'Names, emails, phones, notes',
                  count: contacts.length,
                  action: () => {
                    exportContactsCSV(contacts)
                    addToast(`Exported ${contacts.length} contacts to CSV`, 'CSV')
                  },
                },
                {
                  title: 'Follow-ups',
                  desc: 'Next actions, times, completion',
                  count: followUps.length,
                  action: () => {
                    exportFollowUpsCSV(followUps)
                    addToast(`Exported ${followUps.length} follow-ups to CSV`, 'CSV')
                  },
                },
              ].map((item, idx) => (
                <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 hover:bg-[#fafbfc] transition-colors">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <strong className="text-[14px] font-semibold text-[#1c1d1f]">{item.title}</strong>
                      <span className="text-[11px] font-mono font-medium text-[#266df0] bg-[#e9f0ff] px-2 py-0.5 rounded-[7px]">
                        {item.count} records
                      </span>
                    </div>
                    <p className="text-[12px] text-[#6f7988] mt-0.5">{item.desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={item.action}
                    className="select-button self-start sm:self-center shrink-0"
                  >
                    <Download size={13} className="text-[#266df0]" />
                    <span>CSV</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* SELF-HOSTED COMPLETE DATABASE BACKUP & RESTORE */}
          <div className="bg-white border border-[#e4e7ec] rounded-xl p-5 shadow-[rgba(28,40,64,0.04)_0px_2px_4px_-1px] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <strong className="text-[15px] font-semibold text-[#1c1d1f]">Backup (JSON)</strong>
                </div>
                <p className="text-[12px] text-[#6f7988] mt-1 leading-relaxed">
                  Full snapshot of your workspace. Restoring replaces current records.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2 border-t border-[#f0f1f3] flex-wrap">
              <a
                href="/api/backup"
                download
                onClick={() => addToast('Downloading backup', 'Backup')}
                className="primary-button text-[12px] py-1.5 px-3 min-h-0"
              >
                <Download size={13} />
                <span>Download backup</span>
              </a>

              <label className="select-button cursor-pointer text-[12px] py-1.5 px-3 min-h-0">
                <Upload size={13} className="text-[#266df0]" />
                <span>Restore</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    if (!window.confirm('Restoring replaces current workspace records. Continue?')) {
                      e.target.value = ''
                      return
                    }
                    try {
                      const text = await file.text()
                      const json = JSON.parse(text)
                      const res = await fetch('/api/backup', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(json),
                      })
                      const result = await res.json()
                      if (res.ok && result.success) {
                        addToast('Workspace restored', 'Restore')
                        await onRestored()
                      } else {
                        addToast(result.error || 'Failed to restore workspace', undefined, 'warning')
                      }
                    } catch (err: any) {
                      addToast(`Invalid backup file: ${err.message}`, undefined, 'warning')
                    } finally {
                      e.target.value = ''
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
