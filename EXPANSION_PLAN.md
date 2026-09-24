# Notes App v2.0 — Premium Expansion Playbook (Stage 12 → v2.0)

**Situation:** the app is at Stage 12 (PWA shipped, Android/Play Store prepared). You have lived in it; this expansion is your use-case talking. Eight new feature areas: Canvas, Calendar Pro, Focus Pro, Habit Analytics, Knowledge Graph + Backlinks, Smart Inbox (subtasks/templates/Life Areas/analytics), Routines + Today Dashboard, Journaling.

**This document is the architect; Antigravity is the builder; you are the QA department.**

**First action:** copy this file into your project root as `EXPANSION_PLAN.md` and commit it. Every phase prompt below tells the agent to read the relevant section, so the plan lives *with the code*, not in a chat window.

---

## 0. The Safety Contract (read once, obey forever)

Eight features at once is how vibe-coded apps die. These seven rules are what keep yours alive. They are repeated inside every phase prompt so the agent can't "forget" them.

1. **Freeze the working app first.**
   ```bash
   git tag v1.0-stage12          # the last known-good, store-ready app
   git checkout -b v2-expansion  # all expansion work happens here
   ```
   `main` stays shippable until the whole expansion passes QA. If Play Store reviewers or your testers need a fix mid-expansion, fix it on `main`, then `git merge main` into `v2-expansion`.
2. **One phase = one Antigravity conversation = one merge-worthy unit.** New conversation per phase. End of phase: verify checklist → smoke test → commit → tag (`v2.0-phase1`, …). Only merge `v2-expansion` → `main` at the very end (or per phase if you prefer — your call, but tags are mandatory).
3. **Schema changes are append-only.** Dexie versions already shipped are *never edited*. Each phase adds a new `db.version(n)` block with an idempotent `upgrade()`. Tables are never dropped, columns never removed — abandoned fields just go unused. (Details + the exact Dexie pitfall in §2.)
4. **Auto-backup before any upgrade.** Phase 0 installs a version gate: when the app detects a newer schema than the data, it downloads a JSON backup automatically *before* Dexie runs migrations. You should never again wonder "did I export before that update?"
5. **Every new module ships behind a feature flag** (Settings → Labs). A module that misbehaves in production gets switched off in one tap — no rollback, no data loss, no emergency release.
6. **After every phase: run the smoke checklist (Appendix A).** 2 minutes, non-negotiable, plus the phase-specific checklist. Red → `git reset --hard` to the phase's last green commit → re-ask narrower.
7. **No dependency outside the approved list** (Appendix B). No tldraw (proprietary license — watermark unless paid), no FullCalendar (heavy, premium plugins), no cloud anything.

---

## 1. Master plan — modules, order, dependencies

### 1.1 What's being built (and what deliberately isn't)

| # | Module | In scope for v2.0 | Explicitly OUT (put in FRICTION.md) |
|---|--------|-------------------|--------------------------------------|
| 1 | **Canvas & Ink** | Pen / brush / highlighter / eraser, pressure-sensitive vector strokes, colors, sizes, undo/redo, zoom/pan, PNG export, thumbnail grid, link canvas ↔ note | Node-based whiteboards (Excalidraw-style), shape recognition, multiplayer, layers |
| 2 | **Calendar Pro** | Day / 3-day / Week / Month / Timeline views, one shared time-grid engine, now-indicator, tap-slot quick create, drag-to-reschedule (desktop) | Google/CalDAV sync, timezones across regions, resource booking |
| 3 | **Focus Pro** | Timer presets (Pomodoro/custom), cycles, auto-breaks, session history + weekly stats, optional "link to task" | App blocking, ambient soundscapes store, team focus |
| 4 | **Habit Analytics** | GitHub-style heatmap, completion %, current/best streak, monthly trend, per-habit detail | Social accountability, habit marketplaces |
| 5 | **Knowledge Graph** | `[[wikilinks]]` + autocomplete, backlinks panel with context, global graph + per-note local graph, unresolved-link "create note" affordance | Dataview-style queries, embedding/AI similarity |
| 6 | **Smart Inbox & Tasks** | **Life Areas** (default seeded areas, first-class field), subtasks, natural-language quick-add ("tomorrow 5pm #health @Work"), templates (task/note/journal/routine), inbox analytics header | Email-to-inbox, shared lists |
| 7 | **Routines + Today** | Routine builder (items = pointers to tasks/habits/journal or custom steps), day-of-week scheduling, idempotent daily materialization, **Today dashboard** = home screen fusing Routine + Upcoming + Due + Habits + Journal prompt | Routine sharing/import from web |
| 8 | **Journal** | Distraction-free full-bleed editor, date navigation, daily template/prompts, mood (1–5) + optional weather tag, streak, "on this day" | Audio/video entries, AI reflection |

**Philosophy check:** all eight obey your original non-negotiables — one data model, multiple views (Today, Timeline, Graph, Eisenhower, Analytics are *views*); zero-friction capture stays untouched; dates stay distinct (`journalDate` ≠ `scheduledAt` ≠ `dueAt` ≠ event `startAt`); everything local; trash before delete.

### 1.2 Build order (dependency-driven, not requirement-list order)

```
Phase 0  FOUNDATION        design system · nav regroup · feature flags · backup gate · lazy routes
   │                       (everything below plugs into this shell)
Phase 1  LIFE AREAS + SMART INBOX/TASKS     areas · subtasks · quick-add NL parsing · templates · inbox analytics
   │                       (Routines, Insights and Graph coloring all reference Life Areas)
Phase 2A JOURNAL           notes.kind='journal' · journalDate · mood · distraction-free mode · daily template
Phase 2B BACKLINKS + GRAPH wikilink parsing → links table · backlinks panel · local+global graph
   │                       (journal first so entries participate in the graph)
Phase 3  CALENDAR PRO      time-grid engine · 1/3-day/week views · Timeline view
Phase 4  ROUTINES + TODAY  routines/runs tables · materialization engine · Today dashboard (absorbs Upcoming)
   │                       (needs tasks, events, habits, journal, areas — hence late)
Phase 5  CANVAS & INK      biggest isolated build; independent — can be pulled earlier if it's what you crave
Phase 6  FOCUS PRO + HABIT ANALYTICS + INSIGHTS HUB
Phase 7  HARDENING         performance pass · a11y · regression · Play Store v2.0
```

Rationale: Phase 0 prevents eight modules from each inventing their own buttons/nav; Life Areas seed the color/organization language everything else reuses; Today comes after the things it aggregates; the two "big isolates" (Canvas, Graph) come when the foundation is proven. **Phases 3, 5, 6 are order-swappable** — if your FRICTION.md screams for Canvas, do Phase 5 right after Phase 1. Everything else keeps its dependencies.

### 1.3 Effort budget (evenings/weekends, one phase per Antigravity session set)

| Phase | Sessions | Elapsed |
|---|---|---|
| 0 Foundation | 1–2 | weekend |
| 1 Areas + Inbox/Tasks | 2 | 1 week |
| 2A Journal | 1 | few days |
| 2B Backlinks + Graph | 2–3 | 1–1.5 weeks |
| 3 Calendar Pro | 2–3 | 1 week |
| 4 Routines + Today | 2 | 1 week |
| 5 Canvas | 3–4 | 1.5–2 weeks |
| 6 Focus/Habits/Insights | 2 | 1 week |
| 7 Hardening + release | 1–2 | few days |
| **Total** | **~18–22** | **~8–10 weeks part-time** |

Use the app for 2–3 days between phases. Each phase ends with the question: *does this make capture, organize, schedule, or review better?* If a sub-feature doesn't, cut it — flags make cutting free.

---

## 2. Migration & Update Strategy (Output ①)

### 2.1 Dexie schema protocol

**The one rule that prevents data loss:** Dexie versions are history. Never modify a `db.version(n)` block that has shipped — you only *append* `db.version(n+1)` with the changed stores and an `upgrade(tx)` function.

**⚠️ The classic Dexie trap (put this in every schema prompt):** when you change a table's indexes in a new version, you must re-declare **that table's complete index list** (primary key + every index, old and new) in `.stores({})` — not just the additions. Tables you don't touch are simply not listed. Omitting an existing index silently deletes it and breaks queries.

**Upgrade functions must be:** idempotent (safe to re-run), null-tolerant (fresh installs run them against zero rows), and chunked for full-table passes (see `reindexAllLinks` in Phase 2B — batch of 50 + `setTimeout(0)` yield so the UI never freezes).

**Version allocation for the expansion** (if your current latest is `V`, these become `V+1 … V+7`; the agent confirms the actual numbers):

| Dexie version | Phase | Stores added / changed |
|---|---|---|
| V+1 | 0 | `flags` (or settings JSON gets `flags`), `appMeta` (lastVersion seen — for backup gate) |
| V+2 | 1 | `lifeAreas`, `templates`; **re-declare** `tasks` (+`lifeAreaId, parentTaskId, routineRunId, sortOrder`), `notes` (+`lifeAreaId`) |
| V+3 | 2A | **re-declare** `notes` (+`kind, journalDate, mood`) |
| V+4 | 2B | `links` |
| V+5 | 3/4 | `routines`, `routineRuns`; `settings.calendar` view prefs (no schema change if settings is a JSON blob) |
| V+6 | 5 | `canvases` |
| V+7 | 6 | `timerPresets`; **re-declare** `focusSessions` (+`presetId`) if indexed fields change |

