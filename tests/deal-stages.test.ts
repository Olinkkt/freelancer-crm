import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { DEAL_STAGES, OPEN_DEAL_STAGES } from '@/lib/crm-types'
import { DealBackupSchema, DealCreateInputSchema } from '@/lib/validations'

describe('Deal stages', () => {
  it('pipeline is Lead · Qualified · Proposal · Won', () => {
    assert.deepEqual([...DEAL_STAGES], ['Lead', 'Qualified', 'Proposal', 'Won'])
    assert.deepEqual(OPEN_DEAL_STAGES, ['Lead', 'Qualified', 'Proposal'])
  })

  it('accepts every pipeline stage and rejects Paid/Lost on create', () => {
    for (const stage of DEAL_STAGES) {
      assert.ok(DealCreateInputSchema.safeParse({ title: 'X', contactName: 'Y', stage }).success, stage)
    }
    for (const stage of ['Paid', 'Lost', 'Discovery']) {
      assert.ok(!DealCreateInputSchema.safeParse({ title: 'X', contactName: 'Y', stage }).success, stage)
    }
  })

  it('maps legacy stages when restoring a backup', () => {
    const base = { id: 'd1', title: 'X', contactName: 'Y' }
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Paid' }).stage, 'Won')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Discovery' }).stage, 'Qualified')
    assert.equal(DealBackupSchema.parse({ ...base, stage: 'Proposal' }).stage, 'Proposal')
  })
})
