# Issues #21 to #30: UX, Ergonomics & Accessibility Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve GitHub issues #21 through #30 covering picker binding failures, duplicate invoice sections, technical jargon, copy inconsistencies, low text contrast, destructive action placement, and stage win-probability synchronization.

**Architecture:** The fixes span frontend modals (`components/modals/`), deal drawer & workspace views (`components/drawers/`, `app/deals/[id]/page.tsx`), dashboard/calendar components (`components/calendar/`, `app/page.tsx`), and the deal repository logic (`lib/db/repository.ts`). Changes are decomposed into 9 self-contained tasks following TDD and WCAG AA standards.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind CSS, Lucide icons, Node test runner (`node --test`).

---

## Issue Summary (Issues #21 – #30)

| Issue | Severity | Area | Problem | Target Fix |
|---|---|---|---|---|
| **#21** | Major, UX | Dialogs / Tables | Datalist pickers don't display options cleanly, company doesn't bind, table names & emails concatenate | Replace brittle datalists with robust combobox/select picker; separate table name and email text nodes |
| **#22** | Major, UX | Deal Dialog / Kanban | New deals blindly default to 'Bluepeak Analytics' when opened | Remove hardcoded `companies[0]` fallback on new deals; provide clear company combobox |
| **#23** | Major, UX | Deal Workspace | Two invoice sections (main & sidebar) with contradictory totals ($0 vs 1/2 paid) | Remove redundant sidebar invoice card; unify invoice state in `DeliverablesTracker` as single source of truth |
| **#24** | Minor, UX | Quick Log Dialog | Dense jargon copy, deal not prefilled from deal page, Contact Person dropdown empty | Pass deal & contacts context to modal from deal page; sentence-case copy & standard button labels |
| **#25** | Minor, UX | Settings & Lock Screen | Technical jargon ('velocity controls', 'Gatekeeper', 'HMAC-SHA256', 'AES / HMAC') | Replace with user-friendly language ('Preferences', 'Security', 'Passcode lock') |
| **#26** | Minor, UX | Dashboard & Calendar | Missing separator '2 due today keep momentum', calendar subtitle vs cards mismatch, cryptic 'T / AI' chips | Add ` · ` separator; clarify today vs upcoming counts; add tooltips and labels to attendee chips |
| **#27** | Minor, UX | Deal Drawer | Destructive 'Delete' button sits right next to 'Mark Won'/'Mark Paid'/'Done' without confirmation | Move Delete to the left with danger styling; add confirmation prompt |
| **#28** | Minor, UX | Deals Kanban / Form | Proposal deal shows 20% win probability while form suggests 70% | Auto-sync probability to stage defaults (Lead: 20%, Qualified: 40%, Proposal: 70%, Won/Paid: 100%) |
| **#29** | Minor, UX | Deals & Milestones | Low contrast text on shortcut legend, 'Hide empty', milestone Sign-off buttons, PENDING badges | Adjust text colors to meet WCAG AA (4.5:1 ratio minimum) |
| **#30** | Minor, UX | Header / Sidebar / Drawer | Inconsistent shortcut hints, missing Activities badge, ops-speak 'All systems operational', low threshold for insight, redundant banner | Standardize `<kbd>` chips, add Activities badge, clean status footer, threshold >= 5 for insight, drop redundant drawer banner |

---

## File Structure & Responsibilities

| File | Responsibility |
|---|---|
| `components/ui/combobox.tsx` (Create) | Reusable searchable combobox dropdown for companies and contacts |
| `components/modals/new-deal-modal.tsx` (Modify) | Remove automatic fallback to `companies[0]`; integrate combobox; auto-update probability on stage select |
| `components/modals/new-contact-modal.tsx` (Modify) | Remove forced fallback to `companies[0]`; integrate company combobox |
| `components/modals/log-call-modal.tsx` (Modify) | Clean up jargon labels; integrate contact/company selection; default to passed deal |
| `app/deals/[id]/page.tsx` (Modify) | Pass `deals`, `contacts`, `companies`, `initialDealId` to `LogCallModal`; remove duplicate sidebar invoices card |
| `components/drawers/deal-detail-drawer.tsx` (Modify) | Separate Delete button to danger zone with confirmation; update probability on stage change; remove redundant workspace banner |
| `lib/db/repository.ts` (Modify) | In `moveDealStage`, set stage default probability (Lead: 20%, Qualified: 40%, Proposal: 70%, Won/Paid: 100%) |
| `components/deals/deal-kanban.tsx` (Modify) | Fix text contrast on shortcut legend & 'Hide empty'; harmonize shortcut hints |
| `components/drawers/deliverables-tracker.tsx` (Modify) | Fix contrast on 'PENDING' badge and 'Sign-off' button |
| `components/calendar/calendar-view.tsx` (Modify) | Clarify subtitle count vs upcoming milestones; add tooltips/accessible labels to attendee chips |
| `components/auth/operator-gate.tsx` (Modify) | Replace 'AES / HMAC' and 'Single-operator gate' with user-friendly security copy |
| `app/page.tsx` (Modify) | Fix dashboard separator; remove settings jargon; add Activities sidebar badge; clean ops-speak; fix table name/email separation; insight threshold |
| `tests/stage-probability.test.ts` (Create) | Unit tests verifying stage transition probabilities |

