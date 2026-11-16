'use client'

import { CirclePlus, Edit3, Mail, Search, Trash2, UserPlus, Users } from 'lucide-react'
import { formatMoney } from '@/lib/config'
import { Contact, Deal, WorkspaceSettings } from '@/lib/crm-types'
import { RowActionMenu } from '@/components/ui/row-action-menu'

interface ClientsViewProps {
  contacts: Contact[]
  /** Deals in the CRM stages (Lead, Qualified, Proposal) */
  openDeals: Deal[]
  pipelineAmount: number
  settings: WorkspaceSettings
  /** Search text; the ⌘K palette sets it when you pick a client */
  search: string
  onSearchChange: (value: string) => void
  onAddClient: () => void
  onPreviewClient: (contact: Contact) => void
  onEditClient: (contact: Contact) => void
  onCreateDeal: (contact: Contact) => void
  onDeleteClient: (id: string, name: string) => void
}

export function ClientsView({
  contacts,
  openDeals,
  pipelineAmount,
  settings,
  search: contactSearch,
  onSearchChange: setContactSearch,
  onAddClient,
  onPreviewClient,
  onEditClient,
  onCreateDeal,
  onDeleteClient,
}: ClientsViewProps) {
  const getContactOpenDealsCount = (contact: Contact) => openDeals.filter((d) => d.contactId === contact.id).length

  return (
    <>
      <section className="page-heading">
        <div>
          <h1>Clients</h1>
          <p className="subcopy">
            Everyone you work with. Click a client to edit their details.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => onAddClient()}
        >
          <CirclePlus size={17} />
          <span>Add client</span>
        </button>
      </section>

      <section className="company-summary">
        <div>
          <span className="metric-label">Total clients</span>
          <strong>{contacts.length}</strong>
          <small>People you work with</small>
        </div>
        <div>
          <span className="metric-label">Active pipeline</span>
          <strong>
            {contacts.filter((c) => getContactOpenDealsCount(c) > 0).length}
          </strong>
          <small>With at least one open deal</small>
        </div>
        <div>
          <span className="metric-label">Open deals</span>
          <strong>{openDeals.length}</strong>
          <small>
            {formatMoney(pipelineAmount, settings)} in pipeline
          </small>
        </div>
      </section>

      <section className="panel companies-panel">
        <div className="company-toolbar">
          <div>
            <p className="section-kicker">People directory</p>
            <h2>All clients</h2>
          </div>
          <div className="company-tools">
            <label className="search-field">
              <Search size={15} />
              <input
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                placeholder="Search clients"
              />
            </label>
          </div>
        </div>

        <div className="deals-list clients-list">
          <div className="deals-list-head">
            <span>Client</span>
            <span>Phone</span>
            <span>Open deals</span>
            <span>Last touch</span>
            <span>Email</span>
            <span />
          </div>
          {contacts.length === 0 ? (
            <div className="py-12 px-4 text-center">
              <div className="w-10 h-10 rounded-full bg-[#f4f5f6] text-[#8f99a8] flex items-center justify-center mx-auto mb-2.5">
                <Users size={18} />
              </div>
              <h3 className="text-[13px] font-semibold text-[#1c1d1f] mb-1">No clients yet</h3>
              <p className="text-[11px] text-[#8f99a8] max-w-xs mx-auto mb-3">
                Save client founders, project stakeholders, and creative partners.
              </p>
              <button
                type="button"
                onClick={() => onAddClient()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#232529] hover:bg-[#101113] text-white text-[11px] font-medium rounded-[8px] transition-colors cursor-pointer"
              >
                <UserPlus size={13} />
                <span>Add client</span>
              </button>
            </div>
          ) : (
            contacts
              .filter(
                (c) =>
                  c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                  (c.phone || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                  c.email.toLowerCase().includes(contactSearch.toLowerCase())
              )
              .map((contact) => {
                return (
                  <div
                    className="deals-list-row"
                    key={contact.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`View ${contact.name}`}
                    onClick={() => onPreviewClient(contact)}
                    onKeyDown={(e) => {
                      if (e.target !== e.currentTarget) return
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        onPreviewClient(contact)
                      }
                    }}
                  >
                    <div className="company-name min-w-0">
                      <span className={`company-avatar shrink-0 ${contact.color}`}>
                        {contact.name.charAt(0)}
                      </span>
                      <div className="min-w-0">
                        <strong className="truncate block" title={contact.name}>{contact.name}</strong>
                      </div>
                    </div>
                    <div className="company-contact">
                      {contact.phone ? (
                        <a href={`tel:${contact.phone}`} onClick={(e) => e.stopPropagation()} className="cell-num hover:underline">
                          {contact.phone}
                        </a>
                      ) : (
                        <span className="text-[#8f99a8] text-[11px]">—</span>
                      )}
                    </div>
                    <span className="cell-num">{getContactOpenDealsCount(contact)}</span>
                    <span className="last-touch">{contact.lastTouch}</span>
                    <div className="truncate">
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          onClick={(e) => e.stopPropagation()}
                          className="hover:underline truncate block"
                          title={contact.email}
                        >
                          {contact.email}
                        </a>
                      ) : (
                        <span className="text-[#8f99a8] text-[11px]">—</span>
                      )}
                    </div>
                    <div className="flex justify-end" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
                      <RowActionMenu
                        triggerLabel={`More options for ${contact.name}`}
                        items={[
                          {
                            label: 'Edit client',
                            icon: Edit3,
                            onClick: () => onEditClient(contact),
                          },
                          ...(contact.email
                            ? [
                                {
                                  label: 'Send email',
                                  icon: Mail,
                                  onClick: () => {
                                    window.location.href = `mailto:${contact.email}`
                                  },
                                },
                              ]
                            : []),
                          {
                            label: 'Create deal for client',
                            icon: CirclePlus,
                            onClick: () => onCreateDeal(contact),
                          },
                          {
                            label: 'Delete client',
                            icon: Trash2,
                            destructive: true,
                            divider: true,
                            onClick: () => {
                              if (window.confirm(`Are you sure you want to delete client "${contact.name}"?`)) {
                                onDeleteClient(contact.id, contact.name)
                              }
                            },
                          },
                        ]}
                      />
                    </div>
                  </div>
                )
              })
          )}

          {contacts.length > 0 &&
            contacts.filter(
              (c) =>
                c.name.toLowerCase().includes(contactSearch.toLowerCase()) ||
                (c.phone || '').toLowerCase().includes(contactSearch.toLowerCase()) ||
                c.email.toLowerCase().includes(contactSearch.toLowerCase())
            ).length === 0 && (
              <div className="py-8 text-center text-[#8f99a8] text-[12px]">
                No clients matching &ldquo;{contactSearch}&rdquo;
              </div>
            )}
        </div>
      </section>
    </>
  )
}
