import { getWorkspaceData, getWorkspaceSettings } from '@/lib/db/repository'
import { generateIcsCalendar, type ProjectCalendarItem } from '@/lib/calendar/ical-generator'
import { db } from '@/lib/db/client'

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

    // Fetch active project items for calendar feed
    const projectItems: ProjectCalendarItem[] = []
    try {
      const [tasksRows, milestonesRows, invoicesRows, projectsRows] = await Promise.all([
        db
          .selectFrom('project_tasks')
          .selectAll()
          .where('completed_at', 'is', null)
          .where('due_date', 'is not', null)
          .execute(),
        db
          .selectFrom('project_milestones')
          .selectAll()
          .where('due_date', 'is not', null)
          .where('status', '!=', 'approved')
          .execute(),
        db
          .selectFrom('invoices')
          .selectAll()
          .where('due_date', 'is not', null)
          .where('status', '=', 'sent')
          .execute(),
        db.selectFrom('projects').select(['id', 'title', 'company', 'archived_at']).execute(),
      ])

      const projectMap = new Map<string, { id: string; title: string; company: string }>()
      for (const p of projectsRows) {
        if (!p.archived_at) {
          projectMap.set(p.id, { id: p.id, title: p.title, company: p.company })
        }
      }

      for (const t of tasksRows) {
        const p = projectMap.get(t.project_id)
        if (p && t.due_date) {
          projectItems.push({
            type: 'task',
            id: t.id,
            title: t.title,
            company: p.company,
            projectTitle: p.title,
            dueDate: t.due_date,
          })
        }
      }

      for (const m of milestonesRows) {
        const p = projectMap.get(m.project_id)
        if (p && m.due_date) {
          projectItems.push({
            type: 'milestone',
            id: m.id,
            title: m.title,
            company: p.company,
            projectTitle: p.title,
            dueDate: m.due_date,
          })
        }
      }

      for (const inv of invoicesRows) {
        const p = projectMap.get(inv.project_id)
        if (p && inv.due_date) {
          projectItems.push({
            type: 'invoice',
            id: inv.id,
            title: inv.label || 'Invoice',
            company: p.company,
            projectTitle: p.title,
            dueDate: inv.due_date,
          })
        }
      }
    } catch {
      // In case tables do not exist yet or fail, proceed gracefully
    }

    const icsContent = generateIcsCalendar({
      calendarName: `${operatorName} — Freelancer CRM`,
      calendarDescription: `Client meetings, calls, and active deal milestones for ${operatorName}`,
      activities: workspace.activities || [],
      deals: workspace.deals || [],
      projectItems,
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
