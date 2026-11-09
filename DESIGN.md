---
name: Freelancer CRM
description: A quiet, keyboard-first workspace for one freelancer's clients, deals and projects.
colors:
  cobalt-core: "#266df0"
  cobalt-bright: "#407ff2"
  cobalt-soft: "#538bf3"
  periwinkle: "#bad0fa"
  ice-wash: "#e4edff"
  selection-wash: "#f1f5ff"
  ink-black: "#1c1d1f"
  graphite: "#232529"
  obsidian: "#101113"
  slate-500: "#505967"
  slate-600: "#6f7988"
  slate-700: "#8f99a8"
  fog-400: "#9fa1a7"
  cloud-200: "#cad0d9"
  mist-50: "#e4e7ec"
  hairline-soft: "#f0f1f3"
  field-wash: "#edf0f3"
  paper: "#f4f5f6"
  row-wash: "#fafbfc"
  app-canvas: "#f7f8fa"
  page-canvas: "#ffffff"
  scrim: "#10141c"
  amber-ink: "#c4882b"
  amber-wash: "#fff3df"
  alert-ink: "#925807"
  alert-wash: "#fff9ee"
  alert-border: "#fae8c3"
  danger-ink: "#d92d20"
  danger-wash: "#fdeceb"
  success-ink: "#3b9b6d"
  success-dot: "#50b884"
  success-wash: "#e5f7ee"
typography:
  page-title:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, sans-serif"
    fontSize: "31px"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.035em"
    fontFeature: "'ss03' on"
  headline:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.03em"
    fontFeature: "'ss03' on"
  title:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
    fontFeature: "'ss03' on"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-0.01em"
    fontFeature: "'ss03' on"
  body-small:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.01em"
    fontFeature: "'ss03' on"
  meta:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "-0.005em"
    fontFeature: "'ss03' on"
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "10px"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "0.08em"
    fontFeature: "'ss03' on"
rounded:
  hairline: "4px"
  chip: "6px"
  badge: "7px"
  control-sm: "8px"
  control: "10px"
  card: "12px"
  round: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  page-x: "48px"
components:
  button-primary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.page-canvas}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 16px"
    height: "40px"
  button-primary-hover:
    backgroundColor: "{colors.obsidian}"
    textColor: "{colors.page-canvas}"
  button-secondary:
    backgroundColor: "{colors.page-canvas}"
    textColor: "{colors.slate-600}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "7px 11px"
  button-secondary-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-black}"
  button-text:
    textColor: "{colors.cobalt-core}"
    typography: "{typography.body-small}"
  button-icon:
    textColor: "{colors.slate-600}"
    rounded: "{rounded.control}"
    size: "34px"
  button-icon-hover:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-black}"
  input:
    backgroundColor: "{colors.page-canvas}"
    textColor: "{colors.ink-black}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "40px"
  search-field:
    backgroundColor: "{colors.page-canvas}"
    textColor: "{colors.fog-400}"
    typography: "{typography.body-small}"
    rounded: "{rounded.control}"
    padding: "0 11px"
    height: "34px"
  card:
    backgroundColor: "{colors.page-canvas}"
    rounded: "{rounded.card}"
    padding: "20px 22px"
  modal:
    backgroundColor: "{colors.page-canvas}"
    rounded: "{rounded.card}"
    width: "512px"
  nav-item:
    textColor: "{colors.slate-600}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    padding: "8px 10px"
  nav-item-active:
    backgroundColor: "{colors.selection-wash}"
    textColor: "{colors.ink-black}"
  stage-pill:
    backgroundColor: "{colors.selection-wash}"
    textColor: "{colors.cobalt-core}"
    typography: "{typography.meta}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  status-pill:
    backgroundColor: "#f0f2f5"
    textColor: "{colors.slate-600}"
    typography: "{typography.meta}"
    rounded: "{rounded.badge}"
    padding: "4px 8px"
  flag-pill-danger:
    backgroundColor: "{colors.danger-wash}"
    textColor: "{colors.danger-ink}"
    typography: "{typography.meta}"
    rounded: "{rounded.badge}"
    padding: "2px 8px"
  toast:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.page-canvas}"
    typography: "{typography.body-small}"
    rounded: "{rounded.card}"
    padding: "10px 14px"
---

# Design System: Freelancer CRM

## Overview

**Creative North Star: "The Quiet Ledger"**