### 2.2 Automatic pre-upgrade backup (built in Phase 0)

```
app boot → read appMeta.schemaVersion vs db.verno
  if db.verno is newer than last-seen:
     1. show blocking sheet: "Upgrading your data — saving a backup first…"
     2. build the same JSON envelope as Settings → Export (incl. attachments)
     3. trigger download (or write to OPFS if download prompt is blocked on mobile)
     4. only then allow db.open() to run migrations
     5. write new last-seen version
```

On Android/installed PWA where a download prompt is awkward, the OPFS copy is the safety net; document both in ARCHITECTURE.md. Either way: **no migration ever runs without a backup existing.**

### 2.3 Migration dry-run page (dev-only, Phase 0)

Route `/debug/migrate` (only when `import.meta.env.DEV`): clones the live DB into `notesapp_migration_test` via Dexie's `Vip`/copy or export-import, runs the pending upgrade against the clone, prints before/after row counts per table and any errors. The agent runs this after every schema phase; you glance at it. Costs one prompt paragraph, saves one bad weekend.

### 2.4 Feature flags

```ts
// single source of truth — src/app/flags.ts
export const FEATURE_FLAGS = ['canvas','journal','graph','routines','calendarPro','insights','focusPro','habitAnalytics','smartInbox'] as const;
export type Flag = typeof FEATURE_FLAGS[number];
// persisted in settings.flags: Record<Flag, boolean>  (default: true for shipped, false for WIP)
```

Nav items, routes and dashboard cards all filter through `useFlag(flag)`. `/debug/flags` (dev) or Settings → Labs (prod) toggles them. **A flagged-off module's data stays untouched in IndexedDB** — that's why we never drop tables.

### 2.5 Rollback ladder (least → most drastic)

1. Feature flag off (instant, per module).
2. `git revert <phase merge commit>` + rebuild (minutes).
3. `git reset --hard v2.0-phaseN-1` during development (before merge).
4. User data corrupted by a bad migration (should be impossible given §2.2, but): reinstall/refresh → import the auto-backup JSON.
5. Nuclear: `main` is still at `v1.0-stage12` — the store version never regressed.

### 2.6 Play Store implications

