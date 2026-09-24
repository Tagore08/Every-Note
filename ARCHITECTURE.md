# Architecture & Design

This document details the system design, directory layout, storage strategy, and extension points for the local-first personal notes application.

---

## 1. Directory Structure

```
notes-app/
├── index.html               # Single-page application entry HTML
├── vite.config.ts           # Vite configuration (React, Tailwind CSS v4, minimal PWA)
├── tsconfig.json            # Root TypeScript project reference configuration
├── tsconfig.app.json        # TypeScript configuration for application code
├── tsconfig.node.json       # TypeScript configuration for Vite/tooling
├── package.json             # Pinned dependencies and build scripts
├── ARCHITECTURE.md          # Architecture, DB design, and extension roadmap
├── PLAN.md                  # Implementation roadmap and stage tracking
├── public/                  # Static assets served at root
│   └── favicon.svg          # Application icon
└── src/
    ├── main.tsx             # Application bootstrap & React 19 root
    ├── App.tsx              # Route hierarchy (react-router-dom)
    ├── index.css            # Tailwind CSS v4 setup & theme styles
    ├── types/
    │   └── note.ts          # Core TypeScript data contracts (Note interface)
    ├── db/
    │   ├── database.ts      # Dexie 4 database class, schema versions, and DB singleton
    │   └── notesRepo.ts     # Data access layer & reactive hooks (single sync extension point)
    ├── hooks/
    │   └── useTheme.ts      # Class-based light/dark theme manager with localStorage
    ├── utils/
    │   └── format.ts        # Relative date formatting, display titles, and search snippet helpers
    └── components/
        ├── layout/
        │   └── Shell.tsx    # Responsive shell (Desktop sidebar, mobile bottom nav, global capture FAB)
        ├── capture/
        │   └── CaptureModal.tsx # Instant capture dialog (autofocus, Enter to save, Esc to close)
        └── views/
            ├── InboxView.tsx           # Quick-capture triage view with "File as note" & soft delete
            ├── NotesView.tsx           # Active notes list (pinned-first, tag filter, card actions)
            ├── NoteEditorView.tsx      # Full-screen editor (~500ms debounced autosave, tag pills)
            ├── SearchView.tsx          # Instant as-you-type local search with highlighted snippets
            ├── TagsView.tsx            # Tag cloud with usage frequencies and filtered note browser
            └── StageZeroPlaceholder.tsx# Settings view
```

---

## 2. Database Design & Migration Policy

### Current Schema (Version 1)

The database runs on client-side **IndexedDB** managed by **Dexie 4**. All data lives completely local to the browser.

- **Database Name**: `NotesAppDatabase`
- **Table**: `notes`

| Field | Type | Dexie Index Key | Description |
|---|---|---|---|
| `id` | `number` (optional) | `++id` (Primary Key) | Auto-incrementing primary key |
| `title` | `string` | `title` | Note title, indexed for fast filtering & sorting |
| `content` | `string` | — | Note body (unindexed in schema, full-text searched in-memory or via token indexing) |
| `tags` | `string[]` | `*tags` (multiEntry) | Multi-entry index allowing direct lookups of notes matching any tag |
| `pinned` | `boolean` | `pinned` | Fast filtering for pinned notes at top of lists |
| `archived` | `boolean` | `archived` | Archive status flag |
| `trashedAt` | `Date \| null` | `trashedAt` | Soft-delete timestamp (null when active, Date when trashed) |
| `inbox` | `boolean` | `inbox` | Quick-capture triage flag |
| `createdAt` | `Date` | `createdAt` | Creation timestamp, chronological ordering index |
| `updatedAt` | `Date` | `updatedAt` | Last modification timestamp, recency ordering index |

### Versioning & Migrations Policy

1. **Monotonic Version Numbers**: Every schema alteration increments the version number by 1 (`version(2)`, `version(3)`).
2. **Schema Declaration vs Index Changes**:
   - In Dexie, `.stores()` defines only indexed keys. Adding an unindexed field to an entity does *not* require a new database version.
   - Adding or modifying an index requires a new `this.version(N).stores({...})` declaration.
