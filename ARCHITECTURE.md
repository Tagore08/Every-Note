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
├── PLAN.md                  # Long-term vision and phase tracking
├── public/                  # Static assets served at root
│   └── favicon.svg          # Application icon
└── src/
    ├── main.tsx             # Application bootstrap & React 19 root
    ├── App.tsx              # Route hierarchy (react-router-dom)
    ├── index.css            # Tailwind CSS v4 setup & theme styles
    ├── types/
    │   └── note.ts          # Core TypeScript data contracts (Note interface)
    ├── db/
    │   └── database.ts      # Dexie 4 database class, schema versions, and DB singleton
    ├── hooks/
    │   └── useTheme.ts      # Class-based light/dark theme manager with localStorage
    └── components/
        ├── layout/
        │   └── Shell.tsx    # Responsive shell (Desktop sidebar & Mobile bottom navigation)
        └── views/
            └── StageZeroPlaceholder.tsx # Placeholder view for routes confirming Stage 0 status
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

## 3. State Management Approach

- **Single Source of Truth**: IndexedDB is the authoritative store for all domain data.
- **Reactive Reads**: Components consume data via `useLiveQuery` from `dexie-react-hooks`. When an IndexedDB transaction commits, Dexie notifies active observable queries and components re-render automatically.
- **Direct Async Mutations**: Writes occur by invoking Dexie operations directly (`db.notes.add`, `db.notes.update`, `db.notes.delete`) inside standard async functions.
- **Transient UI State**: Pure UI states (dark mode, sidebar collapse, active filters, form draft inputs) are maintained via standard React state and hooks (`useState`, custom hooks), with theme selection persisted to `localStorage`. No external global state libraries are required.

---

## 4. Future Extension Points

The architecture is prepared for the following extensions in subsequent stages:

1. **Attachments**
   - **Target**: Storing file attachments (images, PDFs, audio).
   - **DB Extension**: Dedicated `attachments` table (`++id, noteId, name, mimeType, size, createdAt`).
   - **Storage**: Blobs in IndexedDB or direct handles via the Origin Private File System (OPFS) for large payloads.
2. **Tasks**
   - **Target**: Action items, subtasks, checklists.
   - **DB Extension**: `tasks` table (`++id, noteId, title, completed, dueDate, priority, createdAt`).
   - **Integration**: Embeddable task blocks inside notes or aggregate task lists filtered across notes.
3. **Events**
   - **Target**: Calendar scheduling, date-time reminders, and agenda planning.
   - **DB Extension**: `events` table (`++id, noteId, title, startTime, endTime, allDay, recurrenceRule`).
4. **Habits**
   - **Target**: Daily recurring tracker and streak counter.
   - **DB Extension**: `habits` table (`++id, title, frequency, targetCount`) and `habit_logs` table (`++id, habitId, date, count`).
5. **People**
   - **Target**: Contacts, CRM mentions, and attendee links.
   - **DB Extension**: `people` table (`++id, name, email, avatar, *tags, createdAt`).
   - **Integration**: `@mention` linking within note text and relationship mapping.
6. **Sync**
   - **Target**: Cross-device synchronization and backups without a centralized custodial backend.
   - **Design**: Operation log / change-vector table (`sync_log`: `++id, entity, entityId, operation, timestamp, deviceId`) or CRDT integration (e.g., Yjs/Automerge provider).
   - **Transport**: WebRTC peer-to-peer or encrypted user-owned cloud endpoints (WebDAV, local file system export/import).
