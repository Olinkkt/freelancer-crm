# Contributing to Freelancer CRM ⚡

Thank you for your interest in contributing to **Freelancer CRM**!

We are building the fastest, keyboard-driven, local-first CRM specifically designed for solo software engineers, designers, and independent consultants.

---

## 🧭 Core Philosophy & Rules

Before proposing or building new features, please keep our core tenets in mind:

1. **Solo-Tenancy Only ("No Team Bloat")**: We intentionally do NOT support multiple sales reps, approval hierarchies, or role permissions. Freelancers wear all the hats.
2. **Keyboard-First Velocity**: Every core action must have a single-key or chord shortcut (e.g. `N`, `L`, `O`, `G P`, `Cmd/Ctrl+K`).
3. **Local-First & Lightweight**: The app must run self-hosted with SQLite out-of-the-box in under 150MB of RAM.
4. **Mandatory GTD Next Action**: A deal without a scheduled next action is broken. We don't remove this constraint.

---

## 🛠️ Local Development Setup

### 1. Requirements
- Node.js 20+
- `pnpm` 10+ (`corepack enable` or `npm install -g pnpm`)

### 2. Clone & Install
```bash
git clone https://github.com/Olinkkt/freelancer-crm.git
cd freelancer-crm
pnpm install
```

### 3. Environment
```bash
cp .env.example .env.local
```

### 4. Run Development Server
```bash
pnpm dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## 🧪 Testing

We use the Node.js native test runner (`node:test`) with `tsx`:

```bash
pnpm test
```

All 62+ tests must pass before submitting a pull request.

---

## 📜 Pull Request Guidelines

1. **Keep PRs Focused**: One feature or bug fix per PR.
2. **Include Tests**: Add unit tests in `tests/` for any new backend repository functions or API routes.
3. **Conventional Commits**: Format commit messages like:
   - `feat(deals): add export to CSV`
   - `fix(invoices): correct VAT rounding`
   - `docs: update self-hosting guide`
4. **AGPL-3.0 License Notice**: By contributing to Freelancer CRM, you agree that your contributions will be licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.
