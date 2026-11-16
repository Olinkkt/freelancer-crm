import { NextResponse } from 'next/server'
import { checkIsAuthenticated } from '@/lib/auth/session'
import * as repo from '@/lib/db/repository'
import { ContactCreateInputSchema } from '@/lib/validations'
import { sanitizeErrorMessage } from '@/lib/errors'
import type { Contact } from '@/lib/crm-types'
import { queueContactSync } from '@/lib/invoicer/sync'

export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const workspace = await repo.getWorkspaceData()
  return NextResponse.json(workspace.contacts)
}

export async function POST(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const rawBody = await req.json()
    const parsed = ContactCreateInputSchema.safeParse(rawBody)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid contact input', details: parsed.error.format() },
        { status: 400 }
      )
    }
    const contact = await repo.createContact(parsed.data as any)
    queueContactSync(contact.id)
    return NextResponse.json(contact, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to create contact') }, { status: 400 })
  }
}

export async function PUT(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    if (!body?.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'Missing contact id' }, { status: 400 })
    }
    const parsed = ContactCreateInputSchema.partial().safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid contact update input', details: parsed.error.format() },
        { status: 400 }
      )
    }
    // Merge the validated fields into the stored client, so a partial body
    // doesn't blank the phone, notes or the email on the client's deals
    const { contacts } = await repo.getWorkspaceData()
    const existing = contacts.find((c) => c.id === body.id)
    if (!existing) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    const changes = Object.fromEntries(Object.entries(parsed.data).filter(([, v]) => v !== undefined))
    const contact = await repo.updateContact({ ...existing, ...changes } as Contact)
    if (!contact) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    queueContactSync(contact.id)
    return NextResponse.json(contact, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to update contact') }, { status: 400 })
  }
}

export async function DELETE(req: Request) {
  const isAuthed = await checkIsAuthenticated(req)
  if (!isAuthed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) {
      return NextResponse.json({ error: 'Missing contact id parameter' }, { status: 400 })
    }
    const success = await repo.deleteContact(id)
    if (!success) {
      return NextResponse.json({ error: 'Contact not found' }, { status: 404 })
    }
    return NextResponse.json({ success, id }, { status: 200 })
  } catch (err: any) {
    return NextResponse.json({ error: sanitizeErrorMessage(err, 'Failed to delete contact') }, { status: 400 })
  }
}