Freelancer CRM is a working tool for one person, used many times a day. It looks like a well-kept ledger: white sheets on a barely grey desk, ink-dark text, ruled hairlines, and one cobalt pen used only to mark what matters now. Nothing on screen competes with the operator's own data. Expression lives in small things: Inter's `ss03` alternates, tight negative tracking on headings, a 220 ms tab indicator, a cobalt dot that means "today".

Density is compact on purpose. Most text sits between 11 and 13 px, rows are short, and panels sit close together (14 px gaps) so Home, Deals and a deal's workspace fit on a laptop screen without scrolling. Light mode only (`color-scheme: light`). The app is keyboard-first, so focus states, `<kbd>` hints and the ⌘K palette are part of the visual language, not extras.

The look grew out of an Attio-inspired reference, but it now stands on its own: no display face, no serif, no marketing surfaces. The logo (an F drawn as a key you press) shares the cobalt and ink, see `brand/GUIDELINES.md`.

**Key Characteristics:**
- One typeface (Inter, `ss03` on), two weights (500 body, 600 emphasis).
- One chromatic accent (cobalt `#266df0`); everything else is ink, slate and hairline grey.
- White cards with 1 px hairline borders on a `#f7f8fa` canvas, lifted by near-invisible blue-tinted shadows.
- Status is said with soft tinted pills (wash background + saturated ink), never with filled color blocks.
- Compact 10/11/12/13 px type scale; headings only at 18, 22 and 31 px.

## Colors

A monochrome slate-and-ink palette with exactly one cobalt voice, plus three quiet status families (amber, red, green) that only appear when something needs attention.

### Primary
- **Cobalt Core** (`cobalt-core`): the single accent. Links and text buttons, focus borders and rings, the "today" dot, the active stage dot, selected rows in the palette, primary icon highlights. Also the logo color.
- **Cobalt Bright / Cobalt Soft** (`cobalt-bright`, `cobalt-soft`): only as steps in the stage progress ramp (`dot-1` to `dot-5` run from `#a6b9df` to cobalt core). Not for buttons or text.
- **Ice Wash** (`ice-wash`): tinted backgrounds behind cobalt content: active status pill, workspace avatar, the 3 px focus halo on fields.
- **Selection Wash** (`selection-wash`): hover and active background for sidebar nav items and the stage pill.
- **Periwinkle** (`periwinkle`): rare blue-tinted outline for highlighted cards.

### Neutral
- **Ink Black** (`ink-black`): primary text, headings, the active tab underline. The most used color in the app.
- **Graphite** (`graphite`): the dark fill of primary buttons, toasts and selected segmented-control items. **Obsidian** (`obsidian`) is its hover state.
- **Slate 500** (`slate-500`): strong secondary text in tables and modals.
- **Slate 600** (`slate-600`): default secondary text, nav items, icon buttons, secondary buttons.
- **Slate 700** (`slate-700`): captions, eyebrows, counts, timestamps.
- **Fog 400** (`fog-400`): placeholders, disabled text, quiet icons, sidebar section labels.
- **Mist 50** (`mist-50`): the hairline. Every card, input, table and divider border. Exposed in CSS as `--border`.
- **Hairline Soft** (`hairline-soft`) and **Field Wash** (`field-wash`): inner dividers inside panels, and the background of hovered icon buttons, inline code and secondary chips.
- **Paper** (`paper`) and **Row Wash** (`row-wash`): hover fill for buttons and table rows; quiet inset areas.
- **App Canvas** (`app-canvas`): the page background behind everything. **Page Canvas** (`page-canvas`, white) is reserved for the surfaces on top of it: sidebar, topbar, cards, modals.
- **Scrim** (`scrim` at 30% opacity): the modal and palette backdrop.

### Status
- **Amber** (`amber-ink` on `amber-wash`): "prospect" pills, `.warning` text, due-soon states. The GTD alert strip uses the calmer `alert-ink` on `alert-wash` with an `alert-border` hairline.
- **Red** (`danger-ink` on `danger-wash`): overdue dots, blocked / unpaid invoice / late project flags, destructive actions.
- **Green** (`success-ink`, `success-dot` with a `success-wash` halo): positive deltas and the "healthy" status dot. Used least of all.

### Named Rules
**The One Pen Rule.** Cobalt marks the one thing to look at: the focused field, today, the current stage, a link. If two cobalt things compete in one panel, one of them should be ink.

**The Wash, Not Fill Rule.** Status is a pale wash with saturated text (`danger-ink` on `danger-wash`). Solid colored backgrounds are only for the dark graphite primary action and the toast.

