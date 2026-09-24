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
    │   ├── attachment.ts    # Attachment interfaces (Attachment, AttachmentKind)
    │   ├── task.ts          # Task data contracts (Task, TaskStatus, TaskPriority)
    │   ├── event.ts         # Calendar event and recurrence occurrence contracts
    │   └── person.ts        # Person contracts (Person interface, contact info, notes)
    ├── db/
    │   ├── database.ts      # Dexie 4 database class, schema versions 1-5, and DB singleton
    │   ├── notesRepo.ts     # Data access layer & reactive hooks for notes
    │   ├── attachmentsRepo.ts# Data access layer & reactive hooks for attachments & storage
    │   ├── tasksRepo.ts     # Data access layer & reactive hooks for tasks
    │   ├── eventsRepo.ts    # Data access layer & recurrence occurrence engine
    │   ├── upcomingRepo.ts  # Cross-entity date horizon aggregation engine
    │   └── peopleRepo.ts    # Data access layer & reactive hooks for people
    ├── context/
    │   └── SnackbarContext.tsx # Global ~6s snackbar & undo notification system
    ├── hooks/
    │   └── useTheme.ts      # Light / Dark / System theme manager with live OS listener
    ├── utils/
    │   └── format.ts        # Relative dates, file size formatting, titles, initials, avatar colors
    └── components/
        ├── layout/
        │   └── Shell.tsx    # Responsive shell (Desktop sidebar, mobile bottom nav, capture FAB, auto-purge)
        ├── capture/
        │   └── CaptureModal.tsx # Instant capture dialog (autofocus, Enter to save, Esc to close)
        ├── attachments/
        │   ├── AttachmentGallery.tsx # Thumbnails grid, file chips, and link list
        │   ├── AddLinkModal.tsx      # Modal dialog to attach URLs
        │   └── ImageViewerModal.tsx  # Fullscreen image lightbox modal
        ├── people/
        │   ├── PersonAvatar.tsx      # Photo and initial circle avatar component
        │   ├── PersonBadge.tsx       # Reusable inline person chip with clear action
        │   └── PersonPickerModal.tsx # Modal to pick or create person inline
        └── views/
            ├── UpcomingView.tsx     # Home screen date horizon aggregation
            ├── InboxView.tsx        # Quick-capture triage view with "File as note" & soft delete
            ├── NotesView.tsx        # Active notes list (pinned-first, tag filter, long-press pin, card actions)
            ├── NoteEditorView.tsx   # Full-screen editor (~500ms debounced autosave, attachments, tag pills, person picker)
            ├── TasksView.tsx        # Todo & Done segmentation, quick-add, completion gestures
            ├── CalendarView.tsx     # Month grid, day agenda, recurring series math, reminders
            ├── PeopleView.tsx       # Avatar/initial circles, instant name filter, new person dialog
            ├── PersonProfileView.tsx# Editable profile, local photo Blob, auto-lists of events/tasks/notes, delete forever
            ├── SearchView.tsx       # Instant as-you-type local search with highlighted snippets
            ├── TagsView.tsx         # Tag cloud with usage frequencies and filtered note browser
            ├── ArchiveView.tsx      # Archive management and unarchive browser
            ├── TrashView.tsx        # Soft-deleted notes browser, restore, and permanent deletion dialogs
            └── SettingsView.tsx     # Theme choice, storage quota estimate, JSON backup export/import (v5), and danger zone
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

### Schema Version 4 (Stage 6 Events, Calendar & Scheduled Notes)
```ts
this.version(4).stores({
  notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, createdAt, updatedAt',
  attachments: '++id, noteId, ownerType, kind, createdAt',
  tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId',
  events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, *tags, trashedAt, createdAt',
});
```

