import test from 'node:test'
import assert from 'node:assert/strict'
import {
  suggestOnDealWon,
  suggestOnInvoicePaid,
  suggestOnMilestoneDelivered,
  suggestOnFeedbackLogged,
  suggestOnMilestoneApproved,
  getSuggestionToastText,
} from '@/lib/projects/suggestions'
import { parseQuickAdd } from '@/lib/projects/quick-add'
import { splitFeedback, calculateRevisionRound } from '@/lib/projects/feedback'
import {
  positionBetween,
  isGapTooSmall,
  renormalisePositions,
  POSITION_STEP,
} from '@/lib/projects/position'
import { scheduleInvoices, projectMoney, isOverdue } from '@/lib/projects/money'
import {
  saveAsTemplate,
  buildNextMonthRetainer,
  buildTemplateGraph,
} from '@/lib/projects/templates'
import { buildToday } from '@/lib/projects/today'
import { isReviewDue, buildWeeklyReview } from '@/lib/projects/review'
import { addDays } from '@/lib/projects/dates'

test('Project Domain Rules & Pure Functions', async (t) => {
  const today = '2026-10-24'

  await t.test('Suggestions Generator covers S1–S8 with synthetic fixtures', () => {
    // S1: Deal won -> start_project
    const s1 = suggestOnDealWon({ id: 'deal-1', projectId: null })
    assert.deepEqual(s1, { kind: 'start_project', dealId: 'deal-1' })
    assert.equal(getSuggestionToastText(s1!), 'Deal won. Start a project?')
    assert.equal(suggestOnDealWon({ id: 'deal-1', projectId: 'prj-1' }), null)

    // S2: Invoice paid on planned project -> kick_off
    const s2 = suggestOnInvoicePaid({ id: 'prj-1' }, { category: 'planned' }, [])
    assert.deepEqual(s2, { kind: 'kick_off', projectId: 'prj-1' })
    assert.equal(getSuggestionToastText(s2!), 'Payment received. Kick off the project?')

    // S3: Milestone delivered on active project -> move_to_review
    const s3 = suggestOnMilestoneDelivered({ id: 'prj-1' }, { category: 'active' })
    assert.deepEqual(s3, { kind: 'move_to_review', projectId: 'prj-1' })
    assert.equal(getSuggestionToastText(s3!), 'Sent to client. Move to In Review?')
    assert.equal(suggestOnMilestoneDelivered({ id: 'prj-1' }, { category: 'review' }), null)

    // S4: Feedback logged on review project -> back_to_active
    const s4 = suggestOnFeedbackLogged({ id: 'prj-1' }, { category: 'review' })
    assert.deepEqual(s4, { kind: 'back_to_active', projectId: 'prj-1' })
    assert.equal(getSuggestionToastText(s4!), 'Feedback logged. Back to Active?')
    assert.equal(suggestOnFeedbackLogged({ id: 'prj-1' }, { category: 'active' }), null)

    // S5: Milestone approved (fixed/retainer) -> create_invoice
    const s5 = suggestOnMilestoneApproved(
      { id: 'prj-1', billingType: 'fixed' },
      { category: 'active' },
      { id: 'ms-1', amountMinor: 50000 },
      [{ id: 'ms-1', status: 'approved' }],
      []
    )
    assert.deepEqual(s5, {
      kind: 'create_invoice',
      projectId: 'prj-1',
      milestoneId: 'ms-1',
      amountMinor: 50000,
    })
    assert.equal(
      getSuggestionToastText(s5!, { milestoneTitle: 'Design', formattedAmount: '500,00 Kč' }),
      "Approved. Create invoice 'Design' 500,00 Kč?"
    )

    // S6: Milestone approved (hourly) -> bill_hours
    const s6 = suggestOnMilestoneApproved(
      { id: 'prj-1', billingType: 'hourly' },
      { category: 'active' },
      { id: 'ms-1', amountMinor: null },
      [{ id: 'ms-1', status: 'approved' }],
      []
    )
    assert.deepEqual(s6, {
      kind: 'bill_hours',
      projectId: 'prj-1',
      milestoneId: 'ms-1',
    })
    assert.equal(
      getSuggestionToastText(s6!, { milestoneTitle: 'Consulting' }),
      "Approved. Bill hours for 'Consulting'?"
    )

    // S7: All milestones approved -> mark_delivered
    const s7 = suggestOnMilestoneApproved(
      { id: 'prj-1', billingType: 'fixed' },
      { category: 'active' },
      { id: 'ms-2', amountMinor: null },
      [
        { id: 'ms-1', status: 'approved' },
        { id: 'ms-2', status: 'approved' },
      ],
      []
    )
    assert.deepEqual(s7, {
      kind: 'mark_delivered',
      projectId: 'prj-1',
    })
    assert.equal(getSuggestionToastText(s7!), 'All milestones approved. Mark delivered?')

    // S8: Invoice paid on delivered project and no open invoices -> close_project
    const s8 = suggestOnInvoicePaid(
      { id: 'prj-1' },
      { category: 'delivered' },
      [{ id: 'inv-1', status: 'paid' }, { id: 'inv-2', status: 'void' }]
    )
    assert.deepEqual(s8, { kind: 'close_project', projectId: 'prj-1' })
    assert.equal(getSuggestionToastText(s8!), 'All paid. Close the project?')

    // Delivered project with remaining sent/draft invoice should not suggest close
    const s8Blocked = suggestOnInvoicePaid(
      { id: 'prj-1' },
      { category: 'delivered' },
      [{ id: 'inv-1', status: 'paid' }, { id: 'inv-2', status: 'sent' }]
    )
    assert.equal(s8Blocked, null)
  })

  await t.test('Quick-add parser (§8.5)', () => {
    const milestones = [
      { id: 'ms-launch', title: 'Launch' },
      { id: 'ms-build', title: 'Build phase' },
    ]

    // 1. Full combination with !, #tag and weekday
    // Note: today is 2026-10-24 (Saturday). Next Friday is 2026-10-30.
    const q1 = parseQuickAdd('Fix footer links fri #launch !', { today, milestones })
    assert.equal(q1.title, 'Fix footer links')
    assert.equal(q1.focusToday, true)
    assert.equal(q1.milestoneId, 'ms-launch')
    assert.equal(q1.dueDate, '2026-10-30')

    // 2. Tomorrow
    const q2 = parseQuickAdd('Call Jana tomorrow', { today, milestones })
    assert.equal(q2.title, 'Call Jana')
    assert.equal(q2.dueDate, '2026-10-25')
    assert.equal(q2.focusToday, false)
    assert.equal(q2.milestoneId, null)

    // 3. Next week (2 words date phrase)
    // 2026-10-24 is Sat -> next Monday is 2026-10-26.
    const q3 = parseQuickAdd('Plan Q4 next week', { today, milestones })
    assert.equal(q3.title, 'Plan Q4')
    assert.equal(q3.dueDate, '2026-10-26')

    // 4. Relative offset +3d and Czech zitra
    const q4 = parseQuickAdd('Deploy release +3d', { today, milestones })
    assert.equal(q4.title, 'Deploy release')
    assert.equal(q4.dueDate, '2026-10-27')

    const q5 = parseQuickAdd('Pripravit podklady zitra', { today, milestones })
    assert.equal(q5.title, 'Pripravit podklady')
    assert.equal(q5.dueDate, '2026-10-25')

    // 5. Unmatched hashtag stays in title
    const q6 = parseQuickAdd('Check issue #123 !', { today, milestones })
    assert.equal(q6.title, 'Check issue #123')
    assert.equal(q6.focusToday, true)
    assert.equal(q6.milestoneId, null)

    // 6. Empty title throws VALIDATION
    assert.throws(() => parseQuickAdd('! fri', { today, milestones }), (err: any) => {
      return err.code === 'VALIDATION'
    })
  })

  await t.test('Feedback splitter (§8.6)', () => {
    // 1. Quoted reply and email headers stripped
    const emailText = `
Here is the feedback:
- Fix header contrast
- Make logo bigger
- Add phone number to footer

On Thu, Oct 22, 2026 at 10:00 AM Client wrote:
> This was previous thread
> More quoted stuff

-- 
John Doe
Acme Corp
`
    const items1 = splitFeedback(emailText)
    assert.deepEqual(items1, [
      'Fix header contrast',
      'Make logo bigger',
      'Add phone number to footer',
    ])

    // 2. Markdown headings, numbered lists, checkboxes, and bullet markers
    const complexList = `
# Header 1: Visual design
1. Change hero image
2) Update pricing table font
- [ ] Add refund policy link
* [x] Verify mobile navigation
• Add testimonial slider
- Fix alignment on contact form
`
    const items2 = splitFeedback(complexList)
    assert.deepEqual(items2, [
      'Header 1: Visual design',
      'Change hero image',
      'Update pricing table font',
      'Add refund policy link',
      'Verify mobile navigation',
      'Add testimonial slider',
      'Fix alignment on contact form',
    ])

    // 3. Fallback to sentence splitting when no list markers
    const plainParagraph = 'The logo looks small. Can we make it pop more? Please also test the checkout!'
    const items3 = splitFeedback(plainParagraph)
    assert.deepEqual(items3, [
      'The logo looks small.',
      'Can we make it pop more?',
      'Please also test the checkout!',
    ])

    // 4. Deduplication and cap at 50
    const duplicateList = `
- Item A
- Item B
- item a
- Item C
`
    const items4 = splitFeedback(duplicateList)
    assert.deepEqual(items4, ['Item A', 'Item B', 'Item C'])

    // 5. Revision round calculation
    const tasks = [
      { revisionRound: 1 },
      { revisionRound: 2 },
      { revisionRound: null },
    ]
    const r1 = calculateRevisionRound(tasks, 2)
    assert.equal(r1.round, 3)
    assert.equal(r1.overScope, true)

    const r2 = calculateRevisionRound(tasks, 5)
    assert.equal(r2.round, 3)
    assert.equal(r2.overScope, false)
  })

  await t.test(
    'Lexorank-style position assignment produces monotonic sort orders across 1,000 synthetic inserts with renormalise-on-demand',
    () => {
      let items: Array<{ id: string; position: number }> = [
        { id: 'item-0', position: POSITION_STEP },
        { id: 'item-1', position: POSITION_STEP * 2 },
      ]

      for (let i = 2; i < 1000; i++) {
        // Randomly pick an insertion index between 0 and items.length
        const insertIdx = Math.floor(Math.random() * (items.length + 1))
        const beforePos = insertIdx > 0 ? items[insertIdx - 1].position : null
        const afterPos = insertIdx < items.length ? items[insertIdx].position : null

        let newPos = positionBetween(beforePos, afterPos)

        if (isGapTooSmall(beforePos, afterPos)) {
          // Renormalise on demand
          items = renormalisePositions(items)
          const newBefore = insertIdx > 0 ? items[insertIdx - 1].position : null
          const newAfter = insertIdx < items.length ? items[insertIdx].position : null
          newPos = positionBetween(newBefore, newAfter)
        }

        const newItem = { id: `item-${i}`, position: newPos }
        items.splice(insertIdx, 0, newItem)
      }

      assert.equal(items.length, 1000)

      // Verify strict monotonic ordering
      for (let i = 0; i < items.length - 1; i++) {
        assert.ok(
          items[i].position < items[i + 1].position,
          `Monotonic invariant violated at index ${i}: ${items[i].position} >= ${items[i + 1].position}`
        )
      }
    }
  )

  await t.test('Payment schedules (§8.4)', () => {
    // 100% upfront
    const s100 = scheduleInvoices('upfront_100', 100000)
    assert.deepEqual(s100, [{ label: 'Full payment', amountMinor: 100000 }])

    // 50/50 split with remainder
    const s50 = scheduleInvoices('split_50_50', 100005)
    assert.equal(s50.length, 2)
    assert.equal(s50[0].amountMinor + s50[1].amountMinor, 100005)
    assert.equal(s50[0].label, 'Deposit 50 %')
    assert.equal(s50[1].label, 'Final 50 %')

    // 30/40/30 split with remainder
    const s304030 = scheduleInvoices('split_30_40_30', 100000)
    assert.equal(s304030.length, 3)
    assert.equal(s304030[0].amountMinor, 30000)
    assert.equal(s304030[1].amountMinor, 40000)
    assert.equal(s304030[2].amountMinor, 30000)

    // Monthly retainer
    const monthly = scheduleInvoices('monthly', 50000, [], '2026-10-24')
    assert.equal(monthly.length, 1)
    assert.equal(monthly[0].label, 'October 2026 retainer')
    assert.equal(monthly[0].amountMinor, 50000)

    // Zero or null budget produces no invoices
    assert.deepEqual(scheduleInvoices('split_50_50', 0), [])
    assert.deepEqual(scheduleInvoices('split_50_50', null), [])
  })

  await t.test('Retainer next month calculation (§8.7)', () => {
    const project = {
      id: 'prj-ret-1',
      budgetMinor: 60000,
      currency: 'USD',
      startDate: '2026-10-01',
    }
    const milestones = [
      { title: 'October 2026', dueDate: '2026-10-31', position: 1024 },
    ]
    const now = '2026-10-24T12:00:00.000Z'
    const res = buildNextMonthRetainer(project, milestones, now)

    assert.equal(res.milestone.title, 'November 2026')
    assert.equal(res.milestone.due_date, '2026-11-30')
    assert.equal(res.milestone.amount_minor, 60000)
    assert.ok(res.invoice)
    assert.equal(res.invoice?.label, 'November 2026 retainer')
    assert.equal(res.invoice?.amount_minor, 60000)
    assert.equal(res.invoice?.milestone_id, res.milestone.id)
  })

  await t.test('Save as template (§8.7)', () => {
    const project = {
      startDate: '2026-10-01',
      dueDate: '2026-10-31',
      budgetMinor: 100000,
      billingType: 'fixed' as const,
      revisionsIncluded: 2,
    }
    const milestones = [
      { id: 'm1', title: 'Phase 1', dueDate: '2026-10-15', amountMinor: 40000, position: 1024 },
      { id: 'm2', title: 'Phase 2', dueDate: '2026-10-31', amountMinor: 60000, position: 2048 },
    ]
    const tasks = [
      { title: 'Task 1', milestoneId: 'm1', dueDate: '2026-10-10', kind: 'task', position: 1024 },
      { title: 'Revision task', milestoneId: 'm1', dueDate: '2026-10-12', kind: 'revision', position: 1025 },
      { title: 'Task 2', milestoneId: 'm2', dueDate: '2026-10-25', kind: 'task', position: 2048 },
    ]

    const tpl = saveAsTemplate(project, milestones, tasks, 'My Saved Template')
    assert.equal(tpl.name, 'My Saved Template')
    assert.equal(tpl.billingType, 'fixed')
    assert.equal(tpl.durationDays, 30)
    assert.equal(tpl.milestones.length, 2)
    assert.equal(tpl.milestones[0].amountPct, 40)
    assert.equal(tpl.milestones[1].amountPct, 60)
    // Revision tasks must be excluded
    assert.equal(tpl.tasks.length, 2)
    assert.equal(tpl.tasks[0].title, 'Task 1')
    assert.equal(tpl.tasks[0].milestoneIndex, 0)
    assert.equal(tpl.tasks[1].title, 'Task 2')
    assert.equal(tpl.tasks[1].milestoneIndex, 1)
  })

  await t.test('Weekly review due check (§8.10)', () => {
    assert.equal(isReviewDue(null), true)
    assert.equal(isReviewDue(undefined), true)

    const sixDaysAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString()
    assert.equal(isReviewDue(sixDaysAgo), false)

    const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()
    assert.equal(isReviewDue(eightDaysAgo), true)
  })
})
