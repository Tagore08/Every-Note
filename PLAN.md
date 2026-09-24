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

### [x] Stage 4: Proper Installable Offline PWA
- **1. Vite PWA & Workbox Configuration**:
  - `vite-plugin-pwa` configured in `generateSW` mode with `autoUpdate`.
  - App shell, icons, html, scripts, and stylesheets fully precached (`**/*.{js,css,html,ico,png,svg,webmanifest}`).
  - Strict runtime caching: same-origin assets cached with `StaleWhileRevalidate`, completely omitting any IndexedDB or external API caching.
  - Workbox `navigateFallback: '/index.html'` to ensure direct visits to `/inbox`, `/notes`, `/tags`, `/trash`, etc., resolve cleanly offline.
- **2. Web App Manifest**:
  - Full PWA manifest: `name: "Notes App"`, `short_name: "Notes"`, `description: "Local-first personal notes"`, `theme_color: "#0f172a"`, `background_color: "#0f172a"`, `display: "standalone"`, `orientation: "any"`, `start_url: "/"`, `scope: "/"`.
- **3. Complete Local Icon Suite**:
  - Vector icon (`public/favicon.svg`), multi-size Windows ICO (`public/favicon.ico`).
  - Standard PWA icons: 192x192 PNG (`pwa-192x192.png`) and 512x512 PNG (`pwa-512x512.png`).
  - Adaptive Android maskable icon with safe margin (`pwa-maskable-512x512.png`).
  - Apple touch icon: 180x180 PNG (`apple-touch-icon.png`).
  - Generated 100% locally with zero external network dependencies or web APIs.
- **4. Instant Theme Flash Prevention & Branded Splash**:
  - Synchronous theme-detection script in `<head>` inspecting `localStorage` and `matchMedia` before DOM paint.
  - Pure inline CSS and SVG loader in `index.html` inside `<div id="root">`, eliminated white flash on load, smoothly replaced once React 19 mounts.
- **5. Client-Side Static SPA Routing**:
  - Added `public/_redirects` (`/* /index.html 200`) for static hosts (Cloudflare Pages, Netlify).
- **6. Service Worker Update Notification**:
  - Registered through `useRegisterSW` in `Shell.tsx` with periodic 60-min checks.
  - Prompts with a persistent snackbar: `"Update available — reload to apply latest changes"` and a `"Reload"` button invoking `updateServiceWorker(true)`.
- **7. Deployment & Verification**:
  - Complete Cloudflare Pages deployment documentation in `README.md`.
  - Production build and preview verification (`npm run build`).

---

### [x] Stage 5: Tasks
- **1. Database Schema Extension (Version 3)**:
  - New `tasks` table in Dexie: `id`, `title`, `description`, `status ('todo'|'done')`, `priority ('none'|'low'|'medium'|'high')`, `dueAt`, `completedAt`, `createdAt`, `updatedAt`, `importance (bool)`, `urgency (bool)`, `tags[]`, `trashedAt`, `sourceNoteId`.
  - Non-destructive Dexie schema evolution: Versions 1, 2, and 3 preserved sequentially.
  - Dedicated data access repository `src/db/tasksRepo.ts` with reactive hooks (`useTodoTasks`, `useDoneTasks`, `useTodoCount`).
- **2. Tasks Screen (`/tasks`)**:
  - Todo / Done segment toggles with reactive item count badges.
  - Quick-add input bar: type title and press `Enter` to create task instantly.
  - Completion toggle: circular checkbox with animation and swipe gesture on mobile touch devices.
  - 6-second undo snackbar allowing instant rollback of completion actions.
  - Prominent overdue styling and warning badges for tasks past their due date in `todo` status.
- **3. Progressive Disclosure Editor (`TaskEditorModal`)**:
  - Clean card surface kept focused; tap card to reveal modal with optional fields.
  - Due date picker with one-click quick presets (*Today*, *Tomorrow*, *Next Week*, *Clear*).
  - Priority selector (`None`, `Low`, `Medium`, `High`) with colored indicators.
  - Multiline description text area.
  - Tag pill manager (add via `Enter` or `,`, remove with backspace or `x`).
  - Subtle Eisenhower matrix toggles (`importance` & `urgency`) without visual clutter.
  - Direct navigation backlink to originating note if converted from a note.
- **4. Explicit Note-to-Task Conversion**:
  - Note editor: "To Task" action creates a pre-filled task linked via `sourceNoteId` without altering the note, with undo rollback.
  - Inbox view: "To task" quick action creates a pre-filled task and files the note out of inbox, with undo rollback.
  - Deleting notes never cascades or destroys converted tasks (independent lifecycles).
- **5. Data Portability & Danger Zone (Envelope Version 3)**:
  - JSON backup export upgraded to Version 3 envelope including all `tasks`.
  - JSON backup import restores and merges/replaces tasks, with undo restoration.
  - Settings danger zone reports task counts and wipes tasks upon typed confirmation.

---

### [ ] Stage 6: Eisenhower Matrix, Markdown & Advanced Features (Upcoming)
- Eisenhower Matrix 4-quadrant interactive visualization view (`urgent` x `important`).
- Markdown preview rendering & live toggle in note editor.
- Checklist / task blocks inside notes.
- People mentions (`@name`).
- Peer-to-peer / user-owned cloud synchronization (WebRTC / WebDAV).
