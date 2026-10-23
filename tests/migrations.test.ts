import test from 'node:test'
import assert from 'node:assert/strict'
import { MIGRATIONS, runMigrations } from '@/lib/db/migrations'
import { floatType } from '@/lib/db/migrations/sql'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'

test('migrations-are-contiguous', () => {
  assert.ok(MIGRATIONS.length >= 3)
  for (let i = 0; i < MIGRATIONS.length; i++) {
    assert.equal(MIGRATIONS[i].version, i + 1, `Migration index ${i} should have version ${i + 1}`)
  }
})

test('postgres-ddl-uses-double-precision', () => {
  const pgFloat = floatType('postgres')
  assert.equal(pgFloat, 'DOUBLE PRECISION')
  const sqliteFloat = floatType('sqlite')
  assert.equal(sqliteFloat, 'REAL')
})

test('fresh-db-applies-all-migrations', async () => {
  await ensureDbInitialized()
  const rows = await db.selectFrom('schema_migrations').selectAll().execute()
  const versions = rows.map((r) => r.version).sort((a, b) => a - b)
  assert.ok(versions.includes(1))
  assert.ok(versions.includes(2))
  assert.ok(versions.includes(3))
})

test('existing-db-baseline-is-noop', async () => {
  // Running migrations when all are applied does not throw and modifies no versions
  await runMigrations(db)
  const rows = await db.selectFrom('schema_migrations').selectAll().execute()
  assert.equal(rows.length, 3)
})

test('rerun-is-idempotent', async () => {
  await runMigrations(db)
  await runMigrations(db)
  const rows = await db.selectFrom('schema_migrations').selectAll().execute()
  assert.equal(rows.length, 3)
})

test('default-stages-and-builtin-templates-seeded', async () => {
  await ensureDbInitialized()
  const stages = await db.selectFrom('project_stages').selectAll().orderBy('position', 'asc').execute()
  assert.equal(stages.length, 5)
  assert.deepEqual(
    stages.map((s) => s.id),
    ['stg-planned', 'stg-active', 'stg-review', 'stg-delivered', 'stg-closed']
  )

  const templates = await db.selectFrom('project_templates').selectAll().execute()
  const builtins = templates.filter((t) => t.is_builtin === 1)
  assert.equal(builtins.length, 6)
  const builtinIds = builtins.map((t) => t.id).sort()
  assert.deepEqual(builtinIds, [
    'tpl-blank',
    'tpl-brand',
    'tpl-consulting',
    'tpl-content',
    'tpl-retainer',
    'tpl-website',
  ])
})
