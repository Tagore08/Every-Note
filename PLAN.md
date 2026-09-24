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

### [x] Stage 6: Events + Calendar
- **1. Database Schema Extension (Version 4)**:
  - New `events` table in Dexie: `id`, `title`, `description`, `startAt`, `endAt`, `allDay`, `recurrence` ('none'|'daily'|'weekly'|'monthly'), `reminderAt`, `personId`, `relatedTaskId`, `tags`, `createdAt`, `updatedAt`, `trashedAt`, `exceptions`.
  - Non-destructive Dexie schema evolution: Versions 1, 2, 3, and 4 preserved sequentially.
  - Strict data-model separation: `startAt`/`endAt` fixed time blocks are kept strictly separate from task `dueAt`.
  - Added indexed `scheduledAt` and `reminderAt` fields to existing `notes` table.
  - Dedicated data access repository `src/db/eventsRepo.ts` with recurrence occurrence generator and reactive live queries.
- **2. Calendar Screen (`/calendar`)**:
  - Month view: responsive 7-column calendar grid with month navigation, "Today" jumper, and activity dots for events (blue), due tasks (amber), and scheduled notes (purple).
  - Day agenda: displays occurrences for selected day chronologically grouped with badges ("Event", "Task", "Note"). Tap-to-edit for events, tap-to-complete circular checkbox for tasks, tap-to-open for scheduled notes.
  - "+ Add Event" quick action pre-filling selected day.
- **3. Recurring Series & Dynamic Occurrence Math**:
  - Recurring events are stored as a single master record. Occurrences are computed dynamically across requested date ranges (daily, weekly, monthly) clamped safely to month day counts.
  - Exceptions array stores single-occurrence overrides (`title`, `startAt`, `endAt`, `allDay`, `description`) or cancellations (`cancelled: true`).
  - Modal editor prompts user for scope ("This occurrence only" vs "All occurrences") when editing or deleting recurring event instances.
- **4. Note Scheduling in Optional Disclosure**:
  - Note editor exposes "Show me this note on <date>" and reminder time strictly inside a collapsible disclosure section, keeping the primary writing canvas clean and distraction-free.
- **5. Browser Notification API Reminders**:
  - Background check runs on app start and every 30 seconds scanning IndexedDB for upcoming/due reminders across events and scheduled notes.
  - Graceful permission prompt in Settings explaining *why* alerts are needed.
  - Tapping an alert focuses the window and navigates to the item.
  - Documented limitation: client-side web notifications fire while app is running/open in the browser or OS.
- **6. Data Portability & Danger Zone (Envelope Version 4)**:
  - JSON export and import envelopes upgraded to Version 4 containing notes, attachments, tasks, events, and settings.
  - Full merge/replace support with undo snapshot rollback.
  - Danger zone wipes events and includes event counts.

### [x] Stage 7: Upcoming View
- **1. Pure Read-Only Aggregation**:
  - No new database tables or schema bumps (operates reactively on existing Version 4 Dexie tables).
  - Centralized aggregation repository `src/db/upcomingRepo.ts` with `useUpcomingData()` live query hook.
  - Queries active todo tasks (`status === 'todo'`, `trashedAt == null`), scheduled notes (`scheduledAt != null`, `trashedAt == null`), and event occurrences (computed via `computeOccurrencesForRange`).
- **2. Four Progressive Date Horizons**:
  - **Today**: Overdue tasks pinned at top with distinct alert styling, followed by today's events, tasks, and notes chronologically.
  - **Tomorrow**: Items scheduled for tomorrow.
  - **Next 7 Days**: Items scheduled across days 2 to 7, labeled with date chips.
  - **Later**: Horizon beyond 7 days (recurring events clamped to 90 days for instant query performance).
- **3. Home Screen Elevation (`/upcoming`)**:
  - Elevated to the primary default screen (first nav tab, `/` and `*` redirect to `/upcoming`).
  - Warm time-of-day greeting header ("Good morning", "Good afternoon", "Good evening"), full date, and aggregate status ("3 events · 2 due · 1 overdue").
