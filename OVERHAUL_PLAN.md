# Notes App — vNext Complete Overhaul Plan
**Second Brain · Modern Minimal UI · Obsidian Knowledge · Todoist Tasks · Habitify Habits · Gamified Focus**

**Target**: Major architectural + visual rewrite on top of the existing free stack  
**Design Goal**: Sleek, minimalist, high-end mobile experience (Dribbble-level polish)  
**Constraint**: Zero paid services, local-first, Capacitor + Vite + React 19 + Dexie + Tailwind  

---

## 1. Vision Summary

Transform the current functional app into a **coherent personal second brain** that feels premium and modern:

- **Visual language**: Clean sans-serif, generous whitespace, fluid cards, smooth micro-interactions, OLED-friendly dark mode, soft warm light mode.
- **Knowledge**: True folder + markdown vault with backlinks and interactive graph (Obsidian-inspired).
- **Capture**: Google Keep-style instant bar (Text / Task / Image / Audio / Drawing / Canvas).
- **Tasks**: Todoist-level (NLP dates, P1–P4, nested subtasks, projects/tags, clean quick-add).
- **Habits**: Habitify-level (streaks, frequency, time-of-day, progress rings).
- **Focus**: Gamified plant growth (3 plants that grow/bloom or wither).
- **Extras**: Smart text expansion / keyboard snippets.
- **Removed**: Life Areas module entirely.

The app remains one unified system, not a collection of mini-apps.

---

## 2. Design System Overhaul (Highest Priority)

### Visual Direction
- Completely discard the current average look.
- Target: modern Dribbble note/task apps — high contrast typography, generous padding, soft elevated cards, refined icons, fluid motion.
- Typography: Clean system / Inter-style hierarchy (large titles, clear body, muted captions).
- Spacing: Generous whitespace, consistent vertical rhythm.
- Cards: Soft radius, subtle shadows or hairline borders, clear hierarchy.
- Gestures: Swipe to complete / archive, long-press menus, drag-and-drop where useful.
- Bottom navigation: Intuitive 4–5 items + central Capture.

### Theme Engine
- Seamless Light / Dark / System.
- Dark: Deep slate / true OLED blacks, high contrast text.
- Light: Soft warm whites and light grays (not pure harsh white).
- Smooth theme transition animation.
- Status bar and native elements follow theme.

### Component Library Rebuild
Rebuild or heavily restyle:
- Cards, lists, section headers
- Bottom sheets / modals
- FAB / Capture bar
- Progress rings, streak indicators
- Empty states, skeletons
- Buttons, chips, priority flags
- Graph visualization container
- Plant growth animation components

All using existing Tailwind + Motion. No new heavy UI libraries.

---

## 3. Information Architecture (Final)

### Primary Navigation (Mobile)
```
Dashboard (Today + Inbox + Insights widgets)
Knowledge (Notes + Folders + Graph)
Tasks
Habits
[Capture]          ← central Keep-style bar / FAB
Library / More     (Canvas, People, Focus, Vault, Settings, Archive, Trash)
```

### Removed
- Life Areas (completely deleted from schema, UI, and filters)
- Separate top-level Insights, Graph, Eisenhower, Journal as primary items

### Dashboard (Merged View)
Single customizable home that combines:
- Inbox quick-capture strip (Keep-style)
- Today overview (routines, due tasks, habits, schedule)
- Lightweight insights widgets (streaks, focus time, completion rate)

User can collapse/expand sections.

---

## 4. Core Systems — Detailed Spec

### 4.1 Knowledge System (Obsidian-style)

**Vault Model**
- Notes live in a virtual folder hierarchy (stored in Dexie, not real filesystem for mobile simplicity).
- Each note has: `path` / `folderId`, title, markdown content, tags, links, backlinks, created/updated, pinned, archived, trashed.
- Quick Notes: separate fast scratchpad layer outside the main folder tree (always one-tap accessible).

**Features**
- Full markdown editing (existing content field + better editor).
- `[[wikilinks]]` with autocomplete (already partially built — strengthen).
- Automatic bidirectional backlinks.
- Interactive Graph View (local graph inside note + global graph).
- Folder tree navigation + search inside vault.
- Note can embed or link to Canvas.
- Attachments remain supported.

**Technical**
- Keep Dexie as source of truth.
- Folder entity + note.folderId (or path string).
- Links table already exists — expand usage.
- Graph uses existing d3-force.

### 4.2 Capture / Inbox (Keep-style)

- Persistent or one-tap Capture bar with quick toggles:
  - Text
  - Task
  - Image
  - Audio (voice)
  - Drawing / Canvas
- Everything starts as temporary Inbox item.
- Fast “File As” conversion to Note / Task / Event / Person / Canvas.
- Voice lands in Inbox by default.

### 4.3 Tasks (Todoist-style)

**Engine**
- Natural language due dates (already have chrono-node — expand usage).
- Priority: P1 (red) → P4 (none) — map existing priority field.
- Nested sub-tasks (parentTaskId already exists).
- Projects = simple project/tag or folder-like grouping.
- Multi-select tags.
- Clean quick-add (FAB or inline).
- Swipe to complete, drag to reorder.
- Views: Today, Upcoming, All, Filtered by project/tag/priority.
- Eisenhower becomes an optional filtered view inside Tasks (not top-level).

### 4.4 Habits (Habitify-style)

**Complete redesign**
- Completion streaks (current + longest).
- Frequency: daily / weekly / custom days.
- Time-of-day buckets: Morning / Afternoon / Evening / Anytime.
- Progress rings or bars for today / week.
- Clean list + detail with heatmap.
- Integration with Routines (routines can reference habits).
- Remove any Life Area dependency.

