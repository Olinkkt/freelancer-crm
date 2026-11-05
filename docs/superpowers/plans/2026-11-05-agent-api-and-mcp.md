# Agent-ready API, docs and MCP

Goal: an AI agent can read and operate the CRM safely through a documented REST API and an MCP server, with per-token scopes and a hidden audit log.

## Decisions (settled)

- MCP ships as **both** a hosted HTTP endpoint (`/api/mcp`) and a stdio package that proxies to the REST API.
- **Per-token scopes** (`read`, `write`). A token with `read` can never write.
- **Audit log** records every write made with an API token. No UI for it yet (DB + repository function only).
- Product rules in `CLAUDE.md` stay in force: clients are people, one `DEAL_STAGES` pipeline, next action + due date or `waiting`, no activities feed.

## Findings from the code

- Auth today: `checkIsAuthenticated(req)` accepts the **raw passcode / `AUTH_SECRET` as a bearer or `x-api-key`**. No scopes, no revocation, no per-client identity. Agents must not use this.
- REST exists for deals, contacts, follow-ups, backup, calendar feed, health. Routes call the repository directly and use `DealCreateInputSchema` etc.
- Tasks (`deliverables`), invoices and notes are **JSON/columns on the deal**, not separate tables. Granular endpoints are thin wrappers over `updateDeal` / `setDealChecklist`. No new tables for them.
- `deliverables` and `invoices` are typed `z.array(z.any())` in `lib/validations/index.ts`. OpenAPI would show `any`. Must be tightened first.
- Server actions in `app/actions/crm.ts` contain almost no logic (169 lines), so a services layer is a small move, not a rewrite.
- Schema is at `SCHEMA_VERSION = 15`. New tables go in `lib/db/init.ts` and bump to 16.

## Architecture

One operation registry. Each operation defines: `name`, `scope`, zod `input`, zod `output`, `handler`, LLM-facing `description`, `destructive` flag.

```
repository.ts -> lib/api/operations/*.ts (registry)
                     |-> app/api/v1/*            REST (generic dispatcher + explicit routes)
                     |-> app/api/v1/openapi.json generated from registry
                     |-> app/api/mcp             MCP tools generated from registry
                     |-> packages/mcp-stdio      proxy to REST
```

Existing `/api/deals` etc. stay untouched (UI and old clients use them). New surface lives under `/api/v1`.

---

## Phase 1: tokens, scopes, audit, operations (~1 day)

**1.1 Schema v16** (`lib/db/init.ts`, `lib/db/schema.ts`)
- `api_tokens`: `id`, `name`, `token_hash` (sha256), `prefix` (first 8 chars for display), `scopes` (`read` | `read,write`), `created_at`, `last_used_at`, `revoked_at`.
- `api_audit_log`: `id`, `at`, `token_id`, `operation`, `entity_type`, `entity_id`, `before` (JSON), `after` (JSON), `request_id`, `dry_run`.
- Bump `SCHEMA_VERSION` to 16. Idempotent create, same style as existing steps.

**1.2 Token repository** (`lib/db/repository.ts` or `lib/db/api-tokens.ts`)
- `createApiToken({name, scopes})` returns the plaintext **once** (`fcrm_` + 32 random bytes base64url).
- `verifyApiToken(plain)` looks up by hash, rejects revoked, updates `last_used_at`.
- `listApiTokens()`, `revokeApiToken(id)`, `listAuditLog({tokenId?, since?, limit})`.

**1.3 Auth for v1** (`lib/auth/api-auth.ts`)
- `authenticateApi(req)` returns `{kind: 'token', tokenId, scopes} | {kind: 'operator'}` or null. Order: `Authorization: Bearer fcrm_…` token first, then the existing operator session (so the browser and the docs page "Try it" keep working).
- `requireScope(principal, 'write')` returns 403 `insufficient_scope`.
- v1 does **not** accept the raw passcode as bearer.
- If auth is disabled (no secret, no passcode), v1 stays open like today, but tokens still work.

**1.4 Settings UI for tokens** (minimal, `components/settings/`)
- Create token (name + read/write), show plaintext once, list with prefix and last used, revoke. Audit log has no UI.
- Server actions: `createApiTokenAction`, `revokeApiTokenAction`, `listApiTokensAction`, each behind `assertAuth()`.

**1.5 Tighten schemas** (`lib/validations/index.ts`, move shared bits to `lib/api/schemas.ts`)
- Real zod types for `DeliverableItem` (with `section`, board column fields from `lib/crm-types.ts`) and `Invoice`. Replace `z.any()`.
- Output schemas: `Deal`, `Contact`, `FollowUp`, `WorkspaceSettings` (without `passcodeHash`), `Error`.
- Verify existing `tests/api-routes.test.ts` and `backup-api.test.ts` still pass (backup keeps its lenient schema).

**1.6 Operation registry** (`lib/api/operations/`)

