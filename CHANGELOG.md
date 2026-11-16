# Changelog

## Unreleased

- Fix: `PUT /api/deals` and `PUT /api/contacts` with a partial body no longer blank the fields it leaves out.
- Fix: restoring a backup keeps each deal's created and updated dates (and the newest-first order).
- Fix: a client's deal count is counted from their deals instead of a counter that was never updated.
- Fix: an absolute `DATABASE_URL` like `file:/app/data/crm.db` no longer creates a stray `app/data` folder.
- Fix: the calendar feed skips deals waiting on the client and folds long lines by bytes.
- Fix: a failed save puts the screen back to what is stored; a client created with a deal shows up without a reload.
- Fix: a typed amount like `1500.50` is no longer saved as 150050; deal lists show the stored amount.
- Fix: impossible due dates (`2026-02-31`, `45.13.`) are rejected instead of rolling over; `po 22.9.` means the 22nd.
- Fix: `/api/health` answers 503 when the database is down, so the Docker healthcheck can fail.
- Security: CSV exports defuse spreadsheet formulas; a backup file can no longer set the passcode.

## 0.1.0 - 2026-11-05

First tagged release.

- One-page keyboard-first CRM with a single deal pipeline (CRM stages, then project stages).
- Per-deal project workspace: task board, client materials, invoices, notes.
- Home view with due, waiting and active projects.
- Backup and restore, `.ics` calendar feed, optional passcode.
- REST API (`/api/v1`) and MCP server (`/api/mcp`) with scoped tokens and audit log.
- SQLite by default, PostgreSQL optional. Docker image.
