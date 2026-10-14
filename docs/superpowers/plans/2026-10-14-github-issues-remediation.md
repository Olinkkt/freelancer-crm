# Freelancer CRM – GitHub Issues & Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prozkoumat a systematicky vyřešit 19 otevřených issues z GitHubu (od critical bezpečnostních a datových chyb přes logické a validační nedostatky až po UI/housekeeping).

**Architecture:** Rozdělení oprav do 5 logických fází / milníků podle závislostí a závažnosti:
1. Security & Core Auth / Data Safety (#1, #2, #3)
2. API Validation & Data Integrity (#4, #7, #19)
3. Business Logic & Core Workflows (#8, #9, #11, #14, #15, #16)
4. UI/UX Polish, Ergonomics & Modals (#6, #10, #12, #13, #17)
5. Docker, Build & Deployment Cleanliness (#5, #18, #19 repo files)

**Tech Stack:** Next.js (App Router, Server Actions, Route Handlers), LibSQL / SQLite, TypeScript, Tailwind CSS, Zod, Radix UI.

---

## Přehled otevřených Issues (19 celkem)

### 🔴 Critical (5 issues)
- **#1**: Onboarding passcode protects nothing when AUTH_SECRET is unset (API + dashboard open)
- **#2**: Failed backup restore wipes all workspace data (no transaction, no validation)
- **#3**: `claimWorkspaceAction` has no auth check – first visitor can claim a fresh deployment
- **#6**: Quick Log modal (hotkey `L`) opens behind deal drawer backdrop and is unclickable
- **#7**: Deals are never linked to contacts; drawer shows fabricated Primary Contact email

### 🟠 Major (8 issues)
- **#4**: No API input validation; raw JS/SQLite errors leaked, invalid values accepted
- **#5**: Docker build fails on node:20-alpine (`@libsql/linux-x64-musl` fcntl64 symbol not found)
- **#8**: Activity type 'Meeting' is saved as 'Call'
- **#9**: Scheduled follow-up appears on dashboard but not in Calendar
- **#10**: Hardcoded 'Alex Rivera' on lock screen; dashboard briefly greets 'Alex'
- **#11**: Moving deal to Paid auto-creates two 50% invoices marked Paid without user input
- **#12**: No name length limit – long contact names break table layout and toast
- **#13**: Deleting a contact has no confirmation

### 🟡 Minor (6 issues)
- **#14**: Mixed currency: Kč shown / CZK CSV header while USD is selected; defaults disagree with `.env.example`
- **#15**: Contradictory stats on Contacts page (open opportunities, open deals, win rate)
- **#16**: Follow-up 7 days out labelled 'This week'
- **#17**: Toasts stack indefinitely and never auto-dismiss
- **#18**: Console 404 for `/_vercel/insights/script.js` on every page (self-hosted)
- **#19**: Housekeeping: DELETE unknown deal returns 200; `tsconfig.tsbuildinfo` and duplicate `package-lock.json` committed

---

## Fázovaný Implementační Plán

### Fáze 1: Security & Core Auth / Data Safety (Critical)
*Zaměřeno na to, aby aplikace nebyla zranitelná a nedocházelo ke ztrátě dat.*

- [x] **Task 1: Oprava autorizace a passcode ochrany (#1, #3)**
  - **Soubory:** `lib/auth/session.ts`, `app/actions/auth.ts`, `middleware.ts` (nebo layout/API auth checkery)
  - **Kroky:**
    1. Upravit `checkIsAuthenticated()` a `isAuthRequired()` tak, aby reflektovaly nastavený passcode v DB i bez `AUTH_SECRET`.
    2. V `claimWorkspaceAction` přidat podmínku kontroly, zda workspace již není zabraný, případně vyžadovat setup token / stávající secret.
    3. Nahradit nesolené SHA-256 hashování passcode bezpečným algoritmem (např. scrypt / bcrypt / Web Crypto PBKDF2/Argon2).
    4. Zabezpečit API routy (včetně `/api/backup`), aby vyžadovaly platnou session.

- [x] **Task 2: Atomická obnova zálohy a validace záložních dat (#2)**
  - **Soubory:** `lib/db/repository.ts` (`restoreWorkspaceData`), `app/api/backup/route.ts`
  - **Kroky:**
    1. Přidat Zod validaci pro schéma importovaného backup JSON payloadu.
    2. Obalit operaci smazání a následného vkládání tabulek do jediné DB transakce (`db.transaction()` nebo `BEGIN ... COMMIT / ROLLBACK`).
    3. Pokud libovolný INSERT selže, provést ROLLBACK – původní data zůstanou nedotčena.

---

### Fáze 2: API Input Validation & Datová integrita
*Zajištění stability API a správného provázání entit.*

- [x] **Task 3: Zod validační vrstva a error handling pro API routy (#4, #19)**
  - **Soubory:** `app/api/deals/route.ts`, `app/api/companies/route.ts`, `app/api/contacts/route.ts`, validační schémata v `lib/validations/`
  - **Kroky:**
    1. Vytvořit schémata pro validaci vstupů (např. nezáporná hodnota dealu, validní stage z enumu, validní ID).
    2. V routách vracet strukturované 400 chyby srozumitelné pro klienta, místo neošetřených SQLite výjimek.
    3. Pro `DELETE /api/deals?id=...` vracet 404, pokud deal s daným ID neexistuje (#19).

- [x] **Task 4: Provázání Dealů s Kontakty a odstranění vymyšlených e-mailů (#7)**
  - **Soubory:** `lib/db/repository.ts`, komponenta Deal Draweru (`components/deals/DealDrawer.tsx` nebo ekvivalent), formulář pro vytvoření/úpravu dealu
  - **Kroky:**
    1. Zkontrolovat schéma a vazbu `contactId` u dealů.
    2. Umožnit reálný výběr/propojení kontaktu při zakládání/editaci dealu.
    3. V detailu dealu (drawer) zobrazovat skutečný e-mail a údaje propojeného kontaktu; odstranit mockovaný fallback e-mail.

---

### Fáze 3: Business Logika a Workflow
*Oprava chybějících událostí, špatných typů a nechtěné automatizace.*

- [x] **Task 5: Oprava ukládání aktivity 'Meeting' (#8)**
  - **Soubory:** formulář pro logování aktivit (Quick Log / Activity form), `lib/db/repository.ts`
  - **Kroky:**
    1. Opravit mapování / enum hodnotu při odesílání typu `Meeting` (zamezit přepsání na `Call`).

- [x] **Task 6: Zobrazení naplánovaných follow-upů v Kalendáři (#9)**
  - **Soubory:** `app/(dashboard)/calendar/page.tsx` (nebo odpovídající kalendářový komponent/loader)
  - **Kroky:**
    1. Zahrnout do kalendářového dotazu i follow-upy (nejen meetings/milestones).
    2. Aktualizovat header statistiky v kalendáři tak, aby započítával follow-up položky.

- [x] **Task 7: Odstranění nechtěného auto-vytváření dvou faktur při přechodu dealu do 'Paid' (#11)**
  - **Soubory:** handlery pro změnu stavu dealu (`app/actions/deals.ts` nebo `app/api/deals/route.ts` či event triggery)
  - **Kroky:**
    1. Zrušit automatické generování dvou 50% faktur označených jako 'Paid'.
    2. Nechat fakturaci plně pod kontrolou uživatele (manuální akce / dialog).

- [x] **Task 8: Oprava měn a výchozích nastavení (#14)**
  - **Soubory:** `lib/db/init.ts`, `.env.example`, komponenty pro export CSV a stránka Companies
  - **Kroky:**
    1. Sjednotit výchozí měnu a formátování napříč aplikací dle zvoleného nastavení workspace.
    2. V exportu CSV dynamicky generovat hlavičku dle aktivní měny (`Raw Amount (${currency})`).

- [x] **Task 9: Oprava statistik na stránce Contacts & relativních popisků follow-upů (#15, #16)**
  - **Soubory:** stránka kontaktů (výpočet statistik pipeline, open deals, win rate), komponenta/helper pro formátování datumů follow-upů
  - **Kroky:**
    1. Opravit agregační dotazy na stránce Contacts (zajistit soulad mezi open opportunities, open deals a pipeline).
    2. Opravit date helper pro seskupování datumů (např. 7 dní od dneška neřadit pod 'This week', pokud spadá do dalšího týdne).

---

### Fáze 4: UI / UX Polish & Ergonomie
*Zlepšení použitelnosti, zamezení vizuálních chyb a zasekávání rozhraní.*

- [x] **Task 10: Z-index oprava Quick Log modalu vůči Deal Draweru (#6)**
  - **Soubory:** `components/QuickLogModal.tsx`, modal/drawer portály / CSS z-indexy
  - **Kroky:**
    1. Zvýšit z-index modalu Quick Log / nastavit stacking context tak, aby byl modal vždy nad backdropem Deal Draweru.

- [x] **Task 11: Zavedení potvrzovacího dialogu pro mazání kontaktů (#13)**
  - **Soubory:** akce/tlačítko smazání na stránce kontaktů
  - **Kroky:**
    1. Přidat `AlertDialog` / potvrzovací prompt před voláním delete akce.

- [x] **Task 12: Limit délky jména a ošetření přetečení v tabulce / toastech (#12)**
  - **Soubory:** validační schémata kontaktů, komponenta tabulky kontaktů (`truncate`, max-width), CSS pro toasty
  - **Kroky:**
    1. Omezit max. délku jména (např. 100 znaků) na klientu i serveru.
    2. Přidat CSS třídy pro zalomení/oříznutí textu (`truncate`, `break-words`).

- [x] **Task 13: Odstranění hardcoded 'Alex Rivera' a oprava pozdravu na dashboardu (#10)**
  - **Soubory:** Lock screen komponenta, Dashboard header / user context
  - **Kroky:**
    1. Na lock screenu načítat reálné jméno operátora z DB/workspace nastavení.
    2. Zamezit bliknutí defaultního 'Alex' před načtením uživatelských dat (skelet / SSR stav).

- [x] **Task 14: Oprava hromadění toastů (#17)**
  - **Soubory:** Toast provider / toaster komponenta (`components/ui/toaster.tsx` nebo podobná)
  - **Kroky:**
    1. Nastavit auto-dismiss po timeoutu (např. 4–5 s).
    2. Omezit maximální počet současně zobrazených toastů (limit např. 3-5).

---

### Fáze 5: Docker, Build & Repo Housekeeping
*Čistota repozitáře a bezproblémový self-hosted deployment.*

- [x] **Task 15: Oprava Dockerfile pro LibSQL / Alpine (#5)**
  - **Soubory:** `Dockerfile`
  - **Kroky:**
    1. Přepnout základní image na `node:20-slim` (kvůli glibc vs musl fcntl64 v `@libsql`).
    2. Upravit user management na Debian styl (`groupadd` / `useradd`) a healthcheck přes `node -e "fetch(...)"`.

- [x] **Task 16: Podmíněné načítání Vercel Insights (#18)**
  - **Soubory:** root layout (`app/layout.tsx`)
  - **Kroky:**
    1. Načítat `<Analytics />` pouze pokud je definována proměnná prostředí (např. `process.env.VERCEL`).

- [x] **Task 17: Úklid repozitáře a ignorování build artefaktů (#19)**
  - **Soubory:** `.gitignore`, odstranění `tsconfig.tsbuildinfo`, odstranění `package-lock.json`
  - **Kroky:**
    1. Přidat `tsconfig.tsbuildinfo` a `*.tsbuildinfo` do `.gitignore`.
    2. Odstranit verzovaný `tsconfig.tsbuildinfo` a redundantní `package-lock.json` (ponechat `pnpm-lock.yaml`).

---

## Možnosti exekuce

1. **Subagent-Driven (Doporučeno):** Spouštění subagentů po jednotlivých blocích/fázích s průběžnou kontrolou a testy.
2. **Inline Execution:** Postupná implementace krok za krokem v tomto sezení s kontrolními body.
