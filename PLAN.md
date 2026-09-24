# Implementation Plan & Stage Tracking

## Vision
A calm, lightning-fast, local-first personal knowledge base built with React 19, TypeScript, Tailwind CSS v4, and Dexie 4 (IndexedDB).

---

## Stage Progress

### [x] Stage 0: Foundation
- React 19, TypeScript, Tailwind CSS v4, Vite, and minimal PWA configuration.
- Base responsive application Shell with desktop sidebar and mobile bottom navigation.
- Light/Dark theme switching persisted to `localStorage`.
- Dexie 4 database class with initial Version 1 schema and indexes.

### [x] Stage 1: The Tiny Core
- **1. Fast Capture Flow**:
  - Global `+` action button (desktop sidebar button + mobile bottom-right FAB).
  - Global keyboard shortcuts (`Ctrl/Cmd+K` or `n` outside text inputs).
  - Instant capture modal with autofocus, `Enter` to save, `Shift+Enter` for newline, `Esc` to close.
  - Sub-3-second capture-to-save target.
- **2. Inbox View & Triage**:
  - Reactive inbox note listing (`inbox=true, trashedAt=null`), newest first.
  - Relative time displays and text snippets.
  - Quick action: "File as note" (unsets inbox and navigates to editor).
  - Quick action: "Delete" (soft-delete setting `trashedAt`).
  - Reactive unread count badge in desktop sidebar and mobile bottom nav.
  - "Inbox Zero" empty state.
- **3. Notes View & Full-Screen Editor**:
  - Reactive active notes list (`inbox=false, archived=false, trashedAt=null`).
  - Pinned notes pinned to top, followed by recency (`updatedAt` descending).
  - Full-screen editor with title and plain-text textarea.
  - Autosaves with ~500ms debounce to IndexedDB.
  - Reactive "Saved" / "Saving..." status indicator.
  - Allows empty titles without blocking saves.
  - Tag pill manager: add via `Enter` or `,`, remove with `x` or backspace.
- **4. Instant Search & Tags**:
  - Local as-you-type search across title, content, and tags using Dexie.
  - Substring matching with query snippet highlighting.
  - Tags screen listing all tags with counts and one-click filtering.
- **5. Clean Architecture**:
  - Strict repository pattern (`src/db/notesRepo.ts`). Views never call Dexie directly.
  - Zero-hard-delete policy (`trashedAt`).

---

### [x] Stage 2: Trustworthy App & Polish
- **1. Pinning Interactions**:
  - Mobile touch long-press gesture (~500ms with haptic vibration) to toggle pin.
  - Desktop hover action and editor action bar toggle.
  - Pinned notes render first with subtle accent borders and pin indicators.
- **2. Archive Flow**:
  - Archive action on note cards and editor header; archived notes hidden from active list.
  - Dedicated Archive screen with one-click unarchive.
- **3. Trash Management & Auto-Purge**:
  - Trashed notes browser (`/trash`) with restore and permanent delete confirmation dialogs.
  - "Empty Trash" bulk purge confirmation.
  - Automatic background purge of trashed notes older than 30 days executed on app launch.
- **4. Reusable Undo Mechanism**:
  - Centralized `SnackbarContext` with 6-second lifespan and reverse-action trigger.
  - Connected to all destructive actions: delete, archive, unarchive, pin, unpin, file-as-note, and restore.
- **5. Theme System (Light / Dark / System)**:
  - System mode automatically follows OS `prefers-color-scheme` live without page reload.
  - Persisted in `localStorage` and synchronized with Tailwind v4 `.dark` class.
- **6. Settings & Data Portability**:
  - Full JSON backup export using extensible `{ version, app, exportedAt, notes, settings }` envelope.
  - JSON backup import with validator, preview dialog, and choice of "Merge" or "Replace everything".
  - Danger zone with typed confirmation (`DELETE ALL`).
- **7. Polish Pass**:
  - Header branding updated to "Notes App" across all screens.
  - Gentle illustrations and calm copy for Inbox, Notes, Search, Archive, and Trash empty states.

---

### [x] Stage 3: Attachments (Fully Local - Current)
- **1. Database Schema Extension (Version 2)**:
  - New `attachments` table: `id`, `noteId`, `ownerType` ('note' | 'task' | 'event'), `kind` ('image' | 'file' | 'link'), `createdAt`.
  - Raw binary Blobs stored in IndexedDB (never base64 in note records).
- **2. Editor Attachments Pipeline**:
  - Multiple file picker via "+ Attach" in editor.
  - Image thumbnails grid with full-screen lightbox viewer and download.
  - Generic file cards with formatted sizes for documents, archives, and `.heic`/`.heif` files.
  - Clipboard image paste (`Ctrl+V`) and desktop file drag-and-drop.
  - "+ Add Link" action storing URL + title without remote fetching.
- **3. Storage Safety & Guards**:
  - Hard block on files > 50 MB; confirmation prompt on files 15–50 MB.
  - Automatic `navigator.storage.persist()` request on first attachment.
  - Storage estimation dashboard in Settings with usage and quota progress bar.
- **4. Lifecycle & Deletion Cascading**:
  - Trashing a note preserves attachments; permanent deletion ("delete forever", "empty trash", "delete all data") purges all attachments.
- **5. JSON Backup & Restore (Version 2)**:
  - Exports attachments as base64 inside Version 2 envelope with export size reporting.
  - Import restores base64 back into native Blobs with merge and replace support.

---

### [ ] Stage 4: Markdown & Tasks (Upcoming)
- Markdown preview rendering & live toggle.
- Checklist / task blocks inside notes (reusing attachments with `ownerType: 'task'`).
- People mentions (`@name`).

---

### [ ] Stage 5: Sync & Offline Resilience
- Change log integration in repository layers.
- Peer-to-peer / user-owned cloud synchronization (WebRTC / WebDAV).