## Typography

**Body Font:** Inter (via `next/font`, CSS variable `--font-inter`), falling back to `ui-sans-serif, system-ui, -apple-system`.
**Label/Mono Font:** the system monospace stack, only inside `<kbd>` shortcut hints and inline code in notes.

**Character:** a single geometric-leaning sans with `font-feature-settings: 'ss03' on` and slight negative tracking everywhere. Weight 500 is the default for running text, which makes small sizes read firmly; 600 carries every heading, count and emphasized value. 400 and 700 are not used.

### Hierarchy
- **Page Title** (600, 31px, 1.1, -0.035em): the `h1` of top-level views (Clients, Deals, Settings).
- **Headline** (600, 22px, -0.03em): the Home greeting, deal titles in the workspace header, metric values.
- **Title** (600, 18px, -0.025em): panel headings (`.panel-heading h2`). Group heads in Today use 14px / 600.
- **Body** (500, 13px): default UI text, nav items, form fields, buttons, table cells.
- **Body Small** (500, 12px): secondary buttons, search field, alert strips, descriptions.
- **Meta** (500, 11px): pills, due tags, counts, timestamps, next-action text in rows. The most frequent size in the app.
- **Label** (600, 10px, 0.08em, uppercase): eyebrows and sidebar section labels only.

### Named Rules
**The Small Type, Firm Weight Rule.** Text under 13px is never weight 400. Keep 500 so 11px metadata stays legible on white.

**The Tabular Money Rule.** Amounts and numeric columns use `tabular-nums` so values line up in lists and tables.

## Layout

A fixed app shell: a 240px white sidebar on the left (24px top padding, 16px sides), a 68px white topbar with 48px horizontal padding, and the main content on the `app-canvas` background. Content uses CSS grid with tight gaps (14px between Home panels; Home is two columns at 1fr / 1.25fr). Panels pad 20px × 22px; metric cards 16px × 18px. Page headings sit 24px above content.

Spacing follows a 4px base with frequent steps at 8, 12, 16, 20 and 24px; odd values (7px, 9px, 11px) appear inside controls to optically center small text.

Responsive breakpoints step down at 1050px and 900px (grids collapse to one column), 760px (the sidebar disappears and a fixed bottom navigation bar takes over, padded with `env(safe-area-inset-bottom)`; the deal workspace stacks), and 460px (smallest phone tweaks). Page scrollbars are hidden; scrolling stays native.

## Elevation & Depth

Mostly flat, with depth from layering white on near-white and from hairlines. Shadows are blue-tinted (`rgba(28, 40, 64, …)`), very low opacity, and structural: they separate a surface from the canvas, they are not decoration.

### Shadow Vocabulary
- **Card rest** (`box-shadow: rgba(28,40,64,0.1) 0 2px 3px -2px, rgba(28,40,64,0.04) 0 4px 6px -2px`, `--shadow-subtle-2`): panels and metric cards.
- **Primary button** (`box-shadow: 0 1px 3px rgba(28,40,64,0.08)`): the only button with a shadow.
- **Popover** (`--shadow-sm`: `rgba(28,40,64,0.06) 0 2px 6px, rgba(28,40,64,0.08) 0 6px 20px -2px`): menus, comboboxes, the stage menu.
- **Modal** (`--shadow-xl` plus `0 20px 50px rgba(28,40,64,0.12)`): modals and the ⌘K palette, over a `scrim` at 30%.
- **Toast** (`0 12px 30px rgba(0,0,0,0.18)`): the dark toast HUD at the bottom.
- **Focus halo** (`0 0 0 3px` ice-wash, or a 2px cobalt ring at 15% opacity): focused inputs.

### Named Rules
**The Hairline First Rule.** A surface is defined by its 1px `mist-50` border first and its shadow second. Never a shadow without a border on a white card.

## Shapes

Softly rounded, never pill-shaped except for dots and avatars. Corners scale with the size of the object: 4px for `<kbd>` and inline code, 6px for small chips and icon tiles, 7px for badges and pills, 8px for small controls and menu items, 10px for buttons, inputs, nav items and tabs, 12px for cards, modals, alert strips and toasts. Status dots, avatars and the health dot are full circles. Borders are always 1px; the only 2px line is the active tab underline.

## Components