- Expansion happens on `v2-expansion`; the store keeps serving v1.0 until you choose.
- If your 14-day closed test is still running: **keep it running** — the clock is calendar time; ship v2.0 as your production release (or push it to the closed track first for your 12 testers as a real-world regression test — recommended).
- At release: bump `versionName` → `2.0.0`, `versionCode` +1, rebuild signed AAB, update store listing text/screenshots (new features are your listing's selling points), data-safety form unchanged (still 100% local, no collection). Target API 36 requirement unchanged — Capacitor 8 config from Stage 11 still satisfies it.

---

## 3. Information Architecture v2

Sixteen destinations can't live in one flat list. Regroup into a **5-slot bottom nav + Capture FAB + Library sheet** (mobile) and a **sectioned collapsible sidebar** (desktop), sharing one nav config file.

### 3.1 Navigation spec

```
BOTTOM NAV (mobile)                 SIDEBAR (desktop, same items grouped)
─────────────────────               ─────────────────────────────────────
 🏠 Today      (home)               TODAY
 🔎 Search                           · Today  · Insights
 ➕ (FAB → Capture sheet)           CAPTURE
 📅 Calendar                         · Inbox (badge) · Journal · Canvas
 📚 Library   (sheet/drawer)        ORGANIZE
                                     · Notes · Graph · Life Areas · People · Tags
                                    PLAN
                                     · Calendar · Tasks · Eisenhower · Routines
                                    GROW
                                     · Habits · Focus
                                    SYSTEM
                                     · Settings · Archive · Trash · Labs(flags)
```

**Capture sheet** (FAB, from anywhere — the sacred <3s path is untouched and gets *more* entries): Note to Inbox (default, autofocused) · New Note · New Task · Journal entry (today) · New Drawing · From template.

**FAB long-press** → straight to Inbox capture (skips the sheet) for the truly impatient.

### 3.2 Routes (old routes must redirect, never 404 — installed PWAs remember start URLs)

```
/today                      (NEW home; /upcoming → 301 to /today)
/inbox  /notes  /notes/:id
/journal  /journal/:yyyy-mm-dd
/canvas  /canvas/:id
/graph  /graph/:noteId      (global / local)
/calendar?view=day|3day|week|month|timeline   (default persisted per user)
/tasks  /tasks/:id  /eisenhower
/routines  /routines/:id
/habits  /habits/:id
/focus
/insights
/areas  /people  /settings  /settings/templates  /settings/labs
/search  /archive  /trash  /debug/migrate (dev)
```

### 3.3 Today dashboard (Phase 4 spec — the heart of v2.0)

Fixed section order for v2.0 (reordering = FRICTION.md candidate):

```
┌────────────────────────────────────────┐
│ Good evening · Wed, Sep 24        ⚙︎    │  greeting + date
│ ▸ NEXT: Gym 18:00 (in 42 min)          │  Now/Next card: next event/routine block countdown
│ ── ROUTINE: Evening wind-down ──       │  today's routine(s) for current timeOfDay,
│   ☐ Journal  ☐ Stretch 10m  ☐ Read     │  checkboxes write to routineRuns.itemState
│ ── SCHEDULE ──                         │  today's events timeline (compact)
│   18:00 Gym · 20:30 Call Sam           │
│ ── DUE ──                              │  tasks due today + overdue (overdue first, danger tint)
│ ── HABITS 4/6 ──                       │  today's habit circles (tap = log)
│ ── JOURNAL 🔥12 ──                     │  streak + "Write today's entry" (or "Read" if done)
│ [＋ Capture anything…]                 │  sticky quick-capture bar → Inbox
└────────────────────────────────────────┘
```

Every row is a *pointer* into its module (tap → full editor). Today stores nothing of its own except routine run state — one data model, multiple views.

---

## 4. Data Architecture (new/changed tables — the code)

Drop-in reference for the agent (Phase prompts point here). Field names are contracts; the agent may add, not rename.

```ts
// ───────────────────────── Phase 1 ─────────────────────────
export interface LifeArea {
  id?: number; name: string;            // seeded: Health, Work, Personal, Finance, Learning, Home, Relationships
  color: string;                        // hex from the area palette (§5.2)
  icon: string;                         // lucide icon name or emoji
  sortOrder: number; archived: boolean; createdAt: number;
}

export type TemplateKind = 'task' | 'note' | 'journal' | 'routine';
export interface Template {
  id?: number; kind: TemplateKind; name: string;
  body: {                               // kind-specific payload, all optional fields
    title?: string; content?: string; subtasks?: string[];
    lifeAreaId?: number | null; priority?: string; dueOffsetDays?: number;
    prompts?: string[];                 // journal template
    items?: RoutineItem[];              // routine template
  };
  usageCount: number; createdAt: number;
}

// tasks table GAINS (re-declare full index list in the new Dexie version!):
//   lifeAreaId?: number|null   — indexed
//   parentTaskId?: number|null — indexed; subtasks are tasks (no separate table)
//   routineRunId?: number|null — provenance: generated by a routine run
//   estimatedMin?: number
// notes table GAINS: lifeAreaId?: number|null

// ───────────────────────── Phase 2A ────────────────────────
// notes table GAINS:
//   kind: 'note' | 'journal'   (upgrade: default 'note'; indexed)
//   journalDate?: string       // 'YYYY-MM-DD' local — DISTINCT from scheduledAt/createdAt (indexed, unique-ish per day enforced in UI not schema)
//   mood?: 1|2|3|4|5

// ───────────────────────── Phase 2B ────────────────────────
export interface NoteLink {
  id?: number;
  sourceId: number;                     // note containing the [[link]]
  targetId: number | null;              // resolved note id, null = unresolved
  targetTitle: string;                  // raw text inside [[ ]] (normalized for matching)
  context: string;                      // ±60 chars around the link, for backlink snippets
  createdAt: number;
}
// links indexes: '++id, sourceId, targetId, targetTitle'

// ───────────────────────── Phase 4 ─────────────────────────
export type RoutineItemKind = 'task' | 'habit' | 'journal' | 'note' | 'custom';
export interface RoutineItem {
  uid: string;                          // stable id for per-run state (crypto.randomUUID())
  kind: RoutineItemKind;
  refId?: number;                       // pointer: existing task/habit/note id (NOT copied)
  title: string;                        // display text (for custom steps, the task title)
  durationMin?: number;
}
export interface Routine {
  id?: number; name: string; emoji?: string;
  daysOfWeek: number[];                 // 0=Sun … 6=Sat  (multiEntry-indexed)
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'any';
  items: RoutineItem[];                 // JSON array inside the row
  active: boolean; createdAt: number; updatedAt: number;
}
export interface RoutineRun {           // one per routine per day — the idempotency key
  id?: number;
  routineId: number; date: string;      // 'YYYY-MM-DD' local
  generatedTaskIds: number[];           // custom steps materialized as tasks (carry routineRunId)
  itemState: Record<string, boolean>;   // uid → done (pointer items checked off without duplicating them)
}
// routineRuns indexes: '++id, &[routineId+date], date'

// ───────────────────────── Phase 5 ─────────────────────────
export type InkTool = 'pen' | 'brush' | 'highlighter' | 'eraser';
export interface Stroke {
  id: string; tool: InkTool; color: string; size: number; // px at zoom 1
  points: [number, number, number][];   // x, y, pressure(0..1) in DOCUMENT space (see §Phase 5)
}
export interface CanvasDoc { version: 1; width: number; height: number; bg: string; strokes: Stroke[]; }
export interface CanvasEntity {
  id?: number; title: string; doc: CanvasDoc;
  thumbBlob?: Blob;                     // 512px PNG, regenerated on save (debounced)
  linkedNoteId?: number | null;         // optional: a canvas belongs to a note
  tags: string[]; lifeAreaId?: number | null;
  createdAt: number; updatedAt: number; trashedAt?: number | null;
}
// canvases indexes: '++id, title, *tags, lifeAreaId, linkedNoteId, trashedAt, updatedAt'

// ───────────────────────── Phase 6 ─────────────────────────
export interface TimerPreset {
  id?: number; name: string;            // "Classic Pomodoro", "Deep work", …
  focusMin: number; shortBreakMin: number; longBreakMin: number;
  cycles: number;                       // long break after N focus sessions
  autoStartBreaks: boolean; autoStartFocus: boolean; sound: boolean; isDefault: boolean;
}
// focusSessions GAINS: presetId?: number, kind: 'focus'|'break' (re-declare if indexed)
```

---

## 5. Design System & UI/UX Guidelines (Output ③)

### 5.1 Premium = restraint. The house rules

1. **One accent color**, everything else neutral. Accent is used for: primary actions, now-indicator, active nav item, streak flames. Never for decoration.
2. **Depth from tone, not lines.** Surfaces stack `bg → surface → surface-2`; hairline borders (`--color-border`) only where surfaces meet same-tone. Cards: 16px radius, `--shadow-card`. Floating elements (FAB, sheets, toolbars): `--shadow-float`.
3. **Type does the hierarchy.** 3 sizes on screen max at once (e.g. 28/15/13). Titles semibold, metadata 13px `--color-ink-muted`. Journal may opt into a serif face — the only place serif is allowed.
4. **Motion with a job** (150/250/400ms, spring ease for anything entering): sheets slide+fade, snackbar undo, habit circle "pop" on complete, graph nodes settle. Nothing animates purely decoratively; everything respects `prefers-reduced-motion`.
5. **Thumb-first.** Primary actions in the bottom third on mobile; destructive actions never adjacent to primary; every tap target ≥44px; every list row swipeable where actions exist; modals → bottom sheets on mobile.
6. **Progressive disclosure stays sacred.** New power (subtasks, life area, mood, recurrence…) hides behind "+ more" / long-press / the editor's optional tray. Capture remains one text field.
7. **Empty states are onboarding.** Every new screen ships with a calm illustration-less empty state: one line of copy + the single action that fills it ("Draw your first idea →").
8. **Dark mode is first-class**, verified per phase (Tailwind v4 class variant; token overrides below).
9. **Iconography:** lucide-react only, 1.75px stroke, 20/24 sizes. No emoji as UI icons (emoji are *content*: routines, habits, life areas may use them).
10. **Density toggle** (Settings → Comfortable/Compact) adjusting `--row-h` and paddings — one CSS variable, not two layouts.

### 5.2 Tokens (Tailwind v4 — Phase 0 implements exactly this)

```css
/* src/design/tokens.css */
@import "tailwindcss";
@custom-variant dark (&:where(.dark, .dark *));

@theme {
  --font-sans: "Inter", system-ui, -apple-system, sans-serif;
  --font-serif: "Newsreader", Georgia, serif;      /* journal only */

  --color-bg:        oklch(0.985 0.002 260);
  --color-surface:   oklch(1 0 0);
  --color-surface-2: oklch(0.965 0.004 260);
  --color-border:    oklch(0.915 0.006 260);
  --color-ink:       oklch(0.24 0.02 262);
  --color-ink-muted: oklch(0.55 0.02 262);
  --color-accent:      oklch(0.55 0.17 265);      /* calm indigo */
  --color-accent-ink:  oklch(0.98 0.01 265);
  --color-accent-soft: oklch(0.55 0.17 265 / 12%);
  --color-success: oklch(0.62 0.13 155);
  --color-warning: oklch(0.72 0.14 75);
  --color-danger:  oklch(0.58 0.19 25);

  /* Life-area palette (fixed 8, colorblind-considered, reused by tags/graph) */
  --area-1: oklch(0.62 0.16 25);   /* Health   — coral    */
  --area-2: oklch(0.58 0.13 250);  /* Work     — indigo   */
  --area-3: oklch(0.66 0.14 145);  /* Personal — green    */
  --area-4: oklch(0.64 0.13 60);   /* Finance  — amber    */
  --area-5: oklch(0.60 0.14 310);  /* Learning — violet   */
  --area-6: oklch(0.63 0.10 200);  /* Home     — teal     */
  --area-7: oklch(0.61 0.17 0);    /* Relate.  — rose     */
  --area-8: oklch(0.60 0.03 262);  /* Other    — slate    */

  --radius-card: 1rem;  --radius-sheet: 1.5rem;  --radius-pill: 999px;
  --shadow-card:  0 1px 2px rgb(15 23 42 / 0.05), 0 4px 16px rgb(15 23 42 / 0.05);
  --shadow-float: 0 10px 32px rgb(15 23 42 / 0.14), 0 2px 6px rgb(15 23 42 / 0.08);
  --ease-spring: cubic-bezier(0.34, 1.4, 0.64, 1);
  --dur-fast: 150ms;  --dur-normal: 250ms;  --dur-slow: 400ms;
  --row-h: 3.25rem;   /* density toggle: compact = 2.75rem */
}

.dark {
  --color-bg:        oklch(0.17 0.012 262);
  --color-surface:   oklch(0.21 0.014 262);
  --color-surface-2: oklch(0.25 0.015 262);
  --color-border:    oklch(0.32 0.015 262);
  --color-ink:       oklch(0.93 0.01 262);
  --color-ink-muted: oklch(0.66 0.015 262);
  --color-accent:      oklch(0.68 0.15 265);
  --color-accent-soft: oklch(0.68 0.15 265 / 16%);
  --shadow-card:  0 1px 2px rgb(0 0 0 / 0.4), 0 4px 16px rgb(0 0 0 / 0.25);
  --shadow-float: 0 10px 32px rgb(0 0 0 / 0.5), 0 2px 6px rgb(0 0 0 / 0.35);
}
```

Shared UI kit (Phase 0, `src/design/ui/`): `Sheet` (bottom sheet w/ spring + grab handle), `Segmented`, `StatCard`, `Heatmap`, `EmptyState`, `Skeleton`, `Chip`, `ColorDots` (area/tag picker), `RingProgress`, `Snackbar` (existing undo service — reuse, don't rebuild), `FAB`, `SectionHeader`. Every later phase **must** compose from these; a phase prompt that adds a new primitive must justify it.

### 5.3 Per-module UX specs (the premium details that make or break each screen)

- **Calendar time grid:** 60px/hour row, half-hour hairlines; now-line = 2px accent with a dot, updating every 30s; events = rounded chips colored by life area (fallback: accent), title + time, truncated gracefully; overlapping events split width; tap empty slot → create sheet pre-filled with that time (rounded to :00/:30); drag edges to resize & body to move (desktop only); all-day band pinned above the grid. **3-day = day view × 3 sharing the same engine — never a second implementation.**
- **Timeline view:** vertical rail on the left (time/date), grouped cards by day (Today/Tomorrow/weekday/week-of), mixing events + due tasks + scheduled notes + routine blocks, each type with its icon; now-divider scrolls into view on open; tap → module editor. This is "Upcoming, grown up."
- **Journal:** full-bleed, max-width 68ch, generous line-height, serif optional; header = big date + weekday, swipe/arrow to change day; mood row (5 faces, tap once, retappable); below editor: "prompts" from the daily template as tappable chips that insert text; footer: current streak 🔥 + "On this day, 1 year ago" card when it exists. Distraction-free mode (toggle/scroll): everything fades except the paragraph being typed (typewriter scroll optional flag).
- **Canvas:** floating pill toolbar bottom-center (tools → expand radial on long-press), color dots + 3 size dots appear contextually when a tool is selected; top bar: title, undo/redo, export, link-to-note, ⋯; two-finger pan / pinch zoom (touch), space+drag (desktop); zoom % badge; eraser removes whole strokes (predictable, premium — no pixel smears); "Save to note" exports PNG as an attachment of the linked note; canvas grid = masonry of thumbnails with title/date.
- **Graph:** dark-tinted canvas surface in both themes (graphs read as "instrument panels"); node size = link degree, color = life area (gray fallback); resolved links solid, unresolved dashed with hollow target nodes ("create note" on tap); hover/tap → tooltip title; click → open note; pinch/scroll zoom + drag pan; local graph panel inside the note editor (depth 1–2, current note = accent halo); global graph capped at 500 nodes (highest degree first) with a "showing top 500" note.
- **Habits analytics:** heatmap = last 12 months, 4-step accent alpha scale + today ring; tap a cell → that day's log detail; header stats (30-day %, current/best streak, total); per-habit page: trend line (last 8 weeks completion), streak calendar, edit/archive.
- **Insights hub:** cards only, each computed locally, no charts library needed beyond tiny inline SVG: captures/week (inbox), tasks completed/week by area (stacked dots), events this week vs last, focus minutes, habit consistency, journal streak. Delta arrows vs previous period. Tap card → its module.
- **Inbox analytics header:** collapsible strip: "12 captured · 9 filed this week · avg 4h to file" — computed, never blocking.

---

## 6. Component Architecture (Output ②)

Feature-folder structure; every module owns its components/hooks/repo/types; cross-module imports only via `db/repos` and `design/ui`.

```
src/
├── app/                          # shell — the only place that knows ALL features
│   ├── router.tsx                # routes; React.lazy per feature; old-route redirects
│   ├── nav.ts                    # SINGLE nav config: {id,label,icon,route,group,flag?}
│   ├── AppShell.tsx              # sidebar (desktop) / bottom nav + Library sheet (mobile)
│   ├── CaptureFab.tsx            # FAB + capture sheet (note/task/journal/canvas/template)
│   └── flags.ts                  # FEATURE_FLAGS, useFlag()
├── design/
│   ├── tokens.css                # §5.2 verbatim
│   └── ui/                       # Sheet, Segmented, StatCard, Heatmap, EmptyState,
│                                 # Skeleton, Chip, ColorDots, RingProgress, FAB, SectionHeader
├── db/
│   ├── database.ts               # ALL Dexie versions live here, append-only (§2.1)
│   ├── backupGate.ts             # §2.2 pre-upgrade auto-backup
│   └── repos/                    # notesRepo tasksRepo eventsRepo habitsRepo peopleRepo
│       ├── areasRepo.ts          # lifeAreas CRUD + seedDefaults()
│       ├── templatesRepo.ts
│       ├── linksRepo.ts          # reindexNote / reindexAll (§7 Phase 2B)
│       ├── routinesRepo.ts       # materializeRoutinesFor (§7 Phase 4)
│       ├── canvasRepo.ts
│       ├── focusRepo.ts          # presets + sessions + stats
│       └── insightsRepo.ts       # pure computed selectors (no writes)
├── features/
│   ├── today/        TodayScreen.tsx · sections/{NowNext,RoutineCard,ScheduleRail,DueTasks,HabitRow,JournalPrompt}.tsx
│   ├── inbox/        InboxScreen.tsx · InboxAnalytics.tsx · FileAsSheet.tsx (task w/ subtasks+area+quick-add)
│   ├── notes/        NotesScreen · NoteEditor/ (editor + OptionalTray + WikilinkAutocomplete + BacklinksPanel + LocalGraphMini)
│   ├── journal/      JournalScreen.tsx · MoodRow · PromptsChips · OnThisDay · useJournalDate.ts
│   ├── canvas/
│   │   ├── CanvasListScreen.tsx  CanvasEditorScreen.tsx
│   │   ├── components/ InkToolbar · ColorSizeBar · ZoomBadge · ExportSheet · LinkNoteSheet
│   │   └── engine/   strokeModel.ts · renderer.ts (2-layer canvas) · history.ts (undo/redo)
│   │                 hitTest.ts (eraser) · transform.ts (pan/zoom) · export.ts (PNG)
│   ├── graph/        GraphScreen.tsx · components/GraphCanvas · GraphFilters · lib/{buildGraph,simulation}.ts
│   ├── calendar/     CalendarScreen.tsx (view router)
│   │   ├── grid/     TimeGrid.tsx (engine: dayCount prop = 1|3|7) · EventChip · NowLine · AllDayBand · SlotPopover
│   │   └── views/    DayView · ThreeDayView · WeekView · MonthView · TimelineView
│   ├── tasks/        TasksScreen · TaskEditor (+SubtaskList, +AreaPicker) · Eisenhower (existing, area colors)
│   ├── routines/     RoutinesScreen · RoutineEditor (item picker: task/habit/journal/custom) · RoutineCard (used by Today)
│   ├── habits/       HabitsScreen · HabitDetail (analytics) · components/Heatmap usage
│   ├── focus/        FocusScreen (timer) · PresetsSheet · SessionHistory
│   ├── insights/     InsightsScreen · cards/*.tsx
│   ├── areas/        AreasScreen (manage life areas + tags together)
│   ├── people/ settings/ search/ archive-trash/   (existing, restyled to tokens)
└── lib/
    ├── date.ts       # localDateStr(d) → 'YYYY-MM-DD' in LOCAL tz — the ONLY date-string helper allowed
    ├── quickAdd.ts   # §Phase 1 NL parser
    ├── wikilinks.ts  # §Phase 2B extractor
    └── id.ts         # uid()
```

**Component hierarchy highlights**

```
AppShell ─┬─ Sidebar/DesktopNav | BottomNav + LibrarySheet + CaptureFab
          └─ <Suspense> RoutedFeature
TodayScreen ─ NowNext ← nextEventSelector(eventsRepo, routinesRepo)
            ├ RoutineCard(routine, run) → checkRow writes routineRuns.itemState (or task.status)
            ├ ScheduleRail(events today) · DueTasks(tasksRepo.dueBy) · HabitRow(habits today)
            └ JournalPrompt(notesRepo.journalFor(localDateStr(now)))
CalendarScreen ─ Segmented(day|3day|week|month|timeline)
              └ TimeGrid{days:[Date...]} ─ AllDayBand + hourRows × days ─ EventChip* + NowLine + SlotPopover
CanvasEditorScreen ─ InkToolbar(state: tool/color/size) → InkSurface(renderer + history + transform + hitTest)
NoteEditor ─ textarea(+WikilinkAutocomplete popup) ─ BacklinksPanel(linksRepo.in/targetId) ─ LocalGraphMini
```

State management stays as-is (useLiveQuery + repo functions). Cross-feature reads go through repos, never through another feature's components. `motion` (framer-motion) is allowed for sheets/transitions only — lists don't animate per-item.

---

## 7. The Phases — prompts, verification, pitfalls

> **Every prompt below is pasted into a NEW Antigravity conversation named `v2-phaseN-…`.**
> The shared preamble is included in each prompt text — paste as-is.

---

### PHASE 0 — Foundation (design system · nav · flags · backup gate · lazy routes)

**Prompt:**

```
Read EXPANSION_PLAN.md sections §0 (Safety Contract), §2 (Migration), §3 (IA), §5 (Design System), §6 (Component Architecture). We are executing PHASE 0 ONLY — the foundation. No feature modules yet.

Ground rules: work on branch v2-expansion (create it; tag current HEAD v1.0-stage12 first). Dexie schema changes are append-only; when re-declaring a table's indexes in a new version, list the COMPLETE index set. Update ARCHITECTURE.md. npm run build must pass. Commit "v2 phase 0: foundation" and tag v2.0-phase0 when I confirm verification passed.

Deliverables:
1. DESIGN SYSTEM: create src/design/tokens.css exactly per EXPANSION_PLAN §5.2 (Tailwind v4 @theme + .dark overrides) and migrate the existing app's colors/spacing/radii to these tokens. Restyle existing screens to the §5.1 house rules (one accent, tone-depth, type hierarchy, 44px targets). Build the shared UI kit in src/design/ui: Sheet, Segmented, StatCard, EmptyState, Skeleton, Chip, ColorDots, RingProgress, FAB, SectionHeader — reuse the existing snackbar/undo service as-is.
2. NAVIGATION v2: implement src/app/nav.ts as the single nav config and AppShell per §3.1 — mobile: 5-slot bottom nav (Today, Search, FAB, Calendar, Library sheet) ; desktop: grouped collapsible sidebar. Old routes must redirect per §3.2 (/upcoming → /today). "Today" for now renders the existing Upcoming content under the new name (full Today comes in Phase 4).
3. CAPTURE FAB + sheet per §3.1 (entries that don't exist yet — Journal/Drawing/Template — are hidden until their feature flag is on). The <3s inbox capture path must remain identical in speed.
4. FEATURE FLAGS: src/app/flags.ts per §2.4, persisted in settings, Settings → Labs screen with toggles + one-line description each. Nav/routes filter through flags. All expansion flags default OFF for now.
5. BACKUP GATE + MIGRATION DRY-RUN: implement §2.2 (auto JSON backup — download, falling back to OPFS copy — before any schema upgrade runs; blocking sheet with progress) and §2.3 (/debug/migrate dev page). Add appMeta store (new Dexie version, append-only) to track last-seen schema version.
6. PERFORMANCE BASELINE: convert ALL routes to React.lazy + Suspense with Skeleton fallbacks; add @tanstack/react-virtual to Notes/Inbox/Search lists (they will grow); record current bundle size in ARCHITECTURE.md ("performance budget" section: main chunk must stay under ~250 kB gzipped; each lazy feature chunk reported).
7. MOTION: add `motion` (framer-motion) and use it for Sheet enter/exit and nav transitions only. Respect prefers-reduced-motion globally.

Approved new dependencies (exact list, nothing else): motion, @tanstack/react-virtual, lucide-react (if not already present).

Show me the plan (files to touch, Dexie version number you'll use, nav config) and wait for my "go".
```

**✅ Verify**
- [ ] App looks visibly more premium but *behaves identically*; run Appendix A smoke test — all 10 lines green.
- [ ] Dark + light both audited on every existing screen (no stray hard-coded colors).
- [ ] Bottom nav: Today/Search/FAB/Calendar/Library all work; desktop sidebar groups match §3.1; `/upcoming` redirects.
- [ ] FAB sheet: Inbox capture still <3s (cold open, time it); long-press → direct capture.
- [ ] Labs screen lists 9 flags, all off; toggling one on/off changes nav immediately (nothing crashes since modules don't exist yet — entries stay hidden until their phase ships; wire flags to real routes as phases land).
- [ ] Backup gate: bump `db.verno` scenario — ask agent to demo by opening the dev migrate page; confirm JSON/OPFS backup is produced before upgrade.
- [ ] Notes list with 500 seeded test rows scrolls at 60fps (have the agent add a dev-only seed script `/debug/seed`).
- [ ] Build passes, tag `v2.0-phase0` exists.

**⚠️ Pitfalls**
- Agent "reimagines" existing screens and breaks Stage 1–10 behavior → *"Restyle only — zero behavior changes to existing features. Re-run the smoke checklist and fix regressions."*
- Tailwind v4 dark variant misfires after token migration → the `@custom-variant dark` line must exist exactly as in §5.2.
- Old route 404s after nav change → installed PWA deep links break → insist on the redirect map in `router.tsx`.

---

### PHASE 1 — Life Areas · Smart Inbox · Task upgrades (subtasks, quick-add, templates)

**Prompt:**

```
Read EXPANSION_PLAN.md §2, §4 (Phase 1 types), §5.3 (Inbox specs), §6. Branch v2-expansion. PHASE 1 ONLY. Safety Contract §0 applies (append-only Dexie version — re-declare tasks/notes with COMPLETE index lists; feature flag 'smartInbox' + Life Areas always-on data layer; build passes; commit "v2 phase 1: life areas + smart inbox" + tag after my verification).

1. LIFE AREAS: lifeAreas table per §4; seed the 7 defaults from §5.2 palette on first run (areasRepo.seedDefaults, idempotent); Areas screen (manage name/color/icon/order/archive); LifeArea picker component (ColorDots + name) used in: task editor, note editor optional tray, event editor, template editor. Existing tags remain untouched — areas are additive. Notes/tasks/events gain lifeAreaId (nullable, never required, hidden behind the existing optional-fields disclosure).
2. SUBTASKS: tasks gain parentTaskId (indexed). Task editor shows subtask checklist (add via quick line, reorder by drag on desktop, swipe-delete mobile); parent task row shows "2/5" progress chip; parent completes → subtasks stay as-is (no cascade) but UI warns if subtasks incomplete; subtasks are hidden from main task lists (filter parentTaskId==null) but appear in Upcoming/Today when they carry their own dueAt.
3. QUICK-ADD NATURAL LANGUAGE (src/lib/quickAdd.ts): implement exactly this contract using chrono-node (approved dep): parse a trailing/inline natural date ("tomorrow 5pm", "friday", "in 3 days") → dueAt (strip the matched text from the title); "#tag" tokens → tags; "@Area" token → match life area by name (case-insensitive) → lifeAreaId (strip from title). Return {title, dueAt?, tags[], lifeAreaId?}. Used by: Inbox capture (optional — capture NEVER blocks on parsing; parse into a subtle preview chip row "📅 tomorrow 17:00 · #health · @Work" that the user can dismiss), task quick-add bar, File-as-task sheet. Write unit tests for quickAdd (vitest) covering 10+ phrasings including "no date words" cases.
4. TEMPLATES: templates table per §4; Settings → Templates CRUD (task template: title/subtasks/area/priority/dueOffsetDays; note template: title+content skeleton; journal + routine template kinds exist in schema but their UI arrives in Phases 2A/4); template picker in Capture sheet + task quick-add ("From template"); usageCount increments.
5. SMART INBOX (flag 'smartInbox'): File-as sheet upgrade — when filing an inbox item, a bottom sheet offers: title field, quick-add preview chips (from #3), area picker, "add subtasks" disclosure, template apply; actions become: File as note (existing) / Convert to task (new, opens this sheet pre-parsed) / Delete. Inbox analytics header per §5.3 (computed from notes rows: captured this week, filed this week, median time-to-file) — collapsible, never blocking.
6. Restyle Tasks screen to tokens; Eisenhower untouched except area color dots on cards.

Approved new dep: chrono-node. Show plan + the quickAdd test cases first, wait for "go".
```

**✅ Verify**
- [ ] Areas screen shows 7 seeded defaults with distinct colors; create one custom area; archive one — pickers update everywhere.
- [ ] Quick-add: type `Call dentist tomorrow 5pm #health @Work` in task bar → title "Call dentist", due tomorrow 17:00, tag health, area Work. Unit tests pass (`npm test`).
- [ ] Inbox capture with a date phrase shows the dismissible preview chip but still saves in <3s with zero extra taps; chips correct.
- [ ] File an inbox item → sheet → convert to task with 2 subtasks + area → task appears with "0/2" chip; inbox item processed.
- [ ] Create a task template ("Weekly review" w/ 4 subtasks); use it from Capture sheet → full task materialized; usageCount incremented.
- [ ] Subtasks hidden from main list; a subtask with its own due date shows in Upcoming.
- [ ] Inbox analytics numbers match manual count; header collapses.
- [ ] Smoke test (Appendix A) green; old data (areas=null) renders fine everywhere; tag `v2.0-phase1`.

**⚠️ Pitfalls**
- chrono-node mis-parsing plain titles ("meeting 3 people" → date) → *"If a parsed date looks like it came from a non-date phrase, bias to no-date: only accept parses chrono marks as certain or that contain explicit date words. Add test cases."*
- Capture got slower (parsing on every keystroke) → parse on save or debounce ≥300ms; capture path priority beats chip preview.
- Dexie index re-declaration dropped `*tags` or `trashedAt` → check DevTools index list against §2.1 table; this is the silent-killer bug.

---

### PHASE 2A — Journal

**Prompt:**

```
Read EXPANSION_PLAN.md §4 (Phase 2A), §5.3 (Journal spec), §3.3. Branch v2-expansion. PHASE 2A ONLY (flag 'journal'). Safety Contract applies (append-only Dexie version re-declaring notes with COMPLETE indexes; build; commit "v2 phase 2a: journal" + tag after verification).

1. SCHEMA: notes gain kind ('note'|'journal', default 'note', indexed), journalDate ('YYYY-MM-DD' LOCAL via lib/date.ts localDateStr — indexed), mood (1..5 nullable). Upgrade function sets kind='note' where undefined. Journal entries are NOTES — one data model; they appear in global search (with a journal badge) but NOT in the Notes list (filter kind='note'); trash/archive/pin/export all work on them automatically — verify, don't re-implement.
2. JOURNAL SCREEN /journal and /journal/:date: header big date + weekday, ‹ › day navigation + calendar jump; one entry per day (creating when journalDate exists opens it); mood row (5 faces per §5.3); distraction-free editor per spec (full-bleed, 68ch, serif option per-entry, typewriter scroll behind a flag in Settings→Journal); prompt chips from journal templates (Phase 1 kind now gets UI: Settings→Templates→Journal, seed one default "Daily" template: prompts ["What went well?","What drained me?","Tomorrow I will…"] — tapping a prompt inserts it as a bold line); footer: streak 🔥 (consecutive days with an entry, computed from journalDate set) + "On this day" card (same month/day, previous years — tap to open).
3. Capture sheet + FAB: "Journal entry" opens today's entry. Today dashboard hook: export a JournalPromptSection component (streak + write/read CTA) — Phase 4 will mount it; render it NOW at the bottom of the Upcoming/Today screen so it's live immediately.
4. Autosave identical to notes (500ms debounce, "Saved" indicator). Empty day = calm empty state ("Nothing written yet — that's fine.").

Show plan, wait for "go".
```

**✅ Verify**
- [ ] Write today's entry; mood 4; navigate to yesterday (empty state), back → content intact; reload app → intact.
- [ ] Two consecutive days → streak 2; skip a day → streak resets display correct.
- [ ] Prompt chip inserts line; journal template editable in Settings.
- [ ] Journal entry appears in global Search with badge; does NOT appear in Notes list; CAN be tagged + given a life area; export/import round-trip includes it (kind + journalDate + mood survive).
- [ ] "On this day": create an entry dated exactly 1 year ago (dev seed or date picker) → card shows.
- [ ] Serif/dark mode both beautiful; smoke test green; tag `v2.0-phase2a`.

**⚠️ Pitfalls**
- Timezone bug: `new Date().toISOString().slice(0,10)` is UTC — entries near midnight land on the wrong day → *"All journalDate computation must go through lib/date.ts localDateStr (local timezone). Add a test simulating 23:30 local."*
- Agent creates a separate `journal` table → reject: journal entries are notes (`kind='journal'`), per §4.

---

### PHASE 2B — Wikilinks · Backlinks · Graph

**Prompt:**

```
Read EXPANSION_PLAN.md §4 (Phase 2B NoteLink), §5.3 (Graph spec), §6 (features/graph, linksRepo). Branch v2-expansion. PHASE 2B ONLY (flags 'graph'; backlinks ship with it). Safety Contract applies (new links table = new Dexie version; build; commit "v2 phase 2b: backlinks + graph" + tag).

1. WIKILINK PARSING — implement src/lib/wikilinks.ts EXACTLY per this reference (MIT-safe, write it yourself in this style):
   const WIKILINK_RE = /\[\[([^\[\]|#]+)(?:#([^\[\]|]*))?(?:\|([^\[\]]*))?\]\]/g;
   → extractWikilinks(content) returns [{rawTitle, heading?, alias?, index, length}]; normalizeTitle = trim+lowercase+collapse whitespace. Unit tests (vitest): nested brackets, alias, heading, multiple links, no links.
2. LINKS TABLE + REINDEX: linksRepo.reindexNote(noteId) — delete links where sourceId=noteId, re-extract, resolve each rawTitle to a note via title index (ensure notes has a 'title' index; use equalsIgnoreCase on the normalized title; prefer kind='note' matches, journalDate/title exact match wins ties) → targetId or null (unresolved, keep targetTitle). context = ±60 chars around match. reindexAllLinks(onProgress) chunked: batches of 50 + setTimeout(0) yield; run once on first launch after upgrade (appMeta flag) with a subtle progress toast; also re-run for a title's unresolved links when a note is renamed/created (claim flow). Called from notes save path debounced 800ms.
3. EDITOR: typing "[[" opens WikilinkAutocomplete popup — search notes by title prefix (Dexie startsWithIgnoreCase, ranked: prefix > contains, 8 rows, keyboard+touch); Enter inserts [[Title]]; Escape closes. In rendered note view (if any) style [[links]] as accent chips; in the plain textarea they remain visible as [[text]] — acceptable for v2.
4. BACKLINKS PANEL: collapsible section under the editor: "Linked in N notes" — linksRepo.where targetId=note.id → rows: source note title + context snippet with the match bolded, tap → open source. Unresolved section: links with targetId=null and targetTitle == this note's title → "Claim" (set targetId) — automatic on rename/create per #2. Also an "Outgoing" chip row (this note's links, unresolved ones styled dashed with "create note «Title»" tap action).
5. GRAPH (/graph, global): build nodes from notes (kind any; journal entries = smaller nodes) + edges from resolved links; d3-force (approved dep) simulation: forceLink distance 60, forceManyBody -120, forceCollide radius by degree, forceCenter; render to <canvas> (NOT SVG — perf): node radius 3+degree, fill = life area color (gray default), accent halo for journal-today; pan/zoom (pinch + wheel), drag node (reheat sim α 0.3), tap → tooltip chip, double-tap/open → note, long-press → local graph. Filters sheet: by life area, by tag, include journals toggle, orphan toggle (hide degree-0). Cap 500 nodes (highest degree first) + "showing top 500" note. Simulation runs off the main thread if trivial (Web Worker) else rAF with α-decay stop — must not scroll-jank.
6. LOCAL GRAPH: in-note panel (depth slider 1–2) + /graph/:noteId full screen; BFS over links both directions; current note centered with halo.
7. PERFORMANCE GATE: seed 1000 notes + 2000 links via /debug/seed — graph opens < 1.5s, pans at ~60fps, editor backlinks resolve < 50ms.

Approved new dep: d3-force. Show plan + wikilink test cases first, wait for "go".
```

**✅ Verify**
- [ ] In note A write `[[Note B]]` → autocomplete offered; save → B's backlinks panel shows A with bolded context snippet; tap → A.
- [ ] Link to `[[Does Not Exist]]` → appears as unresolved/dashed; "create note" makes it; the link auto-resolves (claim) and both panels update.
- [ ] Rename note B → links to B still resolve (title re-claim works); alias `[[B|my label]]` and heading `[[B#section]]` parse without breaking resolution.
- [ ] Global graph renders seeded 1000-note DB smoothly; filters work; tap opens note; colors match life areas.
- [ ] Local graph from a hub note shows depth 1 vs 2 difference.
- [ ] Journal entries appear as smaller nodes when included.
- [ ] First-launch reindex ran once (appMeta), progress shown, app usable during it.
- [ ] Smoke test green incl. export/import with links (links are derived data — import triggers reindexAll, verify); tag `v2.0-phase2b`.

**⚠️ Pitfalls**
- Reindex on every keystroke → debounce 800ms after save, and never inside useLiveQuery render paths.
- Canvas graph blank on mobile → devicePixelRatio scaling bug: canvas width = cssWidth × dpr, ctx.scale(dpr,dpr).
- Agent pulls in all of d3 → *"Only d3-force. Rendering is hand-written canvas 2D."*

---

### PHASE 3 — Calendar Pro (Day / 3-Day / Week / Month / Timeline)

**Prompt:**

```
Read EXPANSION_PLAN.md §5.3 (Calendar + Timeline specs), §6 (features/calendar). Branch v2-expansion. PHASE 3 ONLY (flag 'calendarPro'; when off, existing month/day behavior remains). Safety Contract applies (view prefs persist in settings — likely no schema change; if you need one, append-only; build; commit "v2 phase 3: calendar pro" + tag).

1. TIME-GRID ENGINE (grid/TimeGrid.tsx): ONE component parameterized by days: Date[] (1, 3, or 7) — day/3-day/week views are the same engine, never parallel implementations. Spec: 60px/hour, half-hour hairlines, hour labels left rail, all-day band pinned on top (allDay events + due-all-day tasks), scroll-to-now on open (or 07:00 if nothing today), NowLine (accent, dot, updates every 30s, only when today visible), event chips per §5.3 colored by lifeAreaId (fallback accent), overlap layout (columns split), 44px min chip height with graceful truncation.
2. INTERACTIONS: tap empty slot → create-event sheet prefilled (start = slot rounded to :00/:30, end +60min); tap chip → event editor (existing); desktop: drag chip to move, drag edges to resize (15-min snap), click-drag empty area to create range; mobile: tap only (drag = FRICTION.md later). Recurring events: expand occurrences for the visible range via the existing recurrence engine including exceptions.
3. VIEWS: DayView, ThreeDayView (today±1), WeekView (week start from settings, default Monday), MonthView (upgrade existing: dots per life-area color, tap day → DayView instead of agenda sheet — agenda moves to Timeline), TimelineView per §5.3: vertical rail grouped by day (Today/Tomorrow/then weekday headers), merged streams: events (time), due tasks (⏰), scheduled notes (📌), active routine blocks (Phase 4 hook: routinesRepo.itemsFor(date) — code against the interface, it may return [] until Phase 4), now-divider auto-scroll. Timeline range = today → +14 days, infinite scroll further.
4. HEADER: Segmented control (Day·3·Week·Month·Timeline) + date nav (‹ today ›) + jump-to-date; chosen view persists per user; Calendar nav item opens last-used view.
5. DATA: events, due tasks (dueAt), scheduled notes (scheduledAt) — three streams stay separate per PLAN.md §3; Timeline labels each row's type; NOTHING writes across types (completing a task from timeline = task repo; event edit = events repo).
6. PERF: 200 events + 100 tasks in visible month renders instantly; week grid scroll 60fps; occurrences computed with date-range-bounded queries, not full-table scans.

Show plan (component API for TimeGrid + recurrence expansion approach), wait for "go".
```

**✅ Verify**
- [ ] All 5 views reachable; view choice persists across reload; old month behavior still fine with flag OFF.
- [ ] Create event Tue 15:00–16:00 from week view by tapping the slot (time prefilled); appears in day/3-day (when in range)/month dot/timeline.
- [ ] Now-line sits at the real current time; scrolls into view on open.
- [ ] Overlapping events render side-by-side; all-day event pins to the top band in all grid views.
- [ ] Recurring weekly event shows in each of the next 4 weeks; a cancelled occurrence stays hidden everywhere.
- [ ] Timeline merges event + due task + scheduled note with distinct icons/labels and day grouping; "Tomorrow" section correct across midnight (test by changing device date).
- [ ] Desktop drag-move + edge-resize snap to 15min; mobile unaffected.
- [ ] Smoke test green; tag `v2.0-phase3`.

**⚠️ Pitfalls**
- DST/timezone drift in grid math → all day-boundary math via lib/date.ts local helpers; add a test crossing a DST change if your locale has one.
- Agent builds three separate day grids → reject: one TimeGrid, `days` prop.
- Recurrence expansion scanning all events → require range-bounded query + occurrence cache if needed.

---

### PHASE 4 — Routines + Today Dashboard

**Prompt:**

```
Read EXPANSION_PLAN.md §3.3 (Today spec), §4 (Routine/RoutineRun), §5.3, §6 (features/routines, features/today). Branch v2-expansion. PHASE 4 ONLY (flag 'routines'; Today dashboard ships with it and absorbs Upcoming). Safety Contract applies (append-only Dexie version for routines/routineRuns; build; commit "v2 phase 4: routines + today" + tag).

1. ROUTINES CRUD: RoutinesScreen (list grouped morning/afternoon/evening/any, active toggle, drag-order); RoutineEditor: name+emoji, daysOfWeek multi-select, timeOfDay, items list — item picker adds: existing task (pointer), existing habit (pointer), journal prompt (pointer), custom step (title + optional durationMin). Pointer items store {kind, refId}; custom steps get uid via crypto.randomUUID().
2. MATERIALIZATION ENGINE (routinesRepo.materializeRoutinesFor(dateStr)) — implement EXACTLY this contract:
   - runs on app start for TODAY (local date), and when Today screen mounts (idempotent — cheap to call twice);
   - for each active routine whose daysOfWeek includes date's weekday: if a routineRun with [routineId+date] exists → skip (THE idempotency key, compound unique index);
   - create the run row {routineId, date, generatedTaskIds: [], itemState: {}};
   - custom-step items → create real tasks (title = step title, dueAt = date at routine timeOfDay anchor [morning 09:00, afternoon 14:00, evening 19:00 — settings-tunable constants], routineRunId = run.id, lifeAreaId inherited from routine if set) and push ids into generatedTaskIds;
   - pointer items are NEVER copied — Today reads them live.
   Unit tests (vitest): run twice same day = one run; weekday filter; custom steps create tasks with provenance; deleting a routine leaves history runs intact.
3. TODAY DASHBOARD (§3.3 exactly): replace the Upcoming screen with TodayScreen: greeting header (time-aware) + date; NowNext card (next event or routine block within 3h → countdown, else "Nothing scheduled — enjoy"); RoutineCard per active run for today matching current timeOfDay (all day's routines listed, current highlighted): pointer items render live (task checkbox → tasks repo complete+undo; habit circle → habit log today; journal → open today's entry; note → open) and custom-step-generated tasks render from tasks (checking them updates the task); itemState records pointer checks per run; SCHEDULE rail (today's events, tap → timeline); DUE section (overdue first, danger tint, complete inline); HABITS row (today's circles + x/y); JournalPromptSection (from Phase 2A); sticky quick-capture bar → inbox. Section components per §6 hierarchy; each section lazy-renders on scroll if trivial.
4. EDITING SEMANTICS: editing a routine does NOT retro-change existing runs (today's run keeps its item list snapshot — store a itemsSnapshot on the run at creation); tomorrow reflects edits. Document this in ARCHITECTURE.md (it's the sane choice).
5. TIMELINE + CALENDAR integration: routinesRepo.itemsFor(date) now returns routine blocks (from runs) so Phase 3's Timeline renders them labeled 🔁; month view ignores routines (too noisy) — correct per spec.
6. ROUTINE TEMPLATES: Phase 1 'routine' template kind gets UI (save routine as template / create from template).

Show plan + materialization test list, wait for "go".
```

**✅ Verify**
- [ ] Create "Morning launch" (Mon–Fri, morning): custom step "Glass of water", pointer to habit "Walk", pointer to today's journal. Materializes on next app open (today, if weekday matches); Today shows the card; checking the habit circle logs the habit everywhere; the custom step exists as a real task (visible in Tasks, due 09:00, carries routine provenance).
- [ ] Close and reopen app 5× → still ONE run, no duplicate tasks (idempotency).
- [ ] Change device date to tomorrow (matching weekday) → new run; to Saturday → no run for weekday-only routine.
- [ ] Edit routine after today's run → today unchanged, tomorrow reflects edit.
- [ ] Today shows NowNext countdown, schedule, due (overdue on top in danger tint), habits x/y, journal prompt; capture bar files to inbox in <3s.
- [ ] Timeline (Phase 3) now shows routine blocks for today.
- [ ] Flag 'routines' OFF → Today degrades gracefully to sections it can render (no crashes), routine nav entries hidden.
- [ ] Smoke test green; tag `v2.0-phase4`.

**⚠️ Pitfalls**
- Materialization firing repeatedly (every mount) → the compound-unique `[routineId+date]` guard must be the first thing checked; unit-test double invocation.
- Midnight rollover: app left open overnight → add a date-change listener (or interval minute-check) that re-materializes when local date flips.
- Pointer items copied into tasks → reject any duplication: pointers render live; only custom steps become tasks.

---

### PHASE 5 — Canvas & Ink

**Prompt:**

```
Read EXPANSION_PLAN.md §4 (Stroke/CanvasDoc/CanvasEntity), §5.3 (Canvas spec), §6 (features/canvas/engine). Branch v2-expansion. PHASE 5 ONLY (flag 'canvas'). Safety Contract applies (new canvases table, append-only; build; commit "v2 phase 5: canvas" + tag). This is the biggest module — build the engine FIRST, UI second, and keep the engine framework-agnostic (plain TS + Canvas2D).

1. APPROVED DEP: perfect-freehand (MIT) for stroke geometry. Do NOT use tldraw (license) or any whiteboard kit.
2. STROKE MODEL: doc space = CanvasDoc {width: 3000, height: 2000} fixed virtual page (v2.0 — no infinite canvas); strokes store points [x,y,pressure] in doc space, pressure from PointerEvent.pressure (mouse → simulatePressure). Stroke = immutable; editing = replace in array.
3. RENDERER (engine/renderer.ts): two stacked <canvas> layers — static (all committed strokes, redrawn only on change/transform) + active (current in-progress stroke, redrawn per pointermove via requestAnimationFrame). Stroke outline from perfect-freehand getStroke(points,{size, thinning: pen 0.6 / brush 0.85 / highlighter 0, smoothing 0.5, streamline: pen 0.4 / brush 0.6 / highlighter 0.7, simulatePressure when pointerType==='mouse'}) → convert outline to Path2D with the standard getSvgPathFromStroke algorithm → fill. Highlighter: globalAlpha 0.35 + globalCompositeOperation 'multiply', flat wide stroke (size×3), rounded caps. Pen: crisp, pressure-tapered. Brush: softer thinning + slight size jitter (seeded by stroke id for determinism — same doc renders identically everywhere). touch-action:none on the surface; coalesced events (getCoalescedEvents) when available for smooth fast strokes.
4. HISTORY (engine/history.ts): undo/redo stacks of doc snapshots (strokes array refs — structural sharing, cap 50). Eraser = stroke-level: pointer drag hit-tests strokes (point-segment distance < size/2 + 4px tolerance, newest first), removes whole strokes (with undo).
5. TRANSFORM (engine/transform.ts): pan/zoom matrix (pinch on touch, space+drag/wheel on desktop), zoom 0.25–4× with badge; screen↔doc conversion used by input + renderer + hitTest.
6. EDITOR SCREEN: per §5.3 — bottom pill toolbar (pen/brush/highlighter/eraser + contextual color dots [8 from area palette + ink black/white] + 3 size dots), top bar (back, title inline-edit, undo/redo, zoom, export, link-to-note, ⋯ menu: clear, doc info). New canvas = Capture sheet "New Drawing". Autosave doc to canvases table debounced 1s after last stroke; regenerate 512px thumbBlob (offscreen render, debounce 3s).
7. LIST SCREEN /canvas: masonry thumbnail grid (thumbBlob, object URLs revoked on unmount), title/date, search by title+tags, life-area filter chips; create FAB; swipe → trash (trashedAt, restorable — same policy as notes).
8. NOTE INTEGRATION: "Link to note" picker (search notes) sets linkedNoteId; note editor optional tray shows linked canvases as thumb chips; "Export PNG" (2× offscreen render → Blob) either downloads or attaches to the linked note via the existing attachments repo (attachment kind 'image', ownerType generalized if Phase-3-of-original-plan left it note-only — keep append-only schema).
9. PERF GATES: 500-stroke doc renders initial frame < 300ms; drawing latency imperceptible (active layer only); 20 canvases list scrolls 60fps. Test on the Capacitor Android build too (WebView pointer events parity) before tagging.

Show plan (engine module boundaries + event flow diagram) and wait for "go".
```

**✅ Verify**
- [ ] Pen: smooth pressure-tapered strokes (test with a stylus if you have one; mouse = simulatePressure still looks organic). Brush: softer/wider. Highlighter: translucent, overlapping strokes darken (multiply), no opaque blobs.
- [ ] Eraser removes whole strokes; undo restores; 50-step undo survives; redo works.
- [ ] Pinch-zoom + pan keep strokes crisp (vector re-render, not bitmap stretch); zoom badge accurate.
- [ ] Draw → background the app → return: strokes persisted; thumbnail in list matches; kill dev server, hard reload → still there (IndexedDB).
- [ ] Export PNG → correct image at 2×; attach-to-note → shows as image attachment in that note; export/import JSON round-trip carries canvases (doc + thumb).
- [ ] Fast scribble shows no lag/jaggies (coalesced events working).
- [ ] Android APK (debug build): drawing works with touch; no scroll-gesture fights (touch-action none).
- [ ] Smoke test green; tag `v2.0-phase5`.

**⚠️ Pitfalls**
- Jittery/dotty strokes → missing `getCoalescedEvents` handling or streamline too low; also confirm pressure default 0.5 for mouse (not 0).
- Whole-doc redraw per pointermove (battery/latency) → enforce the 2-layer split; static layer redraws ONLY on commit/transform.
- Highlighter erases what's under it (destination-out confusion) → highlighter must never use destination-out; eraser is data-level stroke removal, not pixel compositing.
- Object URL leaks in the grid → revoke on unmount (Stage 3 lesson).

---

### PHASE 6 — Focus Pro · Habit Analytics · Insights Hub

**Prompt:**

```
Read EXPANSION_PLAN.md §4 (TimerPreset), §5.3 (Habits analytics + Insights specs), §6. Branch v2-expansion. PHASE 6 ONLY (flags 'focusPro', 'habitAnalytics', 'insights'). Safety Contract applies (timerPresets table append-only version; focusSessions gains presetId+kind — re-declare ONLY if indexes change; build; commit "v2 phase 6: focus + analytics" + tag).

1. FOCUS PRO: timerPresets per §4, seeded: Classic Pomodoro (25/5/15, 4 cycles), Deep Work (50/10/30, 2), Quick (15/3/0, 1); PresetsSheet (pick/duplicate/edit/create, isDefault); timer screen uses preset: focus → short break × cycles → long break; autoStart flags; completion chime (WebAudio sine, no asset files) + notification if permitted; sessions log {presetId, kind:'focus'|'break', startedAt, minutes, taskId?}; session history list + weekly stats (focus minutes/day bar chart — inline SVG, no chart lib); "link to task" optional as today. Timer survives route changes (keep engine in a store/context, screen is a view) and uses timestamp-based remaining time (not naive setInterval counting — survives throttled background tabs).
2. HABIT ANALYTICS (flag): habitsRepo pure selectors + HabitDetail screen per §5.3: 12-month Heatmap (design/ui component — 4-step accent alpha via color-mix, today ring, tap cell → day detail sheet), header StatCards (30-day completion %, current streak, best streak, total completions), 8-week trend sparkline (inline SVG), streak logic reuse from Phase 9-original (single well-commented function — extend for 'weekdays' and weekly-target frequencies; unit tests: daily streak across a skipped day, weekly target met/not, month-boundary).
3. INSIGHTS HUB /insights (flag): computed-only cards per §5.3 (captures/week, tasks completed/week by life area, events this week vs last, focus minutes/week, habit consistency 30d, journal streak) each with delta vs previous period (↑↓ flat, success/danger/muted), tap → module. insightsRepo = pure selectors over existing tables, memoized per day (appMeta cache keyed by localDateStr — recompute when date changes, never on every render).
4. TODAY hook: add a subtle weekly "Insights" entry point (header icon) — no new dashboard sections.

Show plan, wait for "go".
```

**✅ Verify**
- [ ] Classic Pomodoro: 25:00 counts down from real timestamps (rotate device / switch tabs 2 min → remaining time still correct); break auto-starts; after 4 focus sessions → long break; chime + notification fire; sessions appear in history with preset name.
- [ ] Timer keeps running when you navigate to Notes and back (screen is a view of the engine).
- [ ] Create custom preset (10/2, 2 cycles) → works; set default → new sessions use it.
- [ ] Habit heatmap: seed 90 days of logs → colors/streaks/30-day % all match manual math; unit tests pass; tap cell shows that day.
- [ ] Insights numbers match the underlying screens (spot-check tasks completed this week); deltas flip sign correctly vs last week; page opens instantly (day-cache working).
- [ ] Flags off → Focus stays as the simple Stage-10 timer; no crashes.
- [ ] Smoke test green; tag `v2.0-phase6`.

**⚠️ Pitfalls**
- setInterval drift/background throttling → timestamp-based remaining time is mandatory (spec'd).
- Insights recomputing on every useLiveQuery tick → day-keyed memo in appMeta, selectors pure.
- Streak double-counting habits logged twice in a day → habitLogs compound [habitId+date] must stay unique (it does since original Stage 9 — verify).

---

### PHASE 7 — Hardening & v2.0 Release

**Prompt:**

```
Read EXPANSION_PLAN.md §2.6, Appendix A (extended smoke). Branch v2-expansion. PHASE 7: hardening + release prep. No new features.

1. PERFORMANCE PASS: verify route-level code splitting for every feature; main bundle ≤ 250kB gz (report actuals per chunk in ARCHITECTURE.md); audit useLiveQuery subscriptions for over-broad collections (no full-table toArray in render paths of big lists); images/thumbs lazy-load; graph + canvas confirm no rAF loops running when screens are unmounted.
2. A11Y PASS: all interactive elements have aria-labels; focus rings visible; sheets trap focus + Escape closes; contrast ≥ 4.5:1 for ink on surfaces in both themes (tokens should already guarantee — verify); reduced-motion kills all animation.
3. REGRESSION: run the FULL extended smoke checklist (EXPANSION_PLAN Appendix A v2) on: desktop Chrome, Android Chrome PWA, and a Capacitor debug APK. Fix everything red. Run /debug/migrate on your real database copy.
4. EXPORT COMPLETENESS AUDIT: JSON export/import round-trip MUST now cover: notes (incl. journal fields), tasks (subtasks, area, provenance), events, people, habits+logs, canvases (doc+thumb), links (or reindex-on-import — document choice), routines+runs, templates, life areas, timer presets, focus sessions, settings+flags. Write the audit as a checklist in ARCHITECTURE.md and verify by: full export → delete all data → import → every screen populated identically.
5. RELEASE: merge v2-expansion → main; versionName 2.0.0 / versionCode+1; build signed AAB; update store listing (new screenshots of Today/Canvas/Graph/Timeline; description bullets); upload to CLOSED track first for your existing testers (real-world regression), then production. Keep tag v2.0.0.

Show plan, wait for "go".
```

**✅ Verify** — the extended Appendix A checklist on all three targets, export audit green, AAB installs from Play internal track, then close the loop: use v2.0 daily for a week before production rollout.

---

## 8. Play Store v2.0 (short, because Stage 12 already taught you the dance)

1. Closed track first (your 12 testers get v2.0 — free regression fleet; watch for crash reports in Play Console for 3–7 days).
2. Production: upload same AAB → staged rollout 20% → 100% after 48h clean.
3. Listing: the expansion IS your marketing — screenshots order: Today → Canvas → Graph → Timeline → Journal → Habits.
4. Data safety unchanged: still zero collection, zero transmission (true until/unless you ever build Stage 13 sync — then the form changes and a real privacy policy rewrite is needed).
5. versionCode discipline: every store upload +1, never reuse; keep the mapping between tags (`v2.0.0`) and versionCodes in ANDROID.md.

---

## Appendix A — Extended smoke checklist v2 (run after EVERY phase)

**Core (from v1):** capture <3s · file as note · search (content+tag) · pin/archive/trash+undo · paste image attachment · export → delete all → import → identical · themes · airplane mode full function · `npm run build` green.

**v2 additions:**
10. Areas: picker opens in task+note editors; seeded colors render.
11. Quick-add: `Pay rent friday #finance @Finance` → correct due/tag/area.
12. Subtasks: parent shows n/m; subtask with due date appears in Today.
13. Journal: today's entry saves; streak number correct; entry excluded from Notes list, included in search.
14. Links: `[[Some Note]]` → backlink visible on target; unresolved link offers create.
15. Graph: opens with seeded data <1.5s; tap node opens note; local graph depth toggle works.
16. Calendar: all 5 views render today correctly; now-line accurate ±1min; slot-tap prefills time.
17. Routines: reopen app 3× → single run; custom step task exists once; pointer habit-check reflects on Habits screen.
18. Today: all sections render with live data; quick-capture still files to Inbox.
19. Canvas: 20 strokes smooth; undo ×5; zoom 4×; reopen → persisted; PNG export valid.
20. Focus: timer survives navigation + tab-throttle; session logged with preset.
21. Insights: matches spot-checked module numbers.
22. Flags: toggle every flag OFF → app fully usable (v1-level), toggle ON → restored. **This line is your rollback insurance — test it every phase.**
23. APK debug build: canvas draws, graph pans, notifications fire.

## Appendix B — Approved dependency additions (v2.0 total)

| Package | Version (Sep 2026) | License | Used in |
|---|---|---|---|
| motion (framer-motion) | 13.x | MIT | Phase 0 — sheets/transitions only |
| @tanstack/react-virtual | 3.x | MIT | Phase 0 — long lists |
| chrono-node | 2.10.x | MIT | Phase 1 — quick-add date parsing |
| d3-force | 3.x | ISC | Phase 2B — graph layout ONLY (no other d3 modules) |
| perfect-freehand | 1.2.x | MIT | Phase 5 — stroke geometry |

Rejected on purpose: **tldraw** (proprietary license/watermark), **FullCalendar** (weight + premium plugins), **excalidraw** (whiteboard ≠ ink; revisit only if you truly want node boards), any chart library (inline SVG is enough), any AI package (v2 stays AI-free per your plan).

## Appendix C — Prompt templates (unchanged from v1 playbook, one addition)

**Schema-phase extra line (paste into ANY prompt that touches Dexie):**
```
Reminder: append-only Dexie versions. When re-declaring a table in a new version, list its COMPLETE index set (primary key + all old + new indexes). Write the upgrade() to be idempotent and safe on empty databases. After implementing, run the /debug/migrate dry-run against a seeded copy and paste me the before/after row counts.
```

## Appendix D — Decision log (pre-made, so future-you knows why)

| Decision | Why | Revisit when |
|---|---|---|
| Journal = notes with kind flag | one data model; search/export/trash free | never |
| Subtasks = tasks with parentTaskId | no new table; subtasks can have own due dates/areas | if you need nested-nested |
| Life Areas ≠ tags | areas are exclusive-ish organization w/ color language; tags stay freeform | if you find yourself mirroring one as the other |
| Routines materialize custom steps as tasks, pointers stay live | no duplication; Today aggregates real entities | if provenance chips get noisy |
| Canvas = fixed 3000×2000 doc, vector strokes in one JSON row | simple, portable, export-friendly; a row stays < a few MB | when docs exceed ~5MB → chunk strokes into a strokes table (append-only migration) |
| Graph = canvas-rendered d3-force, 500-node cap | perf on phones | if you ever cross 5k notes → worker + WebGL (sigma) |
| Timeline in Calendar, not its own nav item | it's a calendar view; nav stays ≤5 | never |

---

*Eight features, zero rewrites: foundation first, one conversation per phase, flags on everything, tags after every green, and the smoke checklist is god. When v2.0 ships, FRICTION.md decides v2.1 — not feature envy.*
