import { describe, it, before, beforeEach, after } from 'node:test'
import assert from 'node:assert/strict'
import { db } from '@/lib/db/client'
import { ensureDbInitialized } from '@/lib/db/init'
import * as repo from '@/lib/db/repository'

describe('Deal Win Probability Consistency Across Stages (#28)', () => {
  before(async () => {
    await ensureDbInitialized()
  })

  after(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
  })

  beforeEach(async () => {
    await db.deleteFrom('activities').execute()
    await db.deleteFrom('follow_ups').execute()
    await db.deleteFrom('deals').execute()
    await db.deleteFrom('contacts').execute()
    await db.deleteFrom('companies').execute()
  })

  it('updates deal probability to stage defaults when stage changes', async () => {
    // 1. Create a deal in 'Lead' stage (starts at 20%)
    const deal = await repo.createDeal({
      title: 'Consulting Project',
      company: 'Acme Corp',
      value: '50 000 Kč',
      rawAmount: 50000,
      stage: 'Lead',
      probability: '20%',
      next: 'Initial discovery call',
      color: 'blue',
    })
    assert.equal(deal.stage, 'Lead')
    assert.equal(deal.probability, '20%')

    // 2. Move deal to 'Proposal' stage -> default 70%
    const proposalDeal = await repo.moveDealStage(deal.id, 'Proposal')
    assert.ok(proposalDeal)
    assert.equal(proposalDeal.stage, 'Proposal')
    assert.equal(proposalDeal.probability, '70%')

    // Verify DB persistence
    const fetchedProposal = await repo.getDealById(deal.id)
    assert.ok(fetchedProposal)
    assert.equal(fetchedProposal.stage, 'Proposal')
    assert.equal(fetchedProposal.probability, '70%')

    // 3. Move deal to 'Qualified' stage -> default 40%
    const qualifiedDeal = await repo.moveDealStage(deal.id, 'Qualified')
    assert.ok(qualifiedDeal)
    assert.equal(qualifiedDeal.stage, 'Qualified')
    assert.equal(qualifiedDeal.probability, '40%')

    const fetchedQualified = await repo.getDealById(deal.id)
    assert.ok(fetchedQualified)
    assert.equal(fetchedQualified.stage, 'Qualified')
    assert.equal(fetchedQualified.probability, '40%')

    // 4. Move deal to 'Won' stage -> default 100%
    const wonDeal = await repo.moveDealStage(deal.id, 'Won')
    assert.ok(wonDeal)
    assert.equal(wonDeal.stage, 'Won')
    assert.equal(wonDeal.probability, '100%')

    const fetchedWon = await repo.getDealById(deal.id)
    assert.ok(fetchedWon)
    assert.equal(fetchedWon.stage, 'Won')
    assert.equal(fetchedWon.probability, '100%')

    // 5. Move deal to 'Paid' stage -> default 100%
    const paidDeal = await repo.moveDealStage(deal.id, 'Paid')
    assert.ok(paidDeal)
    assert.equal(paidDeal.stage, 'Paid')
    assert.equal(paidDeal.probability, '100%')

    // 6. Move back to 'Lead' stage -> default 20%
    const leadAgainDeal = await repo.moveDealStage(deal.id, 'Lead')
    assert.ok(leadAgainDeal)
    assert.equal(leadAgainDeal.stage, 'Lead')
    assert.equal(leadAgainDeal.probability, '20%')
  })
})
