/** MCP prompts: short playbooks telling the agent which tools to call, in order */

interface PromptDef {
  name: string
  title: string
  description: string
  arguments?: { name: string; description: string; required?: boolean }[]
  render: (args: Record<string, string>) => string
}

export const MCP_PROMPTS: PromptDef[] = [
  {
    name: 'weekly_review',
    title: 'Weekly review',
    description: 'GTD-style weekly review of the pipeline and projects, ending with a short list of fixes to approve.',
    render: () => `Run a weekly review of my CRM.

1. Call get_today. List what is overdue, what is waiting on clients (and for how long), and deals missing a next action.
2. Call get_projects_overview. Flag blocked tasks, overdue invoices and late projects.
3. Call list_deals with side "crm". Point out leads and proposals with stale or vague next actions.
4. Propose concrete fixes: a next action with a due date for every deal under needsYou, chase dates for long waits, invoices to send.
5. Show the proposed changes as a short numbered list and ask me which to apply. Apply only what I approve, using set_next_action, set_waiting, add_invoice or update_invoice.

Keep the summary under 15 lines.`,
  },
  {
    name: 'triage_to_deals',
    title: 'Triage notes into deals',
    description: 'Turn pasted text (an email, call notes, a message) into CRM updates: new deals, notes, next actions.',
    arguments: [{ name: 'text', description: 'The email, message or notes to triage', required: true }],
    render: ({ text }) => `Triage this into my CRM:

"""
${text ?? ''}
"""

1. Identify the client (a person) and what they want.
2. Call search with the client's name and the topic. If a matching deal exists, plan updates to it; otherwise plan a new deal.
3. Plan the writes: create_deal (with next and nextDueDate), or add_note with a short summary plus set_next_action or set_waiting on the existing deal. Add client materials they promised as add_task with section "podklady".
4. Preview each write with dryRun: true, show me the plan in a few lines, and apply it after I confirm.`,
  },
  {
    name: 'draft_follow_up',
    title: 'Draft a follow-up email',
    description: 'Draft a short follow-up email to the client of a deal, based on its stage, notes and next action.',
    arguments: [{ name: 'deal', description: 'Deal id or name', required: true }],
    render: ({ deal }) => `Draft a follow-up email for the deal "${deal ?? ''}".

1. If this is not an id, call search to find the deal; ask me if several match.
2. Call get_deal. Read the stage, notes, next action, missing client materials (tasks with section "podklady") and open invoices.
3. Write a short, friendly email (under 120 words) in the language of the notes, with one clear ask.
4. Do not send anything and do not change the CRM. Afterwards, offer to log it with add_note and set a chase date with set_waiting or set_next_action.`,
  },
]

export function renderPrompt(name: string, args: Record<string, string>) {
  const prompt = MCP_PROMPTS.find((p) => p.name === name)
  if (!prompt) return null
  return {
    description: prompt.description,
    messages: [{ role: 'user' as const, content: { type: 'text' as const, text: prompt.render(args) } }],
  }
}
