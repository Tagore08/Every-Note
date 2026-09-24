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
    │   ├── note.ts          # Core TypeScript data contracts (Note interface)
    │   └── attachment.ts    # Attachment interfaces (Attachment, AttachmentKind)
    ├── db/
    │   ├── database.ts      # Dexie 4 database class, schema versions 1 & 2, and DB singleton
    │   ├── notesRepo.ts     # Data access layer & reactive hooks for notes
    │   └── attachmentsRepo.ts# Data access layer & reactive hooks for attachments & storage
    ├── context/
    │   └── SnackbarContext.tsx # Global ~6s snackbar & undo notification system
    ├── hooks/
    │   └── useTheme.ts      # Light / Dark / System theme manager with live OS listener
    ├── utils/
    │   └── format.ts        # Relative dates, file size formatting, titles, snippet helpers
    └── components/
        ├── layout/
        │   └── Shell.tsx    # Responsive shell (Desktop sidebar, mobile bottom nav, capture FAB, auto-purge)
        ├── capture/
        │   └── CaptureModal.tsx # Instant capture dialog (autofocus, Enter to save, Esc to close)
        ├── attachments/
        │   ├── AttachmentGallery.tsx # Thumbnails grid, file chips, and link list
        │   ├── AddLinkModal.tsx      # Modal dialog to attach URLs
        │   └── ImageViewerModal.tsx  # Fullscreen image lightbox modal
        └── views/
            ├── InboxView.tsx        # Quick-capture triage view with "File as note" & soft delete
            ├── NotesView.tsx        # Active notes list (pinned-first, tag filter, long-press pin, card actions)
            ├── NoteEditorView.tsx   # Full-screen editor (~500ms debounced autosave, attachments, tag pills)
            ├── SearchView.tsx       # Instant as-you-type local search with highlighted snippets
            ├── TagsView.tsx         # Tag cloud with usage frequencies and filtered note browser
            ├── ArchiveView.tsx      # Archive management and unarchive browser
            ├── TrashView.tsx        # Soft-deleted notes browser, restore, and permanent deletion dialogs
            └── SettingsView.tsx     # Theme choice, storage quota estimate, JSON backup export/import (merge/replace), and danger zone
