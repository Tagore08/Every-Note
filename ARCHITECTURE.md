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
    ├── App.tsx              # Route hierarchy & global providers
    ├── index.css            # Tailwind CSS v4 setup & theme styles
    ├── types/
    │   └── note.ts          # Core TypeScript data contracts (Note interface)
    ├── db/
    │   ├── database.ts      # Dexie 4 database class, schema versions, and DB singleton
    │   └── notesRepo.ts     # Data access layer & reactive hooks (single sync extension point)
    ├── context/
    │   └── SnackbarContext.tsx # Global ~6s snackbar & undo notification system
    ├── hooks/
    │   └── useTheme.ts      # Light / Dark / System theme manager with live OS listener
    ├── utils/
    │   └── format.ts        # Relative date formatting, display titles, and search snippet helpers
    └── components/
        ├── layout/
        │   └── Shell.tsx    # Responsive shell (Desktop sidebar, mobile bottom nav, capture FAB, auto-purge)
        ├── capture/
        │   └── CaptureModal.tsx # Instant capture dialog (autofocus, Enter to save, Esc to close)
        └── views/
            ├── InboxView.tsx        # Quick-capture triage view with "File as note" & soft delete
            ├── NotesView.tsx        # Active notes list (pinned-first, tag filter, long-press pin, card actions)
            ├── NoteEditorView.tsx   # Full-screen editor (~500ms debounced autosave, pin/archive/trash, tag pills)
            ├── SearchView.tsx       # Instant as-you-type local search with highlighted snippets
            ├── TagsView.tsx         # Tag cloud with usage frequencies and filtered note browser
            ├── ArchiveView.tsx      # Archive management and unarchive browser
            ├── TrashView.tsx        # Soft-deleted notes browser, restore, and permanent deletion dialogs
            └── SettingsView.tsx     # Theme choice, JSON backup export/import (merge/replace), and danger zone
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
- Components consume data via reactive hooks (`useInboxNotes`, `useInboxCount`, `useActiveNotes`, `useArchivedNotes`, `useTrashNotes`, `useNote`, `useSearchNotes`, `useTagsWithCounts`) backed by Dexie's `useLiveQuery`.
- When any transaction commits to IndexedDB, Dexie notifies observable queries and active components re-render automatically.

### Reusable Undo Mechanism (`src/context/SnackbarContext.tsx`)
- Centralized `useSnackbar()` hook and provider.
- Any state-changing or destructive action (delete, archive, unarchive, pin/unpin, file-as-note, restore) dispatches an elevated snackbar with a 6-second lifespan and a single-click reverse operation.

### Theme Engine (`src/hooks/useTheme.ts`)
- Three distinct modes: `light`, `dark`, and `system`.
- `system` mode actively subscribes to OS color scheme changes via `window.matchMedia('(prefers-color-scheme: dark)')` event listener.
- Synchronized with `localStorage` and toggles `.dark` class on root `<html>`.

---

## 4. Feature Milestones

### Stage 1: The Tiny Core
1. **Global Instant Capture**: Quick capture modal with autofocus, Enter to save, Escape to dismiss, sub-3s latency.
2. **Inbox View**: Reactive inbox triage with relative timestamps, "File as note", and soft delete.
3. **Notes View & Full-Screen Editor**: Pinned-first sorting, debounced autosave (~500ms), tag chips.
4. **Instant Search & Tags**: In-memory substring search across titles, content, and tags with snippet highlighting.

### Stage 2: Trustworthy App & Polish
1. **Pinning Interactions**:
   - Mobile touch long-press gesture (~500ms with haptic vibration) to toggle pin.
   - Desktop hover action and editor action bar toggle.
   - Pinned notes display first with subtle accent borders and pin icons.
2. **Archive Flow**:
   - Archive notes directly from list or editor; archived notes are hidden from active lists.
   - Dedicated Archive view with one-click unarchive.
3. **Trash Management & Auto-Purge**:
   - Trashed notes view with single-note permanent delete and "Empty Trash" bulk purge modals.
   - Automatic background purge of notes older than 30 days executed on app launch.
4. **Unified Undo**:
   - 6-second snackbar with reverse-action invocation across all destructive flows.
5. **Settings & Data Portability**:
   - Export backup into expandable JSON envelope (`{ version, app, exportedAt, notes, settings }`).
   - Import JSON with validation, preview dialog, and choice of "Merge" or "Replace everything" strategies.
   - Danger zone with typed confirmation (`DELETE ALL`).
6. **Polish Pass**:
   - Uniform empty states with gentle iconography and copywriting across Inbox, Notes, Search, Archive, and Trash.
   - Official header branding: "Notes App".

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
