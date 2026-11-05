import { DEAL_STAGES, DEAL_STAGE_HINTS, OPEN_DEAL_STAGES, BOARD_COLUMNS } from '@/lib/crm-types'

/**
 * The domain model and product rules, written for an agent. Served as
 * llms-full.txt, the MCP resource crm://rules and the MCP server instructions.
 */
export function rulesMarkdown(): string {
  const stages = DEAL_STAGES.map(
    (s, i) => `${i + 1}. **${s}** (${OPEN_DEAL_STAGES.includes(s) ? 'CRM' : 'PM'}): ${DEAL_STAGE_HINTS[s]}`
  ).join('\n')
  const columns = BOARD_COLUMNS.map((c) => `\`${c.id}\``).join(', ')

  return `# Freelancer CRM: model and rules

A single-operator CRM for a freelancer. One person runs it; the API acts on their behalf.

## Model

- **Client**: a person. There are no companies, teams or roles. Put company or role in the client's notes.
- **Deal**: one piece of work for one client, from first contact to finished project. Has a stage, an amount, a next action, Markdown notes, tasks and invoices.
- **Task**: a card on the deal's board. Columns: ${columns}. \`section: "podklady"\` = client materials (what the client owes you); otherwise it's your own work.
- **Invoice**: a payment milestone on a deal (Deposit, Progress, Final) with status Draft, Sent, Paid or Overdue.
- **Follow-up**: a standalone reminder. Rarely needed; deal next actions cover most cases.

## Pipeline (one pipeline, in order)

${stages}

**Closed** = contract signed. It is the handoff from selling (CRM) to delivering (PM). There is no Won, Lost or Paid stage. A lost lead is deleted or left with a note; a finished project is Completed.

## Rules

1. **Every deal has a next action and a due date**, unless it is **waiting on the client** (\`waiting: true\`). The API rejects writes that break this, with a hint.
2. Waiting deals show no next action and no warning. They sit in the Waiting group of get_today until you clear waiting.
3. Notes are the record. There is no activity log or feed. Append call summaries and decisions with add_note.
4. Money: send \`rawAmount\` as a number in the workspace currency. \`value\` is formatted for you.
5. Dates: ISO \`YYYY-MM-DD\`. Inputs also accept "today", "tomorrow", "in 3 days", weekday names.

## How to work

- Start with get_workspace (vocabulary) and get_today (what's due).
- Resolve names to ids with search before any write. If two results fit, ask the user.
- Preview risky changes with \`dryRun: true\` (REST: \`?dry_run=true\`).
- Send an \`Idempotency-Key\` header on REST writes you might retry.
- Errors return \`{ error: { code, message, field, hint } }\`. Follow the hint.
`
}