3. **Data Transformations (`.upgrade()`)**:
   - When a schema version changes data representations (e.g. migrating string dates to timestamps or splitting fields), an `.upgrade(tx => ...)` transaction hook is declared.
4. **Non-Destructive Evolution**:
   - Prior version declarations remain in code so users upgrading across multiple releases are migrated sequentially and safely without data loss.

---

## 3. Data Access & State Management Approach

### Repository Pattern (`src/db/notesRepo.ts`)
- **Isolation**: Screens and UI components **never** call Dexie directly. All read queries and write mutations pass through `notesRepo`.
- **Sync Extension Point**: The repository layer isolates all storage access. When cross-device sync is added in later stages, change log interception and conflict resolution will hook directly into `notesRepo` without requiring changes to views.

### Reactive Reads
- Components consume data via reactive hooks (`useInboxNotes`, `useInboxCount`, `useActiveNotes`, `useNote`, `useSearchNotes`, `useTagsWithCounts`) backed by Dexie's `useLiveQuery`.
- When any transaction commits to IndexedDB, Dexie notifies observable queries and active components re-render automatically.

### Transient UI State
- Pure UI states (dark mode, modal visibility, active tag filters, editor draft buffers) are maintained via standard React state and hooks.
- Editor drafts autosave with a ~500ms debounce to prevent excessive IndexedDB writes.

---

## 4. Stage 1: The Tiny Core

Stage 1 delivers the four core flows:

1. **Global Instant Capture**:
   - Visible from every screen: Desktop "+ Capture" button and mobile floating action button (FAB).
   - Global keyboard shortcuts: `Ctrl+K`, `Cmd+K`, or `N` (ignored when focused in inputs/textareas).
   - Autofocus single textarea, `Enter` to save, `Shift+Enter` for newlines, `Esc` to dismiss.
   - Creates a note with `inbox: true`, empty title, and sets timestamps with zero friction.
   - Sub-3-second workflow from app open to saved capture.

2. **Inbox View**:
   - Lists unprocessed notes (`inbox: true, trashedAt: null`), newest first.
   - Real-time badge count on desktop sidebar and mobile navigation bar.
   - Quick actions: "File as note" (toggles `inbox: false` and opens editor) and "Delete" (soft-delete via `trashedAt`).

3. **Notes View & Full-Screen Editor**:
   - Lists all filed notes (`inbox: false, archived: false, trashedAt: null`), pinned notes first then sorted by `updatedAt` desc.
   - Full-screen editor supporting plain text, empty title tolerance, ~500ms debounced autosave, and "Saved" status indicator.
   - Interactive tag manager: type and press `Enter` or `,` to add, click `x` to remove.

4. **Instant Search & Tags**:
   - Local, as-you-type substring search across title, content, and tags using Dexie in-memory filters.
   - Result cards display match snippets with query highlighting.
   - Tags browser listing all unique tags with note counts and one-click filtering.

---

## 5. Future Extension Points

1. **Attachments**
   - **Target**: Storing file attachments (images, PDFs, audio).
   - **DB Extension**: Dedicated `attachments` table (`++id, noteId, name, mimeType, size, createdAt`).
   - **Storage**: Blobs in IndexedDB or direct handles via OPFS.
2. **Tasks**
   - **Target**: Action items, subtasks, checklists.
   - **DB Extension**: `tasks` table (`++id, noteId, title, completed, dueDate, priority, createdAt`).
3. **Events**
   - **Target**: Calendar scheduling, date-time reminders, and agenda planning.
   - **DB Extension**: `events` table (`++id, noteId, title, startTime, endTime, allDay, recurrenceRule`).
4. **Habits**
   - **Target**: Daily recurring tracker and streak counter.
   - **DB Extension**: `habits` table (`++id, title, frequency, targetCount`) and `habit_logs` table (`++id, habitId, date, count`).
5. **People**
   - **Target**: Contacts, CRM mentions, and attendee links.
   - **DB Extension**: `people` table (`++id, name, email, avatar, *tags, createdAt`).
6. **Sync**
   - **Target**: Cross-device synchronization and backups without a centralized custodial backend.
   - **Design**: Integrated through `notesRepo.ts` with change-vector logging or CRDTs.