### Schema Version 5 (Stage 8 People Extension)
```ts
this.version(5).stores({
  notes: '++id, title, *tags, pinned, archived, trashedAt, inbox, scheduledAt, reminderAt, personId, createdAt, updatedAt',
  attachments: '++id, noteId, ownerType, kind, createdAt',
  tasks: '++id, status, priority, dueAt, completedAt, createdAt, updatedAt, importance, urgency, *tags, trashedAt, sourceNoteId, personId',
  events: '++id, startAt, endAt, recurrence, reminderAt, relatedTaskId, personId, *tags, trashedAt, createdAt',
  people: '++id, name, trashedAt, createdAt, updatedAt',
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
| `scheduledAt` | `Date \| null` (optional) | `scheduledAt` | Calendar scheduled date index |
| `reminderAt` | `Date \| null` (optional) | `reminderAt` | Notification reminder timestamp index |
| `personId` | `number \| null` (optional) | `personId` | Optional linked person ID index |
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
| `personId` | `number \| null` (optional) | `personId` | Optional linked person ID index |

#### Table: `events` (Realized in Stage 6)
| Field | Type | Dexie Index Key | Description |
|---|---|---|---|
| `id` | `number` (optional) | `++id` (Primary Key) | Auto-incrementing primary key |
| `title` | `string` | — | Event title |
| `description` | `string` (optional) | — | Event notes or agenda description |
| `startAt` | `Date` | `startAt` | Fixed time block start timestamp index |
| `endAt` | `Date \| null` (optional) | `endAt` | Fixed time block end timestamp index |
| `allDay` | `boolean` | — | All-day event flag |
| `recurrence` | `'none' \| 'daily' \| 'weekly' \| 'monthly'` | `recurrence` | Recurrence series pattern index |
| `reminderAt` | `Date \| null` (optional) | `reminderAt` | Notification reminder timestamp index |
| `personId` | `number \| null` (optional) | `personId` | Optional contact or attendee reference index |
| `relatedTaskId` | `number \| null` (optional) | `relatedTaskId` | Optional related task ID index |
| `tags` | `string[]` | `*tags` (multiEntry) | Multi-entry index for tag lookups |
| `createdAt` | `Date` | `createdAt` | Creation timestamp index |
| `updatedAt` | `Date` | — | Last modification timestamp |
| `trashedAt` | `Date \| null` (optional) | `trashedAt` | Soft-delete timestamp index |
| `exceptions` | `EventException[]` (optional) | — | Single-occurrence overrides or cancellations |

#### Table: `people` (Realized in Stage 8)
| Field | Type | Dexie Index Key | Description |
|---|---|---|---|
| `id` | `number` (optional) | `++id` (Primary Key) | Auto-incrementing primary key |
| `name` | `string` | `name` | Person name, indexed for fast filtering & sorting |
| `photoBlob` | `Blob` (optional) | — | Stored inline as raw binary Blob in IndexedDB |
| `contactInfo` | `string` (optional) | — | Freeform text lines (e.g., email, phone, handle) |
| `notes` | `string` (optional) | — | Freeform biographical or relationship notes |
| `createdAt` | `Date` | `createdAt` | Creation timestamp index |
| `updatedAt` | `Date` | `updatedAt` | Last modification timestamp index |
| `trashedAt` | `Date \| null` (optional) | `trashedAt` | Soft-delete timestamp index |

> **CRITICAL Data-Model Rule**: An event's `startAt`/`endAt` represents a fixed scheduled time block. It is completely separate from a task's `dueAt`. These date fields are never merged or conflated.

### Versioning & Migrations Policy
1. **Monotonic Version Numbers**: Every schema alteration increments the version number by 1 (`version(1)`, `version(2)`).
2. **Schema Declaration vs Index Changes**:
   - In Dexie, `.stores()` defines only indexed keys. Adding unindexed fields does *not* require a new version.
   - Adding or modifying an index requires a new `this.version(N).stores({...})` declaration.
3. **Non-Destructive Evolution**:
   - Prior version declarations remain in code so users upgrading across multiple releases are migrated sequentially and safely without data loss.

---

## 3. Data Access & State Management Approach

### Repository Pattern (`src/db/notesRepo.ts`, `src/db/attachmentsRepo.ts`, `src/db/tasksRepo.ts`, `src/db/eventsRepo.ts`, `src/db/upcomingRepo.ts` & `src/db/peopleRepo.ts`)
- **Isolation**: Screens and UI components **never** call Dexie directly. All read queries and write mutations pass through the repository layer.
- **Sync Extension Point**: The repository layer isolates all storage access. When cross-device sync is added in later stages, change log interception and conflict resolution will hook directly into the repos without modifying views.
- **Cascading Deletions & Reference Cleanup**: Permanent note deletions (`deletePermanently`, `emptyTrash`, `purgeOldTrash`, `deleteAllNotes`) automatically cascade and purge associated attachments. Permanent person deletion cleans up references in linked events, tasks, and notes by setting `personId: null` in a single Dexie transaction. Tasks and events linked via informational references are never destroyed when notes are removed.

### Reactive Reads
- Components consume data via reactive hooks (`useInboxNotes`, `useActiveNotes`, `useArchivedNotes`, `useTrashNotes`, `useNote`, `useAttachments`, `useTodoTasks`, `useDoneTasks`, `useTodoCount`, `useTask`, `useOccurrencesForRange`, `useTasksDueForRange`, `useScheduledNotesForRange`, `useEvent`, `useUpcomingData`, `usePeople`, `usePerson`, `usePersonEvents`, `usePersonTasks`, `usePersonNotes`) backed by Dexie's `useLiveQuery`.

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

### Stage 6: Events + Calendar
1. **Dedicated Events Data Model (Schema Version 4)**:
   - Dedicated `events` table: `id`, `title`, `description`, `startAt` (Date), `endAt` (Date), `allDay` (bool), `recurrence` ('none'|'daily'|'weekly'|'monthly'), `reminderAt`, `personId`, `relatedTaskId`, `tags`, `createdAt`, `updatedAt`, `trashedAt`, `exceptions`.
   - **Fixed Time Block vs Due Date Separation**: `startAt`/`endAt` define scheduled time blocks on calendar grids. `tasks.dueAt` defines deadline targets. Both are kept strictly segregated in schema.
   - `notes` table schema updated with indexed `scheduledAt` and `reminderAt` fields.
2. **Calendar Screen (`/calendar`)**:
   - Month view: responsive 7-column calendar grid with month navigation, "Today" jumper, and multi-colored activity dots for events (blue), due tasks (amber), and scheduled notes (purple).
   - Day agenda: displays occurrences for selected day chronologically grouped with badges ("Event", "Task", "Note"). Tap-to-edit for events, tap-to-complete circular checkbox for tasks, tap-to-open for scheduled notes.
   - "+ Add Event" quick action pre-filling selected day.
3. **Recurring Series & Dynamic Occurrence Math**:
   - Recurring events are stored as a single master record. Occurrences are computed dynamically across requested date ranges (daily, weekly, monthly) clamped safely to month day counts.
   - Exceptions array stores single-occurrence overrides (`title`, `startAt`, `endAt`, `allDay`, `description`) or cancellations (`cancelled: true`).
   - Modal editor prompts user for scope ("This occurrence only" vs "All occurrences") when editing or deleting recurring event instances.
4. **Note Scheduling in Optional Disclosure**:
   - Note editor exposes "Show me this note on <date>" and reminder time strictly inside a collapsible disclosure section, keeping the primary writing canvas clean and distraction-free.
5. **Browser Notification API Reminders**:
   - Background check runs on app start and every 30 seconds scanning IndexedDB for upcoming/due reminders across events and scheduled notes.
   - Graceful permission prompt in Settings explaining *why* alerts are needed.
   - Tapping an alert focuses the window and navigates to the item.
   - **Offline PWA Limitation**: In client-side offline PWAs without a central push server, web notifications trigger locally via the browser Notification API while the application is running/open in the browser or operating system.
6. **Data Portability & Portability Upgrades (Envelope Version 4)**:
   - JSON export and import envelopes upgraded to Version 4 containing notes, attachments, tasks, events, and settings.
   - Full merge/replace support with undo snapshot rollback.
   - Danger zone wipes events and includes event counts.

### Stage 7: Upcoming View
1. **Pure Read-Only Aggregation**:
   - Zero new database tables or schema bumps (operates reactively on existing Version 4 Dexie tables).
   - Aggregates events (by `startAt`, with dynamic recurrence calculations), active todo tasks (by `dueAt`, `status === 'todo'`), and scheduled notes (by `scheduledAt`).
   - Query efficiency: uses index-friendly filtering and clamps recurrence computations to a 90-day horizon to maintain sub-16ms query speeds even with thousands of records.
2. **Four Date Horizon Sections**:
   - **Today**: overdue tasks pinned at top with prominent alert styling, followed by today's events, tasks, and notes chronologically.
   - **Tomorrow**: items scheduled for the next calendar day.
   - **Next 7 Days**: items scheduled for days 2 through 7 from today, annotated with date headers (e.g. "Wed, Sep 26").
   - **Later**: items scheduled beyond 7 days.
3. **Application Home Screen (`/upcoming`)**:
   - Elevated to the primary starting route of the application (`/` redirects to `/upcoming`).
   - Positioned as the first item in the desktop sidebar and mobile navigation bars.
   - Greeting header with time-of-day greeting ("Good morning", "Good afternoon", "Good evening"), full date format, and aggregated counts subtitle ("3 events · 2 due · 1 overdue").
4. **Seamless Direct Editing & Task Completion**:
   - Tapping any row opens the item in its native modal or view (`EventEditorModal`, `TaskEditorModal`, or full-screen note editor).
   - Tasks feature a 1-tap circular completion button that marks the task done with a 6-second undo snackbar (strictly read-only otherwise; notes and events cannot be accidentally altered from this view).

### Stage 8: People (Minimal)
1. **Dedicated People Data Model (Schema Version 5)**:
   - Dedicated `people` table: `id`, `name`, `photoBlob` (Blob in IndexedDB), `contactInfo` (string lines), `notes` (freeform string), `createdAt`, `updatedAt`, `trashedAt`.
   - Linked `personId` (optional/nullable) indexed across `events`, `tasks`, and `notes`.
   - Dedicated data access repository `src/db/peopleRepo.ts` with reactive hooks (`usePeople`, `usePerson`, `usePersonEvents`, `usePersonTasks`, `usePersonNotes`).
2. **People Screen (`/people`)**:
   - Live name search filter at top.
   - Clean card grid displaying local photo or deterministic color initial circle, contact lines, and count badges for linked events, tasks, and notes.
   - "+ Add Person" action opening inline creation modal with optional local photo picker.
3. **Person Profile Screen (`/people/:id`)**:
   - Large photo avatar with local file upload, replacement, and removal.
   - Autosaving editable name, freeform contact info lines, and freeform notes.
   - Reactive auto-lists:
     - **Events**: scheduled events linked to person; tap opens `EventEditorModal`.
     - **Tasks**: tasks linked to person with 1-tap circular completion checkbox; tap opens `TaskEditorModal`.
     - **Notes**: notes linked to person with tag pills and relative modification time; tap opens `NoteEditorView`.
   - Soft-delete ("Move to trash") with undo snackbar and "Delete forever" with confirmation dialog that safely unlinks `personId` on all associated records.
4. **Universal "With Person" Picker (`PersonPickerModal`)**:
   - Integrated into `EventEditorModal`, `TaskEditorModal`, and `NoteEditorView`.
   - Search existing people or create a new person inline (name only required) without leaving the editor.
   - Displays avatar and name chip with quick-remove clear button.
5. **Local Photos**:
   - Photos stored directly as raw Blobs in IndexedDB (matching the Stage 3 attachment pattern).
   - Displayed via object URLs (`URL.createObjectURL`) with memory-safe revocation on component unmount.
6. **Data Portability & Danger Zone (Envelope Version 5)**:
   - JSON export and import envelopes upgraded to Version 5 including `people` with base64 encoded `photoBlob`s.
   - Import restores base64 strings back into native Blobs with merge and replace support.
   - Settings danger zone reports people counts and wipes people data upon typed confirmation.

---

## 5. Future Extension Points

> **Realized Extension Points**:
> - **Attachments** (Stage 3): Generalized entity-type attachments (`ownerType: 'note' | 'task' | 'event'`).
> - **Tasks** (Stage 5): Standalone tasks with due dates, priority, tags, Eisenhower flags (`importance` & `urgency`), and note backlinks.
> - **Events & Calendar** (Stage 6): Fixed time blocks, recurrence series with exceptions, calendar month & agenda views, note scheduling, and local reminders.
> - **Upcoming View** (Stage 7): Pure read-only home screen aggregation across events, tasks, and scheduled notes.
> - **People** (Stage 8): Lightweight local people directory, local photo Blobs, cross-entity links to events, tasks, and notes, profile auto-lists, and inline person creation.

1. **Eisenhower Matrix View**
   - **Target**: 4-quadrant interactive visualization utilizing the existing `importance` and `urgency` task fields.
2. **Habits**
   - **Target**: Daily recurring tracker and streak counter.
   - **DB Extension**: `habits` table (`++id, title, frequency, targetCount`) and `habit_logs` table (`++id, habitId, date, count`).
3. **Sync**
   - **Target**: Cross-device synchronization and backups without a centralized custodial backend.
   - **Design**: Integrated through repository layers with change-vector logging or CRDTs.