```

---

## 2. Database Design & Migration Policy

The database runs on client-side **IndexedDB** managed by **Dexie 4**. All data lives completely local to the browser.
Database Name: `NotesAppDatabase`

### Schema Version 1 (Stage 0 & 1 Baseline)
```ts
this.version(1).stores({
  notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt'
});
```

### Schema Version 2 (Stage 3 Attachments Extension)
```ts
this.version(2).stores({
  notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
  attachments: '++id, noteId, ownerType, kind, createdAt'
});
```

### Schema Version 3 (Stage 5 Tasks Extension)
```ts
this.version(3).stores({
  notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, createdAt, updatedAt',
  attachments: '++id, noteId, ownerType, kind, createdAt',
  tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId'
});
```

#### Table: `notes`
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

#### Table: `attachments` (Realized in Stage 3)
| Field | Type | Dexie Index Key | Description |
|---|---|---|---|
| `id` | `number` (optional) | `++id` (Primary Key) | Auto-incrementing primary key |
| `noteId` | `number` | `noteId` | Parent note reference ID |
| `ownerType` | `'note' \| 'task' \| 'event'` | `ownerType` | Generalized entity type (defaults to `'note'`; ready for tasks/events) |
| `kind` | `'image' \| 'file' \| 'link'` | `kind` | Category of attachment |
| `name` | `string` | — | Original filename or link display title |
| `mimeType` | `string` | — | MIME type (e.g. `image/png`, `application/pdf`, `text/uri-list`) |
| `size` | `number` | — | File size in bytes (0 for links) |
| `createdAt` | `Date` | `createdAt` | Timestamp for chronological attachment ordering |
| `data` | `Blob` (optional) | — | Stored inline as raw binary Blob in IndexedDB (never base64 in note) |
| `url` | `string` (optional) | — | Stored URL for links |

#### Table: `tasks` (Realized in Stage 5)
| Field | Type | Dexie Index Key | Description |
|---|---|---|---|
| `id` | `number` (optional) | `++id` (Primary Key) | Auto-incrementing primary key |
| `title` | `string` | — | Task title |
| `description` | `string` (optional) | — | Task detailed notes / description |
| `status` | `'todo' \| 'done'` | `status` | Status index ('todo' or 'done') |
| `priority` | `'none' \| 'low' \| 'medium' \| 'high'` (optional) | `priority` | Priority level index |
| `dueAt` | `Date \| null` (optional) | `dueAt` | Due date timestamp index |
| `completedAt` | `Date \| null` (optional) | `completedAt` | Completion timestamp index |
| `createdAt` | `Date` | `createdAt` | Creation timestamp index |
| `updatedAt` | `Date` | `updatedAt` | Last modification timestamp index |
| `importance` | `boolean` | `importance` | Eisenhower matrix importance flag |
| `urgency` | `boolean` | `urgency` | Eisenhower matrix urgency flag |
| `tags` | `string[]` | `*tags` (multiEntry) | Multi-entry index for tag lookup |
| `trashedAt` | `Date \| null` (optional) | `trashedAt` | Soft-delete timestamp index |
| `sourceNoteId` | `number` (optional) | `sourceNoteId` | Informational backlink to source note ID |

### Versioning & Migrations Policy
1. **Monotonic Version Numbers**: Every schema alteration increments the version number by 1 (`version(1)`, `version(2)`).
2. **Schema Declaration vs Index Changes**:
   - In Dexie, `.stores()` defines only indexed keys. Adding unindexed fields does *not* require a new version.
   - Adding or modifying an index requires a new `this.version(N).stores({...})` declaration.
3. **Non-Destructive Evolution**:
   - Prior version declarations remain in code so users upgrading across multiple releases are migrated sequentially and safely without data loss.

---

## 3. Data Access & State Management Approach

### Repository Pattern (`src/db/notesRepo.ts`, `src/db/attachmentsRepo.ts` & `src/db/tasksRepo.ts`)
- **Isolation**: Screens and UI components **never** call Dexie directly. All read queries and write mutations pass through the repository layer.
- **Sync Extension Point**: The repository layer isolates all storage access. When cross-device sync is added in later stages, change log interception and conflict resolution will hook directly into the repos without modifying views.
- **Cascading Deletions**: Permanent note deletions (`deletePermanently`, `emptyTrash`, `purgeOldTrash`, `deleteAllNotes`) automatically cascade and purge associated attachments. Tasks linked via `sourceNoteId` are informational and are never deleted when notes are removed.

### Reactive Reads
- Components consume data via reactive hooks (`useInboxNotes`, `useActiveNotes`, `useArchivedNotes`, `useTrashNotes`, `useNote`, `useAttachments`, `useTodoTasks`, `useDoneTasks`, `useTodoCount`, `useTask`) backed by Dexie's `useLiveQuery`.

---

## 4. Feature Milestones

### Stage 1: The Tiny Core
1. **Global Instant Capture**: Quick capture modal with autofocus, Enter to save, Escape to dismiss, sub-3s latency.
2. **Inbox View**: Reactive inbox triage with relative timestamps, "File as note", and soft delete.
3. **Notes View & Full-Screen Editor**: Pinned-first sorting, debounced autosave (~500ms), tag chips.
4. **Instant Search & Tags**: In-memory substring search across titles, content, and tags with snippet highlighting.

### Stage 2: Trustworthy App & Polish
1. **Pinning Interactions**: Mobile touch long-press gesture (~500ms with haptic vibration) + desktop hover.
2. **Archive Flow**: Dedicated Archive view with one-click unarchive; archived notes hidden from active list.
3. **Trash Management & Auto-Purge**: Trashed notes browser, permanent deletion confirmation, 30-day auto-purge on launch.
4. **Unified Undo**: 6-second snackbar with reverse-action invocation across all destructive flows.
5. **Settings & Data Portability**: JSON export/import (merge/replace), and danger zone with typed confirmation (`DELETE ALL`).
6. **Polish Pass**: App name "Notes App" in header; empty states for all views.

### Stage 3: Attachments (Fully Local)
1. **Multi-File Attachments**: File picker in editor supporting multiple files of any type.
2. **Images & Lightbox**: Image thumbnails (jpg/png/webp/gif/svg) in a grid, tap for full-screen viewer with download action.
3. **Clipboard & Drag/Drop**: Paste images (`Ctrl+V`) directly into the editor; drag & drop files onto the desktop workspace.
4. **Links**: Separate "Add Link" action storing URL + title; rendered as clickable cards without remote fetching.
5. **Storage Safety & Guards**:
   - Files > 50 MB are blocked.
   - Files 15–50 MB trigger a quota warning dialog.
   - Auto-requests `navigator.storage.persist()` on first attachment.
   - Storage dashboard in Settings showing used bytes, quota, and persistence status.
6. **HEIC Handling**: `.heic`/`.heif` files stored as raw Blobs and rendered as generic file cards without unsupported browser thumbnail previews or external conversion libraries.
7. **Export & Import (Version 2)**:
   - Full backup export embedding attachments as base64 in a Version 2 envelope (`{ version: 2, app, exportedAt, notes, attachments, settings }`).
   - Import restores base64 strings back to native Blobs in IndexedDB.

### Stage 4: Installable Offline PWA
1. **Workbox Precache & Caching Architecture**:
   - `vite-plugin-pwa` configured in `generateSW` mode.
   - Comprehensive app-shell precache matching `**/*.{js,css,html,ico,png,svg,webmanifest}`.
   - Workbox `navigateFallback: '/index.html'` to guarantee subroute navigation (`/inbox`, `/notes`, `/tags`, `/trash`, etc.) works completely offline without network fallback errors.
   - Strict runtime caching boundary: Only same-origin assets are cached via `StaleWhileRevalidate`. External origins, APIs, or IndexedDB operations are strictly omitted from caching.
2. **Web App Manifest**:
   - Registered manifest: `name: "Notes App"`, `short_name: "Notes"`, `start_url: "/"`, `scope: "/"`, `display: "standalone"`, `orientation: "any"`, `background_color: "#0f172a"`, `theme_color: "#0f172a"`.
3. **Local Icon Generation**:
   - Generated entirely offline via local vector processing (`rsvg-convert` and `convert`).
   - Standard icons: 192x192 PNG, 512x512 PNG, multi-resolution `favicon.ico`, and `favicon.svg`.
   - Adaptive Maskable icon: 512x512 PNG with safe-zone margin (inner icon within 80% circle) to avoid OS clipping on Android adaptive icons.
   - Apple Touch Icon: 180x180 PNG with opaque background for iOS Safari home screen bookmarks.
4. **Zero-White-Flash Branded Splash**:
   - Inline script in `<head>` executes before rendering starts, checking `localStorage` and `matchMedia('(prefers-color-scheme: dark)')` to apply `.dark` class instantaneously.
   - Inline HTML and CSS inside `<div id="root">` presents an animated vector loader in the exact color scheme of the app before React scripts load, smoothly replaced once React 19 mounts.
5. **Static SPA Client-Side Routing**:
   - `public/_redirects` contains `/* /index.html 200` to support static SPA hosts (Cloudflare Pages, Netlify) so all direct URL visits and reloads map cleanly to `index.html`.
6. **PWA Lifecycle & Update Delivery**:
   - `registerType: 'autoUpdate'` with Workbox `clientsClaim: true` and `skipWaiting: true`.
   - Connected to central `useSnackbar` via `useRegisterSW`: prompts user with "Update available — reload to apply latest changes" and a "Reload" action invoking `updateServiceWorker(true)`.

### Stage 5: Tasks
1. **Dedicated Tasks Data Model (Schema Version 3)**:
   - Separate `tasks` table storing `id`, `title`, `description`, `status ('todo'|'done')`, `priority`, `dueAt`, `completedAt`, `importance`, `urgency`, `tags`, `trashedAt`, `sourceNoteId`.
   - Dedicated repository layer `src/db/tasksRepo.ts` with reactive hooks (`useTodoTasks`, `useDoneTasks`, `useTodoCount`).
2. **Tasks Screen (`/tasks`)**:
   - Segments: Todo / Done with reactive badge counts.
   - Quick-add bar: Type task title and press `Enter` to create immediately.
   - Completion toggle: Circular checkbox tap or swipe gesture on touch devices, accompanied by a 6-second undo snackbar.
   - Overdue styling: Tasks with past due dates in `todo` status render with distinct red urgency styling and badges.
   - Tag badges and priority indicators on cards.
3. **Progressive Disclosure Editor (`TaskEditorModal`)**:
   - Cards open a clean modal exposing rich optional fields: due date with presets (*Today*, *Tomorrow*, *Next Week*, *Clear*), priority selector, multiline description, tag pill manager, and subtle Eisenhower matrix toggles (`importance` & `urgency`).
4. **Note-to-Task Conversions**:
   - Note editor: "To Task" action creates a pre-filled task linked to the note via `sourceNoteId` without modifying the note, with undo rollback.
   - Inbox view: "To task" action creates a pre-filled task and files the note out of inbox, with undo rollback.
   - Tasks display a clickable backlink chip navigating directly to the source note when present. Notes and tasks maintain separate lifecycles.
5. **Data Portability & Danger Zone (Envelope Version 3)**:
   - JSON export and import envelopes upgraded to Version 3 including `tasks`.
   - Import supports merging or replacing tasks, with full undo restoration.
   - Danger zone includes task counts and wipes tasks upon typed confirmation.

---

## 5. Future Extension Points

> **Realized Extension Points**:
> - **Attachments** (Stage 3): Generalized entity-type attachments (`ownerType: 'note' | 'task' | 'event'`).
> - **Tasks** (Stage 5): Standalone tasks with due dates, priority, tags, Eisenhower flags (`importance` & `urgency`), and note backlinks.

1. **Eisenhower Matrix View**
   - **Target**: 4-quadrant visualization utilizing the existing `importance` and `urgency` task fields.
2. **Events**
   - **Target**: Calendar scheduling, date-time reminders, and agenda planning.
   - **DB Extension**: `events` table (`++id, noteId, title, startTime, endTime, allDay, recurrenceRule`).
   - **Integration**: Can reuse `attachments` table with `ownerType: 'event'`.
3. **Habits**
   - **Target**: Daily recurring tracker and streak counter.
   - **DB Extension**: `habits` table (`++id, title, frequency, targetCount`) and `habit_logs` table (`++id, habitId, date, count`).
4. **People**
   - **Target**: Contacts, CRM mentions, and attendee links.
   - **DB Extension**: `people` table (`++id, name, email, avatar, *tags, createdAt`).
5. **Sync**
   - **Target**: Cross-device synchronization and backups without a centralized custodial backend.
   - **Design**: Integrated through repository layers with change-vector logging or CRDTs.