### 4.5 Focus Mode + Gamification

- Remove history section from main Focus UI (keep data internally if needed for insights).
- While timer runs, one of **3 plant drawings** slowly grows and blooms according to session length.
- Breaking focus early → plant growth halts / withers.
- Simple, delightful, lightweight SVG or canvas animation (no heavy assets).
- Presets remain (Pomodoro, Deep Work, etc.).

### 4.6 Smart Keyboard / Text Expansion

- User-defined snippets (e.g. `#address` → full address).
- When typing the trigger in any text field (notes, tasks, capture), show suggestion chip / inline replacement.
- Stored locally in Dexie.
- Simple settings UI to manage snippets.
- Works offline, zero cost.

### 4.7 Supporting Systems (Keep & Improve)

- **People**: Lightweight relationship context (notes, tasks, events linked to person).
- **Canvas**: Deeply linked & embeddable (previous decision stands).
- **Calendar**: Keep existing day/3-day/week views, improve visual polish.
- **Vault (Password)**: Completely separate encrypted store (previous decision).
- **Routines**: Keep as ordered daily checklists that can include habits & tasks.
- **Search + Command Palette**: Global, fast, action-oriented.

---

## 5. Data Model Changes

### Remove
- LifeArea entity and all foreign keys / filters that reference it.

### Add / Strengthen
- Folder (id, name, parentId, sortOrder)
- Note.folderId (or path)
- QuickNote (separate simple table or flagged notes)
- Snippet (trigger, expansion, createdAt)
- VaultItem (separate encrypted table)
- Focus plant state (session-linked growth progress)
- Stronger use of existing links table for all cross-references

### Keep
- Existing Notes, Tasks (with parentTaskId), Events, People, Habits, HabitLogs, Routines, RoutineRuns, Canvas, Attachments, FocusSessions, etc.

Migration path: Dexie version bump + data migration that nulls lifeAreaId and creates a root folder for existing notes.

---

## 6. Phased Execution Order (Module by Module)

### Phase 0 — Preparation
- Full codebase map
- Backup gate verification
- Feature flag audit

### Phase 1 — Design System & Shell
1. New color tokens (OLED dark + warm light)
2. Typography scale & spacing system
3. Core components (Card, ListRow, Sheet, Button, Chip, ProgressRing, EmptyState…)
4. Bottom navigation + Library sheet
5. Theme engine (Light / Dark / System) with smooth transition
6. Global motion language

### Phase 2 — Knowledge Vault (Obsidian layer)
1. Folder model + migration
2. Note list with folder tree
3. Markdown editor improvements
4. Wikilinks + backlinks hardening
5. Local + Global Graph views
6. Quick Notes scratchpad

### Phase 3 — Dashboard + Capture
1. Merged Dashboard (Inbox strip + Today widgets + light Insights)
2. Keep-style Capture bar with type toggles (Text / Task / Image / Audio / Drawing)
3. Fast File-As conversion flow

### Phase 4 — Tasks (Todoist engine)
1. Priority P1–P4 visual system
2. Nested subtasks UX
3. NLP due date expansion
4. Projects / tags organization
5. Swipe actions + clean quick-add
6. Views (Today, Upcoming, Filtered)

### Phase 5 — Habits (Habitify redesign)
1. New habit model UI (streaks, frequency, time-of-day)
2. Progress rings / bars
3. Heatmap polish
4. Remove all Life Areas references
5. Routine ↔ Habit integration

### Phase 6 — Focus Gamification
1. Remove history from main Focus UI
2. 3 plant growth animations (grow / bloom / wither)
3. Session length → growth mapping
4. Clean timer + preset UI

### Phase 7 — Smart Snippets + Remaining
1. Snippet storage + expansion engine
2. Suggestion UI in text fields
3. People polish
4. Canvas deep linking polish
5. Vault (if not already solid)
6. Global search + command palette

### Phase 8 — Polish & Hardening
- Performance (virtual lists, lazy graphs)
- Offline edge cases
- Export / backup
- Final motion and density pass
- Accessibility basics

---

## 7. Technical Guardrails

- Stay on current free stack only.
- No new paid or heavy dependencies.
- Images compressed before Blob storage.
- Canvas strokes remain compact JSON.
- Graph rendering stays performant (limit visible nodes or use virtualization).
- All animations via existing Motion library or lightweight CSS/SVG.
- Feature flags for progressive rollout of heavy new UI.
- Every schema change goes through backup gate.

---

## 8. Success Criteria

When finished, the app should feel like:

- A modern Dribbble-quality mobile productivity app
- An Obsidian-lite personal knowledge base with real folders + graph
- A Todoist-grade task system
- A Habitify-grade habit tracker
- A delightful Focus experience with living plants
- A single coherent second brain that still opens instantly and works fully offline

Capture is faster than thinking.  
Organization is optional.  
Everything is connected.  
The UI never feels cluttered.

---

## 9. Explicit Non-Goals for this Overhaul

- Real filesystem vault on device (virtual folders in Dexie are sufficient and more reliable on mobile)
- Full Excalidraw clone
- Cloud sync
- Paid AI features
- Heavy analytics dashboards
- CRM-level People
- Life Areas (deleted)

---

**This document is the single source of truth for the vNext overhaul.**

Next step after approval: break Phase 1 into concrete file-level implementation tasks and begin the design system rebuild.

---

*End of vNext Overhaul Plan*