### Buttons
Restrained and compact; the dark one is the only loud thing in a view.
- **Shape:** gently rounded (10px).
- **Primary:** graphite fill, white 13px / 500 text, 40px tall, 16px side padding, faint shadow. Hover goes to obsidian. One per view or modal footer.
- **Secondary (select-button):** white with a `mist-50` hairline, slate-600 12px text, 7px × 11px padding. Hover: paper fill, ink text, border darkens to `#cbd0d8`.
- **Text button:** cobalt 12px text, no chrome, underline on hover.
- **Icon button:** 34px square, transparent, slate-600 icon; paper fill and ink icon on hover.
- **Disabled:** 50% opacity, `not-allowed` cursor.

### Pills & Tags
- **Stage pill:** selection-wash background, cobalt 11px text, 7px radius.
- **Status pill:** neutral `#f0f2f5` / slate-600 by default; `active` uses ice-wash / cobalt, `prospect` uses amber, `inactive` stays grey.
- **Project flag pill:** 11px / 600; `blocked`, `invoice` and `late` switch to danger-wash / danger-ink.
- **Next-action pill:** `#f6f7f9` fill with a `#e5e8ec` hairline, graphite 11px text, a due tag inside; hover darkens both slightly. Clicking it edits the action.

### Cards / Panels
- **Corner Style:** 12px.
- **Background:** white on the app canvas.
- **Shadow Strategy:** card rest shadow (see Elevation).
- **Border:** 1px mist-50.
- **Internal Padding:** 20px × 22px; inner dividers in `hairline-soft`.

### Inputs / Fields
- **Style:** white, 1px mist-50 border, 10px radius, 40px tall in modals (34px for the topbar search), 13px ink text, fog-400 placeholder.
- **Focus:** border turns cobalt and a soft cobalt ring (2px at 15%) or ice-wash halo appears. No outline glow beyond that.
- **Error:** danger-ink text below the field.

### Navigation
- **Sidebar:** 240px, white, hairline right border. Brand mark (27px graphite square, 8px radius), a workspace switcher row, uppercase 10px section labels, then 13px nav items. Hover and active both use selection-wash with ink text; badges sit right-aligned.
- **Tabs:** 13px slate-600 labels, ink when active, with a single 2px ink indicator that slides between tabs (220ms, `cubic-bezier(0.77, 0, 0.175, 1)`).
- **Mobile (≤760px):** the sidebar is replaced by a fixed white bottom bar with a hairline top border.

### Modals & Command Palette
- White, 12px radius, mist-50 border, modal shadow, max width ~512px, over a 30% scrim. They enter with a fast fade + zoom-in-95 (150ms). The palette's selected row is graphite with white text; its shortcut hints are small `<kbd>` chips (paper fill, hairline border, 4–5px radius, mono 9–10px).

### Toast HUD
Dark graphite capsule (12px radius, `#343840` border) at the bottom of the screen, white 12px / 500 text, with an amber or cobalt leading icon. Slides up and fades in over 150ms.

### Today list & Projects overview (signature)
Home's two signature components. Today groups rows under 14px / 600 heads with an 11px slate-700 count and a `hairline-soft` rule; each row has a colored dot (red = overdue, cobalt = today). Projects shows active PM-stage deals with flag pills, a thin task progress bar and a five-step stage ramp from pale blue-grey to cobalt.

## Do's and Don'ts

### Do:
- **Do** use the CSS custom properties in `app/globals.css` (`--color-*`, `--radius-*`, `--shadow-*`) or the hex values in this file's frontmatter. Nothing else.
- **Do** keep running text at 13px / 500 and metadata at 11px / 500; add emphasis with weight 600 or ink color, not with size.
- **Do** give every white surface a 1px `mist-50` border and a 12px radius.
- **Do** show status as a wash pill (pale background, saturated text).
- **Do** show a `<kbd>` hint next to any action that has a shortcut.
- **Do** keep hover transitions at 120–150ms ease and respect `prefers-reduced-motion` (already wired in three places).

### Don't:
- **Don't** add a second accent hue. Tailwind's `#3b82f6` (blue-500) has crept into some focus rings; replace it with cobalt core.
- **Don't** introduce new slate greys (`#636c7e`, `#525968` exist as drift); pick the nearest of slate-500 / 600 / 700.
- **Don't** use weight 400 or 700, a display face or a serif.
- **Don't** use solid colored buttons or banners for status; red, amber and green are washes and text only.
- **Don't** add dark mode styling ad hoc. The app is light-only until a full dark theme is designed.
- **Don't** bring back a Kanban pipeline look for deals; the card board style is only for tasks inside one deal.
