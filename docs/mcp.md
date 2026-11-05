# MCP server

Connect Claude, Cursor or any MCP client to the CRM. Two ways, same tools:

| | When | Endpoint |
|---|---|---|
| **HTTP** (recommended) | The client supports remote MCP servers | `https://your-crm/api/mcp` (Streamable HTTP) |
| **stdio** | The client only runs local commands (e.g. Claude Desktop config) | `packages/mcp-stdio`, proxies to the HTTP endpoint |

## 1. Create a token

**Settings → API → Create token.** Start read-only. Tick **Can make changes** once you trust the agent. The token (`fcrm_…`) is shown once. After creating one, the page also shows a ready-to-paste `claude mcp add` command.

## 2. Connect

### Claude Code

```sh
claude mcp add --transport http freelancer-crm http://localhost:3000/api/mcp \
  --header "Authorization: Bearer fcrm_..."
```

### Claude Desktop (stdio)

`claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "freelancer-crm": {
      "command": "node",
      "args": ["/path/to/freelancer-crm/packages/mcp-stdio/index.mjs"],
      "env": { "CRM_URL": "http://localhost:3000", "CRM_TOKEN": "fcrm_..." }
    }
  }
}
```

Run `pnpm install` in the repo first so the SDK is available. Once the package is published to npm, `"command": "npx", "args": ["-y", "freelancer-crm-mcp"]` works too.

### Cursor

`.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "freelancer-crm": {
      "url": "http://localhost:3000/api/mcp",
      "headers": { "Authorization": "Bearer fcrm_..." }
    }
  }
}
```

## Tools

A read-only token sees only the read tools. Write tools are hidden and refused.

| Read | Write |
|---|---|
| `get_today`: what's due, waiting, missing a next action | `create_deal` |
| `get_projects_overview`: projects needing attention | `update_deal` |
| `search`: resolve a name to an id | `advance_deal_stage` (Closed = contract signed) |
| `list_deals` | `set_next_action` |
| `get_deal` | `set_waiting` |
| `list_clients` | `add_note` |
| `get_client` | `add_task`, `update_task`, `delete_task` |
| `get_workspace`: currency, stages, columns | `add_invoice`, `update_invoice` |
| | `create_client`, `update_client` |

Deleting deals and clients, and follow-up reminders, are REST-only on purpose.

Every write tool takes `dryRun: true`: it validates and returns the would-be result without saving. Errors come back as `isError` with `{ code, message, field, hint }`.

## Resources

- `crm://rules`: the model and the rules writes must follow. Agents should read it first.
- `crm://pipeline`: stages in order with their meaning, and board columns.
- `crm://today`: same as `get_today`.
- `crm://deal/{id}`: one deal.

## Prompts

- `weekly_review`: review pipeline and projects, propose fixes, apply only what you approve.
- `triage_to_deals` (`text`): turn an email or call notes into deal updates, previewed with dry run.
- `draft_follow_up` (`deal`): draft a follow-up email from a deal's notes and state. Changes nothing.

## Security

- Use a read-only token to explore. Give write access per agent, and revoke tokens you no longer use.
- On a hosted instance, use HTTPS. The token is a bearer credential.
- Every write through MCP is recorded in the audit log (`api_audit_log`, marked `via = 'mcp'`).
- When the workspace has no passcode, `/api/mcp` is as open as the rest of the app. Set a passcode before exposing it to a network.

## How it works

`/api/mcp` is stateless: each request builds a server bound to the caller's token (`lib/mcp/server.ts`). Tools are generated from the same operation list as the REST API (`lib/api/operations.ts`), so validation, scopes, dry run and the audit log behave the same in both. The stdio package holds no logic; it forwards every request to `/api/mcp`.
