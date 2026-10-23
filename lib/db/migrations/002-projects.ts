import { sql } from 'kysely'
import type { Migration } from './types'
import { floatType } from './sql'

export const m002: Migration = {
  version: 2,
  name: '002-projects',
  up: async (trx, dialect) => {
    const fType = sql.raw(floatType(dialect))

    await sql`
      CREATE TABLE project_stages (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 40),
        category TEXT NOT NULL CHECK (category IN ('planned','active','review','delivered','closed')),
        position INTEGER NOT NULL,
        color TEXT NOT NULL DEFAULT 'blue',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(trx)

    await sql`
      CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
        company TEXT NOT NULL,
        company_id TEXT,
        deal_id TEXT UNIQUE,
        contact_name TEXT,
        contact_email TEXT,
        stage_id TEXT NOT NULL,
        billing_type TEXT NOT NULL DEFAULT 'fixed' CHECK (billing_type IN ('fixed','hourly','retainer')),
        currency TEXT NOT NULL CHECK (length(currency) = 3),
        budget_minor INTEGER CHECK (budget_minor IS NULL OR budget_minor >= 0),
        hourly_rate_minor INTEGER CHECK (hourly_rate_minor IS NULL OR hourly_rate_minor >= 0),
        estimate_hours ${fType} CHECK (estimate_hours IS NULL OR estimate_hours >= 0),
        revisions_included INTEGER CHECK (revisions_included IS NULL OR revisions_included >= 0),
        start_date TEXT,
        due_date TEXT,
        waiting_since_date TEXT,
        health TEXT CHECK (health IS NULL OR health IN ('on_track','at_risk','blocked')),
        brief TEXT NOT NULL DEFAULT '',
        template_id TEXT,
        close_outcome TEXT CHECK (close_outcome IS NULL OR close_outcome IN ('completed','cancelled')),
        close_reason TEXT,
        stage_changed_at TEXT NOT NULL,
        delivered_at TEXT,
        closed_at TEXT,
        archived_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (due_date IS NULL OR start_date IS NULL OR due_date >= start_date)
      );
    `.execute(trx)

    await sql`
      CREATE TABLE project_milestones (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 200),
        position ${fType} NOT NULL,
        due_date TEXT,
        amount_minor INTEGER CHECK (amount_minor IS NULL OR amount_minor >= 0),
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','delivered','approved')),
        delivered_at TEXT,
        approved_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (status <> 'approved' OR approved_at IS NOT NULL)
      );
    `.execute(trx)

    await sql`
      CREATE TABLE project_tasks (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        milestone_id TEXT,
        title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 500),
        notes TEXT,
        kind TEXT NOT NULL DEFAULT 'task' CHECK (kind IN ('task','revision')),
        revision_round INTEGER CHECK (revision_round IS NULL OR revision_round >= 1),
        source_activity_id TEXT,
        due_date TEXT,
        focus_date TEXT,
        position ${fType} NOT NULL,
        completed_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (kind = 'revision' OR revision_round IS NULL)
      );
    `.execute(trx)

    await sql`
      CREATE TABLE invoices (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        milestone_id TEXT,
        number TEXT,
        label TEXT NOT NULL CHECK (length(trim(label)) BETWEEN 1 AND 200),
        amount_minor INTEGER NOT NULL CHECK (amount_minor BETWEEN 0 AND 2000000000),
        currency TEXT NOT NULL CHECK (length(currency) = 3),
        hours ${fType} CHECK (hours IS NULL OR hours >= 0),
        status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','void')),
        issue_date TEXT,
        due_date TEXT,
        paid_date TEXT,
        external_url TEXT,
        notes TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK (status <> 'paid' OR paid_date IS NOT NULL),
        CHECK (status NOT IN ('sent','paid') OR issue_date IS NOT NULL)
      );
    `.execute(trx)

    await sql`
      CREATE TABLE project_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
        billing_type TEXT NOT NULL CHECK (billing_type IN ('fixed','hourly','retainer')),
        payment_schedule TEXT NOT NULL DEFAULT 'none'
          CHECK (payment_schedule IN ('none','upfront_100','split_50_50','split_30_40_30','per_milestone','monthly')),
        duration_days INTEGER CHECK (duration_days IS NULL OR duration_days >= 0),
        revisions_included INTEGER CHECK (revisions_included IS NULL OR revisions_included >= 0),
        milestones_json TEXT NOT NULL DEFAULT '[]',
        tasks_json TEXT NOT NULL DEFAULT '[]',
        is_builtin INTEGER NOT NULL DEFAULT 0 CHECK (is_builtin IN (0,1)),
        position INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `.execute(trx)

    // Alter workspace_settings and activities
    await sql`ALTER TABLE workspace_settings ADD COLUMN invoice_net_days INTEGER NOT NULL DEFAULT 14;`.execute(trx)
    await sql`ALTER TABLE workspace_settings ADD COLUMN last_weekly_review_at TEXT;`.execute(trx)
    await sql`ALTER TABLE workspace_settings ADD COLUMN shortcut_overrides TEXT NOT NULL DEFAULT '{}';`.execute(trx)
    await sql`ALTER TABLE activities ADD COLUMN project_id TEXT;`.execute(trx)

    // Indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_stage ON projects(archived_at, stage_id);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_projects_company ON projects(company);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_milestones_project ON project_milestones(project_id, position);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_project ON project_tasks(project_id, completed_at, position);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_due ON project_tasks(completed_at, due_date);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_tasks_focus ON project_tasks(completed_at, focus_date);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_invoices_project ON invoices(project_id);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_invoices_status_due ON invoices(status, due_date);`.execute(trx)
    await sql`CREATE INDEX IF NOT EXISTS idx_activities_project ON activities(project_id);`.execute(trx)

    // Seed default stages
    const now = new Date().toISOString()
    const defaultStages = [
      { id: 'stg-planned', name: 'Planned', category: 'planned', position: 1, color: 'gray' },
      { id: 'stg-active', name: 'Active', category: 'active', position: 2, color: 'blue' },
      { id: 'stg-review', name: 'In Review', category: 'review', position: 3, color: 'amber' },
      { id: 'stg-delivered', name: 'Delivered', category: 'delivered', position: 4, color: 'violet' },
      { id: 'stg-closed', name: 'Closed', category: 'closed', position: 5, color: 'green' },
    ]

    for (const stg of defaultStages) {
      await trx
        .insertInto('project_stages')
        .values({
          id: stg.id,
          name: stg.name,
          category: stg.category as any,
          position: stg.position,
          color: stg.color,
          created_at: now as any,
          updated_at: now,
        })
        .execute()
    }

    // Seed built-in templates (§8.7)
    const builtInTemplates = [
      {
        id: 'tpl-blank',
        name: 'Blank',
        billing_type: 'fixed',
        payment_schedule: 'none',
        duration_days: null,
        revisions_included: null,
        milestones_json: JSON.stringify([]),
        tasks_json: JSON.stringify([]),
        is_builtin: 1,
        position: 1,
      },
      {
        id: 'tpl-website',
        name: 'Website build',
        billing_type: 'fixed',
        payment_schedule: 'split_50_50',
        duration_days: 35,
        revisions_included: 2,
        milestones_json: JSON.stringify([
          { title: 'Discovery', offsetDays: 5, amountPct: null },
          { title: 'Design', offsetDays: 15, amountPct: null },
          { title: 'Build', offsetDays: 30, amountPct: null },
          { title: 'Launch', offsetDays: 35, amountPct: null },
        ]),
        tasks_json: JSON.stringify([
          { title: 'Kickoff call', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Collect content and logins', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Sitemap', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Homepage design', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Inner page designs', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Build pages', milestoneIndex: 2, offsetDays: 0 },
          { title: 'Responsive QA', milestoneIndex: 2, offsetDays: 0 },
          { title: 'Launch checklist', milestoneIndex: 3, offsetDays: 0 },
          { title: 'Handover video', milestoneIndex: 3, offsetDays: 0 },
        ]),
        is_builtin: 1,
        position: 2,
      },
      {
        id: 'tpl-brand',
        name: 'Brand identity',
        billing_type: 'fixed',
        payment_schedule: 'split_30_40_30',
        duration_days: 21,
        revisions_included: 2,
        milestones_json: JSON.stringify([
          { title: 'Research', offsetDays: 5, amountPct: null },
          { title: 'Concepts', offsetDays: 14, amountPct: null },
          { title: 'Final files', offsetDays: 21, amountPct: null },
        ]),
        tasks_json: JSON.stringify([
          { title: 'Moodboard', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Three concepts', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Refine chosen concept', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Brand guidelines', milestoneIndex: 2, offsetDays: 0 },
          { title: 'Export asset pack', milestoneIndex: 2, offsetDays: 0 },
        ]),
        is_builtin: 1,
        position: 3,
      },
      {
        id: 'tpl-content',
        name: 'Content package',
        billing_type: 'fixed',
        payment_schedule: 'per_milestone',
        duration_days: 14,
        revisions_included: 1,
        milestones_json: JSON.stringify([
          { title: 'Outline', offsetDays: 3, amountPct: 20 },
          { title: 'Draft', offsetDays: 10, amountPct: 50 },
          { title: 'Final', offsetDays: 14, amountPct: 30 },
        ]),
        tasks_json: JSON.stringify([
          { title: 'Brief and keywords', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Outline', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Write draft', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Edit pass', milestoneIndex: 2, offsetDays: 0 },
          { title: 'SEO meta', milestoneIndex: 2, offsetDays: 0 },
          { title: 'Publish or hand off', milestoneIndex: 2, offsetDays: 0 },
        ]),
        is_builtin: 1,
        position: 4,
      },
      {
        id: 'tpl-consulting',
        name: 'Consulting engagement',
        billing_type: 'hourly',
        payment_schedule: 'none',
        duration_days: 21,
        revisions_included: null,
        milestones_json: JSON.stringify([
          { title: 'Discovery session', offsetDays: 3, amountPct: null },
          { title: 'Findings report', offsetDays: 14, amountPct: null },
          { title: 'Follow-up session', offsetDays: 21, amountPct: null },
        ]),
        tasks_json: JSON.stringify([
          { title: 'Pre-read', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Session agenda', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Write report', milestoneIndex: 1, offsetDays: 0 },
          { title: 'Present recommendations', milestoneIndex: 2, offsetDays: 0 },
        ]),
        is_builtin: 1,
        position: 5,
      },
      {
        id: 'tpl-retainer',
        name: 'Monthly retainer',
        billing_type: 'retainer',
        payment_schedule: 'monthly',
        duration_days: 30,
        revisions_included: null,
        milestones_json: JSON.stringify([
          { title: '{Month YYYY}', offsetDays: 30, amountPct: null },
        ]),
        tasks_json: JSON.stringify([
          { title: 'Monthly planning call', milestoneIndex: 0, offsetDays: 0 },
          { title: 'Monthly report', milestoneIndex: 0, offsetDays: 0 },
        ]),
        is_builtin: 1,
        position: 6,
      },
    ]

    for (const tpl of builtInTemplates) {
      await trx
        .insertInto('project_templates')
        .values({
          id: tpl.id,
          name: tpl.name,
          billing_type: tpl.billing_type as any,
          payment_schedule: tpl.payment_schedule as any,
          duration_days: tpl.duration_days,
          revisions_included: tpl.revisions_included,
          milestones_json: tpl.milestones_json,
          tasks_json: tpl.tasks_json,
          is_builtin: tpl.is_builtin,
          position: tpl.position,
          created_at: now as any,
          updated_at: now,
        })
        .execute()
    }
  },
}