| Operation | Scope | Notes |
|---|---|---|
| `get_workspace` | read | settings (currency, locale), stage list, counts |
| `get_today` | read | wraps `buildToday` |
| `get_projects_overview` | read | wraps `buildProjects` |
| `search` | read | deals + clients, uses `lib/fuzzy.ts` |
| `list_deals` | read | filters: `stage`, `waiting`, `contactId`, `updatedSince`; cursor pagination |
| `get_deal` | read | by id or slug |
| `create_deal` | write | enforces next action + due date or `waiting` |
| `update_deal` | write | partial |
| `advance_deal_stage` | write | `moveDealStage`; marks `destructive` for → Closed (handoff) |
| `set_next_action` | write | `next` + `nextDueDate`, clears `waiting` |
| `set_waiting` | write | `waiting` + `waitingSince` |
| `add_task` / `update_task` / `move_task` | write | edits `deliverables` on a deal, validates `BOARD_COLUMNS` |
| `add_note` / `set_notes` | write | `deal.notes`, append vs replace |
| `add_invoice` / `update_invoice` | write | `invoices` JSON, money via `raw_amount` |
| `list_clients` / `get_client` | read | |
| `create_client` / `update_client` | write | |
| `delete_deal` / `delete_client` | write | `destructive` |
| `list_follow_ups`, `create_follow_up`, `toggle_follow_up` | read/write | |

Each write handler runs through a wrapper that: checks scope, supports `dry_run` (run in a transaction and roll back, or compute the diff without writing), captures `before`/`after`, writes the audit row, and honors `Idempotency-Key`.

**1.7 Idempotency** (small table `api_idempotency`: `key`, `token_id`, `operation`, `response`, `created_at`, 24 h TTL) or reuse the audit table keyed by `(token_id, key)`. Prefer reuse to avoid a third table.

**1.8 Error model** (`lib/api/errors.ts`)
- `{ error: { code, message, field?, hint? } }`. Codes: `unauthorized`, `insufficient_scope`, `not_found`, `validation_failed`, `conflict`, `rate_limited`.
- `hint` tells the agent what to do next ("Deal has no next action; pass `next` and `nextDueDate` or set `waiting: true`").
- Reuse `sanitizeErrorMessage` so DB errors never leak.

**1.9 REST routes** (`app/api/v1/`)
- Resource-style routes backed by the registry: `GET/POST /deals`, `GET/PATCH/DELETE /deals/:id`, `POST /deals/:id/advance`, `/next-action`, `/waiting`, `/tasks`, `/tasks/:taskId`, `/notes`, `/invoices`; `/clients…`; `/follow-ups…`; `GET /today`, `/projects`, `/search`, `/workspace`.
- Small helper `route(op)` so each route file is ~5 lines.
- Basic rate limit per token (in-memory token bucket, 120 req/min default). Single-operator app, so no Redis.

**1.10 Tests** (`tests/api-v1.test.ts`, `tests/api-tokens.test.ts`)
- Token create/verify/revoke, hash-only storage, read token blocked on write (403), revoked token (401).
- Each operation happy path + one validation failure.
- Audit row written for writes, not for reads; `dry_run` writes nothing to deals but is logged as `dry_run`.
- Idempotent retry returns the same response, one audit row.

**Done when:** `curl -H "Authorization: Bearer fcrm_…" /api/v1/today` works, a read token gets 403 on `POST /api/v1/deals`, `pnpm test` and `npx tsc --noEmit -p .` pass.

---

## Phase 2: OpenAPI + docs + llms.txt (~half day)

1. **Generator** (`lib/api/openapi.ts`): walk the registry, use zod 4 `z.toJSONSchema` for input/output, emit OpenAPI 3.1. Include `securitySchemes` (bearer), per-operation `x-required-scope`, error responses, and at least one request example per write operation.
2. **Serve:** `GET /api/v1/openapi.json` (public, no data in it).
3. **Docs page:** `/api/docs` route handler returning HTML with Scalar (CDN, pinned version). Public. "Try it" works with a pasted token.
4. **LLM docs** (`app/llms.txt/route.ts`, `app/llms-full.txt/route.ts`, generated at request time from the registry + a static rules section):
   - `llms.txt`: index with links to openapi, docs, MCP doc.
   - `llms-full.txt`: domain model (clients are people, stage list from `DEAL_STAGES`, next action rule, waiting), every operation with description, auth, error codes.
5. **Auth gate:** the passcode/session gate must not block `/api/docs`, `openapi.json`, `llms*.txt`. Check how the current gate treats unauthenticated routes first.
6. **Drift test** (`tests/openapi.test.ts`): every registry op appears in the spec, every spec path has a route file, spec validates (`@apidevtools/swagger-parser` as a devDependency).
7. **`docs/api.md`:** 5 recipes with curl: log a lead, what's due today, advance to Closed, add a task, record an invoice.

**Done when:** `/api/docs` renders every operation, and the drift test passes.

---

## Phase 3: MCP server over HTTP (~half day)