- **4. Row Semantics & Direct Item Editing**:
  - Contextual time label ("All day", "Due 2:00 PM", "Scheduled", "Overdue"), title, type icon and color badge.
  - Tapping an item opens its native modal or view (`EventEditorModal`, `TaskEditorModal`, or full note editor).
  - 1-tap task completion circular checkbox with 6-second undo snackbar (strictly read-only otherwise).

---

### [x] Stage 8: People (Minimal)
- **1. Database Schema Extension (Version 5)**:
  - New `people` table in Dexie: `id`, `name`, `photoBlob` (Blob), `contactInfo` (string lines), `notes` (freeform string), `createdAt`, `updatedAt`, `trashedAt`.
  - Non-destructive Dexie schema evolution: Versions 1, 2, 3, 4, and 5 preserved sequentially.
  - Linked `personId` (optional/nullable) indexed across `events`, `tasks`, and `notes`.
  - Dedicated repository `src/db/peopleRepo.ts` with reactive hooks (`usePeople`, `usePerson`, `usePersonEvents`, `usePersonTasks`, `usePersonNotes`).
- **2. People Screen (`/people`)**:
  - Live as-you-type name search at top.
  - Responsive cards with local photo or deterministic avatar color circles (`getInitials`, `getAvatarColor`).
  - Contact lines summary and linked counts for events, tasks, and notes.
  - "+ Add Person" action opening inline creation modal with optional local photo picker.
- **3. Person Profile Screen (`/people/:id`)**:
  - Large avatar with local photo upload, replacement, and removal.
  - Autosaving editable name, freeform contact info lines, and notes.
  - Reactive auto-lists:
    - **Events**: scheduled events linked to person; tap opens `EventEditorModal`.
    - **Tasks**: tasks linked to person with 1-tap circular completion checkbox; tap opens `TaskEditorModal`.
    - **Notes**: notes linked to person with tag pills and relative modification time; tap opens `NoteEditorView`.
  - Soft-delete ("Move to trash") with undo snackbar.
  - "Delete forever" with confirmation dialog that safely unlinks `personId` on all associated records in a single Dexie transaction.
- **4. Universal "With Person" Picker (`PersonPickerModal`)**:
  - Integrated into `EventEditorModal`, `TaskEditorModal` (disclosure), and `NoteEditorView` (toolbar + tag chip).
  - Search existing people or create a new person inline (name only required) without leaving the editor.
  - Displays avatar and name chip with quick-remove clear button.
- **5. Local Photos**:
  - Photos stored directly as raw Blobs in IndexedDB (same pattern as Stage 3 attachments).
  - Memory-safe object URL management (`URL.createObjectURL` revoked cleanly on unmount).
- **6. Data Portability & Danger Zone (Envelope Version 5)**:
  - JSON backup export and import upgraded to Version 5 envelope including `people` with base64 encoded photos.
  - Merge and replace import support with undo restoration.
  - Settings danger zone reports people counts and wipes people data upon typed confirmation.

---

### [x] Stage 9: Habits
- **1. Database Schema Extension (Version 6)**:
  - New `habits` table in Dexie: `id`, `name`, `iconOrEmoji`, `frequency ('daily'|'weekdays'|'weekly')`, `targetDaysPerWeek`, `reminderAt`, `archived (bool)`, `createdAt`, `updatedAt`.
  - New `habitLogs` table: `id`, `habitId`, `date ('YYYY-MM-DD')`, `done (bool)`, `value`, `createdAt`, with compound index `[habitId+date]`.
  - Non-destructive Dexie schema evolution: Versions 1 through 6 preserved sequentially.
  - Dedicated repository `src/db/habitsRepo.ts` with reactive hooks (`useHabitsWithStats`, `useHabitsTodaySummary`).
- **2. Habits Screen (`/habits`)**:
  - Big tap-to-complete circles for today's habits with instant visual feedback.
  - Reactive streak counters: current streak (`🔥`) and all-time best streak (`🏆`).
  - Last 30 days dot grid: 30-day timeline strip below each habit (emerald green = completed, slate = incomplete, hover tooltips with date, ring on today).
  - Empty state with guided creation action.
