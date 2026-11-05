# REST API

Every CRM action an agent needs is available at `/api/v1`. The same operations are MCP tools (see [mcp.md](mcp.md)).

- **Reference:** `/api/docs` (interactive), `/api/v1/openapi.json` (OpenAPI 3.1)
- **For agents:** `/llms.txt` (index) and `/llms-full.txt` (model, rules and every operation in one file)

## Auth

1. Open **Settings → API**, name the token, tick **Can make changes** only if the agent must write.
2. Copy the token (`fcrm_…`). It is shown once; only a hash is stored.
3. Send it on every request:

```sh
export CRM=http://localhost:3000/api/v1
export TOKEN=fcrm_...
curl -H "Authorization: Bearer $TOKEN" $CRM/today
```

- A read token gets `403 insufficient_scope` on any write.
- Revoking a token in Settings stops it at once.
- The passcode and `AUTH_SECRET` are **not** accepted on `/api/v1`. The older `/api/deals`, `/api/contacts` and `/api/follow-ups` routes are unchanged.
- In the browser, the operator session cookie also works (that's how the docs "Try it" button works when you're logged in).

## Conventions

| What | How |
|---|---|
| Path params | in the URL: `/deals/{id}/tasks/{taskId}` |
| Filters (GET) | query string; arrays comma-separated: `?stage=Lead,Qualified` |
| Writes | JSON body (`POST`, `PATCH`) |
| Dates | ISO `YYYY-MM-DD`; `today`, `tomorrow`, `in 3 days`, `friday` also work |
| Money | `rawAmount` as a number in the workspace currency; `value` is formatted for you |
| Pagination | `?limit=50&cursor=…`; pass `nextCursor` back until it is `null` |
| Preview | `?dry_run=true` or `"dryRun": true`: validates and returns the would-be result, saves nothing |
| Retries | `Idempotency-Key: <uuid>` header on writes; a repeat within 24 h returns the first response |
| Rate limit | 120 requests/minute per token (`API_RATE_LIMIT_PER_MINUTE` to change) |

Errors always look like this. Follow the `hint`:

```json
{ "error": { "code": "validation_failed", "message": "Every deal needs a next action", "field": "next",
  "hint": "Pass next (what you do next) and nextDueDate, or set waiting: true if the client owes you something." } }
```

Codes: `unauthorized` 401, `insufficient_scope` 403, `not_found` 404, `validation_failed` 400, `conflict` 409, `rate_limited` 429.

## Rules the API enforces

- Clients are people. There are no companies.
- One pipeline: Lead → Qualified → Proposal → **Closed** (contract signed) → Deposit → Materials → Build → Handoff → Revisions → Completed.
- Every deal needs a next action with a due date, unless `waiting` is true (waiting on the client).

## Audit log

Every write made through `/api/v1` or MCP is stored in the `api_audit_log` table: token, operation, before and after, dry run flag. There is no UI for it yet. Read it with `sqlite3 data/crm.db "select at, operation, entity_id from api_audit_log order by at desc limit 20"`.

## Recipes

### Log a new lead

```sh
curl -X POST $CRM/deals -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"title":"Portfolio website","contactName":"Jana Nováková","contactEmail":"jana@example.com",
       "rawAmount":45000,"next":"Send proposal","nextDueDate":"friday"}'
```

The client is matched by email or name, or created.

### What's due today

```sh
curl -H "Authorization: Bearer $TOKEN" $CRM/today
```

Returns `due`, `waiting`, `needsYou` and `upcoming`, the same groups as the Home screen.

### Contract signed: move to Closed

```sh
# Preview first
curl -X POST "$CRM/deals/$DEAL/stage?dry_run=true" -H "Authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"stage":"Closed","next":"Send deposit invoice","nextDueDate":"tomorrow"}'
# Then for real (same request without dry_run)
```

Omit `stage` to move one stage forward.

### Add a task, then finish it

```sh
curl -X POST $CRM/deals/$DEAL/tasks -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"title":"Homepage design"}'
curl -X PATCH $CRM/deals/$DEAL/tasks/$TASK -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"column":"done"}'
```

Use `"section":"podklady"` for client materials (what the client owes you).

### Record a deposit invoice and mark it paid

```sh
curl -X POST $CRM/deals/$DEAL/invoices -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"type":"Deposit","percentage":50,"dueDate":"in 7 days"}'
curl -X PATCH $CRM/deals/$DEAL/invoices/$INVOICE -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"status":"Paid"}'
```

## For contributors

Operations are defined once in `lib/api/operations.ts`. REST routing (`lib/api/rest.ts`), the OpenAPI spec (`lib/api/openapi.ts`), `llms-full.txt` and MCP tools (`lib/mcp/server.ts`) are generated from that list. To add an endpoint, add an operation; `tests/openapi.test.ts` fails if the spec and router drift.