1. **Dependency:** `@modelcontextprotocol/sdk` (verify current version and the Streamable HTTP transport API from its docs before coding; do not rely on memory).
2. **Endpoint** `app/api/mcp/route.ts`: stateless Streamable HTTP (fresh server per request, fits Next route handlers and the standalone build). Auth via the same bearer token. No session = 401 with `WWW-Authenticate`.
3. **Tools:** generated from the registry, but curated for LLMs (target 14 to 16, not one per endpoint):
   - read: `get_today`, `get_projects_overview`, `search`, `list_deals`, `get_deal`, `list_clients`, `get_workspace`
   - write: `create_deal`, `update_deal`, `advance_deal_stage`, `set_next_action`, `set_waiting`, `add_task`, `move_task`, `add_note`, `add_invoice`, `create_client`
   - Registry flag `mcp: false` hides rarely-useful ops (delete, follow-up CRUD) from MCP while keeping them in REST.
4. **Annotations:** `readOnlyHint` for read ops, `destructiveHint` for stage→Closed and deletes, `idempotentHint` where true.
5. **Scopes:** tools/list only returns tools the token may call. Calls re-check the scope anyway.
6. **Resources:** `crm://rules` (product rules + stage meanings), `crm://pipeline` (stages with CRM/PM side), `crm://today`, `crm://deal/{id}`.
7. **Prompts:** `weekly_review`, `triage_to_deals`, `draft_follow_up`. Short templates that tell the agent which tools to call in order.
8. **Errors:** tool errors return `isError: true` with the same `{code, message, hint}` text so the agent can self-correct.
9. **Audit:** MCP calls go through the same wrapper; `operation` is recorded, plus `via: 'mcp'` in a column or in `request_id` prefix.
10. **Tests** (`tests/mcp.test.ts`): call the handler in-process with the SDK client over an in-memory transport. Check: `tools/list` differs by scope, write tool with read token fails, `dry_run` works, resources readable.

**Done when:** `claude mcp add --transport http freelancer-crm http://localhost:3000/api/mcp --header "Authorization: Bearer fcrm_…"` works and Claude can run "what's due today" and "move X to Proposal".

---

## Phase 4: stdio package, MCP docs, polish (~half day)

1. **Package** `packages/mcp-stdio/` (own `package.json`, name `freelancer-crm-mcp`, bin). Reads `CRM_URL` and `CRM_TOKEN` env. Fetches `/api/v1/openapi.json` or reuses a shared tool list, and proxies each tool call to REST. No DB access, so it works against local or hosted instances. Pin the same SDK version.
   - Check `pnpm-workspace.yaml` first. Adding a package may need a workspace entry. Keep it out of the Next build (not imported by the app, excluded from `tsconfig` include).
2. **`docs/mcp.md`:** copy-paste config for Claude Code (`claude mcp add`), Claude Desktop (`claude_desktop_config.json` for stdio), Cursor. Covers token creation, scopes, which tools exist, the `dry_run` pattern, and security notes (use a read token for exploration; hosted instances need HTTPS).
3. **README section** linking `docs/api.md`, `docs/mcp.md`, `/api/docs`.
4. **Tool description pass:** read every description aloud as an agent: when to use, when not, what it returns, one example. Add the "ask, don't guess" rule: if the client is ambiguous, call `search` first.
5. **Smoke test** against a copy of `data/crm.db` (see `CLAUDE.md` gotchas): real agent session doing a weekly review with a read token, then one write with a write token. Check the audit rows afterward.
6. **Changelog/version:** `feat(api)` commits → minor. Add `CHANGELOG.md` entry if the project is versioned (currently `0.1.0`, no tags).

**Done when:** `npx freelancer-crm-mcp` works in Claude Desktop against a running instance.

---

## Commit plan (one logical change each)

1. `feat(db): add api tokens and audit log tables`
2. `feat(auth): scoped api token authentication`
3. `feat(settings): manage api tokens`
4. `refactor(validations): type deliverables and invoices`
5. `feat(api): operation registry and v1 routes`
6. `feat(api): idempotency, dry run and audit`
7. `feat(api): openapi spec, docs page and llms.txt`
8. `feat(mcp): http endpoint with tools, resources, prompts`
9. `feat(mcp): stdio proxy package`
10. `docs: api and mcp guides`

## Risks

- **Auth gate blocking public docs routes:** verify before phase 2.
- **Stateless MCP on `output: 'standalone'`:** if the SDK transport needs sessions, fall back to a per-request transport. Spike in the first hour of phase 3.
- **Postgres parity:** new tables and queries must work on both libsql and Postgres. Run tests against both if a Postgres URL is available.
- **`dry_run` semantics:** transaction rollback is simplest on both drivers; confirm Kysely transaction support with libsql.
- **Leaking secrets:** never return `passcodeHash`, the calendar feed token or token hashes from any operation. Add a test that scans `get_workspace` output.

## Out of scope (for now)

- Audit log UI, webhooks, OAuth for MCP (bearer tokens only), per-resource scopes, multi-user.
