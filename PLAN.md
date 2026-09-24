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

### [x] Stage 1: The Tiny Core (Current)
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

### [ ] Stage 2: Markdown & Organization (Upcoming)
- Rich plain text / markdown preview rendering.
- Note archiving and trash management view (restore / empty trash).
- Multiple tag selection filters and tag renaming.

---

### [ ] Stage 3: Extensions (Tasks, Attachments & People)
- Checklist / task blocks inside notes.
- File and image attachments stored in IndexedDB / OPFS.
- People mentions (`@name`).

---

### [ ] Stage 4: Sync & Offline Resilience
- Change log integration in `src/db/notesRepo.ts`.
- Peer-to-peer / user-owned cloud synchronization (WebRTC / WebDAV).