- **3. Consolidated Streak Calculation Engine (`calculateHabitStreaks`)**:
  - Well-commented function in `src/db/habitsRepo.ts`.
  - Daily: consecutive days done (today counts if done; alive from yesterday if not done yet).
  - Weekdays: consecutive weekdays (Mon-Fri) done (weekends skipped).
  - Weekly: consecutive weeks meeting `targetDaysPerWeek` (Mon-Sun).
- **4. Create & Edit Habit Modal (`HabitEditorModal`)**:
  - Habit name, 30-emoji picker grid, frequency choice ('daily', 'weekdays', 'weekly' with target days selector), optional reminder time (HH:MM).
  - Archive/unarchive toggle and permanent delete option with history wipe.
- **5. Archiving Flow**:
  - Archiving hides habits from the active list while preserving all historical logs.
  - Collapsible "Archived Habits" section at the bottom with one-click unarchive.
- **6. Undo Snackbar Integration**:
  - Connected to centralized `useSnackbar`: 6-second undo toast on toggling completion status with instant rollback.
- **7. Upcoming / Home Screen Integration (`UpcomingView`)**:
  - "Today → Habits" row displaying "x of y completed" with progress indicator and 1-tap navigation to `/habits`.
- **8. Local Reminders & Data Portability (Envelope Version 6)**:
  - Habit reminders checked in background via `reminderService.ts`.
  - JSON backup export and import upgraded to Version 6 including `habits` and `habitLogs` with merge/replace and undo rollback.
  - Settings danger zone reports habits count and wipes habits + logs on typed confirmation.

---

### [x] Stage 10: Focus Timer + Eisenhower Matrix
- **1. Database Schema Extension (Version 7)**:
  - New `focusSessions` table in Dexie: `id`, `startedAt`, `minutes`, `taskId?`, `createdAt`.
  - Non-destructive Dexie schema evolution: Versions 1 through 7 preserved sequentially.
  - Dedicated repository `src/db/focusRepo.ts` with `logFocusSession`, `getRecentSessions`, `deleteSession`, and reactive `useRecentFocusSessions(limit)` resolving task titles.
- **2. Focus Timer Screen (`/focus`)**:
  - Default 25:00 countdown with standard presets (15m, 25m, 45m, 60m).
  - Big countdown display with Start / Pause / Reset controls.
  - Screen wake lock integration (`navigator.wakeLock`) keeping display on during active sessions with safe auto-release on pause/reset/unmount.
  - Web Audio API completion chime.
  - Auto-logs completed sessions to IndexedDB `focusSessions` table with start timestamp and duration.
  - 5-minute break mode toggle.
  - Optional "Link to task" picker associating session with an active todo task.
  - "History" tab showing last 20 sessions (date, duration, linked task chip, and delete session action).
- **3. Eisenhower Matrix Screen (`/matrix`)**:
  - 2x2 matrix view over existing tasks using `importance` and `urgency` boolean fields (no new tables needed).
  - 4 Quadrants: Do (urgent+important), Schedule (not urgent+important), Delegate (urgent+not important), Eliminate (not urgent+not important).
  - Desktop HTML5 drag-and-drop between quadrants (updates both booleans in IndexedDB).
  - Mobile long-press gesture (~450ms) opening "Move to..." modal with 4 quadrant options, plus quick menu action.
  - Tap task opens standard `TaskEditorModal`.
  - 1-tap circular completion button with 6-second undo snackbar.
  - Quick-add input per quadrant.
  - Delete task calls `tasksRepo.deleteTask` with standard 6-second undo snackbar.
  - Header button on `/tasks` navigating directly to `/matrix`.
- **4. Data Portability & Settings (Version 7 Envelope)**:
  - Backup export and import upgraded to Version 7 envelope including `focusSessions`.
  - Merge and replace import support with undo restoration.
  - Danger zone reports and wipes focus sessions upon typed confirmation.


