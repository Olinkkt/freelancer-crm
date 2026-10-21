import { getWorkspaceData, getWorkspaceSettings } from '@/lib/db/repository'
import { generateIcsCalendar } from '@/lib/calendar/ical-generator'

export const dynamic = 'force-dynamic'

export async function GET(
  req: Request,
  props: { params: Promise<{ token: string }> }
) {
  const params = await props.params
  const requestedToken = params?.token?.trim()

  if (!requestedToken) {
    return new Response('Unauthorized: Missing calendar feed token', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  const settings = await getWorkspaceSettings()
  const validToken = settings?.calendarFeedToken

  // Timing safe or constant length check
  if (!validToken || requestedToken !== validToken) {
    return new Response('Unauthorized: Invalid or revoked calendar feed token', {
      status: 401,
      headers: { 'Content-Type': 'text/plain' },
    })
  }

  try {
    const workspace = await getWorkspaceData()
    const operatorName = settings?.operatorName || 'Operator'
    const icsContent = generateIcsCalendar({
      calendarName: `${operatorName} — Freelancer CRM`,
      calendarDescription: `Client meetings, calls, and active deal milestones for ${operatorName}`,
      activities: workspace.activities || [],
      deals: workspace.deals || [],
    })

    return new Response(icsContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Content-Disposition': 'inline; filename="freelancer-crm.ics"',
        'Cache-Control': 'private, max-age=1800, stale-while-revalidate=3600',
      },
    })
  } catch (err: any) {
    return new Response('Failed to generate calendar feed', {
      status: 500,
      headers: { 'Content-Type': 'text/plain' },
    })
  }
}