---

## Implementation Tasks

### Task 1: Reusable Searchable Combobox & Picker Fixes (#21, #22)

**Files:**
- Create: `components/ui/combobox.tsx`
- Modify: `components/modals/new-deal-modal.tsx`
- Modify: `components/modals/new-contact-modal.tsx`
- Modify: `app/page.tsx` (table name/email rendering)

- [x] **Step 1: Create reusable Combobox component**
Create `components/ui/combobox.tsx` providing a text input with clickable dropdown options, keyboard navigation, and the ability to choose existing options or type a custom value.
- [x] **Step 2: Update `NewDealModal`**
In `components/modals/new-deal-modal.tsx`:
  - When `isOpen` becomes true without `dealToEdit` or `initialCompany`, set `company` to empty string `''` (do NOT default to `companies[0]?.name` which caused all deals to become "Bluepeak Analytics").
  - Replace `<input list="company-list">` with `Combobox` populated by `companies`.
- [x] **Step 3: Update `NewContactModal`**
In `components/modals/new-contact-modal.tsx`:
  - Allow picking existing companies or typing a new company without forcing `companies[0]?.name`.
  - Replace `<input list="contact-companies">` with `Combobox`.
- [x] **Step 4: Fix table name and email separation in `app/page.tsx`**
Ensure company contact name and email in the Companies and Contacts tables have distinct block separation and spacing so text extraction / screen readers never concatenate them (e.g., `Harbor & Co Bakeryelena@harborco.bakery`).
- [x] **Step 5: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 2: Remove Duplicate Invoices Card & Unify Deal Workspace (#23)

**Files:**
- Modify: `app/deals/[id]/page.tsx:829-922`

- [x] **Step 1: Remove duplicate sidebar "Commercial Invoices" card**
In `app/deals/[id]/page.tsx`, remove the second "Commercial Invoices" card in the right column (lines ~829-922) that showed "$0 paid" or "1/2 Paid" contradictory to the main DeliverablesTracker.
- [x] **Step 2: Verify `DeliverablesTracker` in main tab**
Confirm that the main Deliverables & Invoices tab contains the unified invoices section with accurate payment tracking and status updates.
- [x] **Step 3: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 3: Quick Log Dialog Polish & Context Binding (#24)

**Files:**
- Modify: `app/deals/[id]/page.tsx:925-943`
- Modify: `components/modals/log-call-modal.tsx`

- [x] **Step 1: Pass deal and contacts context from Deal Page**
In `app/deals/[id]/page.tsx`, update the `<LogCallModal>` render to pass:
  - `initialDealId={deal.id}`
  - `deals={[deal]}` (or full deals list)
  - `contacts={contacts}` (fetched or derived for this deal/company)
  - `companies={companies}`
- [x] **Step 2: Clean up jargon copy in `LogCallModal`**
In `components/modals/log-call-modal.tsx`:
  - Change "MANDATORY NEXT STEP (AUTO-ADDS TO FOLLOW-UPS & DEAL)" to "Next Step" or "Scheduled Next Action".
  - Change submit button text from `Log & Sync ${type}` to `Save ${type}` or `Save Interaction`.
- [x] **Step 3: Ensure Contact Person dropdown populates**
In `components/modals/log-call-modal.tsx`, ensure the contact person picker populates options from the linked deal/company contacts.
- [x] **Step 4: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 4: Win Probability Consistency Across Stages (#28)

**Files:**
- Create: `tests/stage-probability.test.ts`
- Modify: `lib/db/repository.ts:606-645`
- Modify: `components/drawers/deal-detail-drawer.tsx:135-160`
- Modify: `components/modals/new-deal-modal.tsx:265-298`
- Modify: `app/deals/[id]/page.tsx:150-165`

- [x] **Step 1: Write unit test for stage probability mapping**
Create `tests/stage-probability.test.ts` asserting that moving a deal from Lead to Proposal updates its probability to 70%, moving to Qualified sets 40%, moving to Won/Paid sets 100%.
- [x] **Step 2: Run test to verify it fails**
Run: `npm test`
Expected: FAIL on stage probability assertion
- [x] **Step 3: Update `moveDealStage` in `lib/db/repository.ts`**
Map stage to default probability:
  - `Lead`: '20%'
  - `Qualified`: '40%'
  - `Proposal`: '70%'
  - `Won` / `Paid`: '100%'
- [x] **Step 4: Update `handleStageChange` in UI components**
In `components/drawers/deal-detail-drawer.tsx`, `components/modals/new-deal-modal.tsx`, and `app/deals/[id]/page.tsx`, update the probability state when stage changes.
- [x] **Step 5: Run tests to verify they pass**
Run: `npm test`
Expected: PASS

---

### Task 5: Deal Drawer Safety & Danger Action Separation (#27)

**Files:**
- Modify: `components/drawers/deal-detail-drawer.tsx:856-899`

- [x] **Step 1: Visually separate Delete button with danger styling**
In `components/drawers/deal-detail-drawer.tsx`, move Delete to the left edge with clear danger styling (`text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200`).
- [x] **Step 2: Add confirmation step before deletion**
Add a confirmation dialog (`window.confirm('Are you sure you want to delete this deal? This action cannot be undone.')`) or inline confirmation state to avoid accidental deletion next to positive actions.
- [x] **Step 3: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 6: Contrast & Accessibility Audit (#29)

**Files:**
- Modify: `components/deals/deal-kanban.tsx:370-400`
- Modify: `components/drawers/deliverables-tracker.tsx:305-335`

- [x] **Step 1: Fix Deals keyboard shortcut legend & 'Hide empty' contrast**
In `components/deals/deal-kanban.tsx`:
  - Change shortcut legend text color from `#6f7988` to `#4b5563` on `#f4f5f6` (meets > 4.5:1).
  - Change 'Hide empty' button text color from `#6f7988` to `#374151`.
- [x] **Step 2: Fix milestone 'Sign-off' button & 'PENDING' badge contrast**
In `components/drawers/deliverables-tracker.tsx`:
  - Change inactive 'Sign-off' button text from `#9fa1a7` to `#4b5563`.
  - Change 'Pending' status badge from `text-[#8f99a8]` to `text-[#4b5563]` on `bg-[#f0f2f5]`.
- [x] **Step 3: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 7: Technical Jargon Removal in Settings & Lock Screen (#25)

**Files:**
- Modify: `app/page.tsx:1745, 1873, 1897, 1931, 2232`
- Modify: `components/auth/operator-gate.tsx:108-115`

- [x] **Step 1: Replace jargon in Settings page**
In `app/page.tsx`:
  - "Operator cockpit preferences, velocity controls, data portability..." → "Manage your workspace preferences, security, backups, and display options."
  - "Security & Gatekeeper" → "Security"
  - "Cryptographic HMAC-SHA256 session token active with 30-day rolling expiration." → "Session active (expires in 30 days)"
  - "Linear Velocity Controls" → "Workflow Preferences"
  - "HMAC-SHA256 Token" → "Session Token"
- [x] **Step 2: Replace jargon on Lock Screen**
In `components/auth/operator-gate.tsx`:
  - Change "Single-operator gate" to "Protected Workspace"
  - Change "AES / HMAC" to "Passcode Secured"
- [x] **Step 3: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 8: Dashboard, Calendar, and Micro-Copy Polishing (#26, #30)

**Files:**
- Modify: `app/page.tsx:932-960, 1105-1115, 1330-1340, 1400-1410, 2305-2315`
- Modify: `components/calendar/calendar-view.tsx:655-665, 735-752`
- Modify: `components/drawers/deal-detail-drawer.tsx:814-830`
- Modify: `components/deals/deal-kanban.tsx:400-410`

- [x] **Step 1: Fix dashboard Follow-ups separator**
In `app/page.tsx`, change `{dueTodayFollowUpsCount} due today keep momentum` to `{dueTodayFollowUpsCount} due today · Keep momentum`.
- [x] **Step 2: Polish Calendar subtitle & attendee chips**
In `components/calendar/calendar-view.tsx`:
  - Subtitle: clearly state today's events count without conflicting with upcoming featured cards.
  - Featured cards: label as "Upcoming Milestones".
  - Attendee initials chips: add descriptive `title` attribute with person/company name so chips like "T / AI" are clear.
- [x] **Step 3: Standardize shortcut hints with styled `<kbd>` chips**
Harmonize 'Add contact' (C) and 'New deal' (N) buttons and empty states across header, Kanban, and empty lists.
- [x] **Step 4: Add Activities count badge in sidebar**
In `app/page.tsx`, add `badge={String(activities.length)}` to the Activities `NavItem`.
- [x] **Step 5: Remove 'All systems operational' ops-speak**
In `app/page.tsx`, update the sidebar bottom status to concise status or sync indicator.
- [x] **Step 6: Refine 'High client touch frequency' threshold**
In `app/page.tsx`, only show 'High client touch frequency' when completed activities count is >= 5; otherwise display 'Completed touchpoints'.
- [x] **Step 7: Remove redundant 'Open Workspace' banner in deal drawer**
In `components/drawers/deal-detail-drawer.tsx`, remove the banner in the Deliverables tab (header already provides the primary workspace link).
- [x] **Step 8: Run tests and verify**
Run: `npm test`
Expected: PASS

---

### Task 9: Full Regression & Verification

**Files:**
- All touched files

- [x] **Step 1: Run complete test suite**
Run: `npm test`
Expected: All 72+ tests pass with zero failures. (Verified: 73 tests passing)
- [x] **Step 2: Run linter / build check**
Run: `npm run build`
Expected: Build succeeds with zero TypeScript / compilation errors. (Verified: Next.js build succeeds)
- [x] **Step 3: Review diff and prepare commit**
Check git status and staged diffs.
