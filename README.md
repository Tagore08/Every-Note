# Notes App

A calm, lightning-fast, local-first personal knowledge base built with React 19, TypeScript, Tailwind CSS v4, and Dexie 4 (IndexedDB). Fully installable as an offline Progressive Web Application (PWA).

All your notes, attachments, and settings stay on your device inside browser storage. Zero tracking, zero telemetry, zero mandatory cloud accounts.

---

## Features

- **Sub-3s Instant Capture**: Global capture dialog via keyboard shortcut (`Ctrl/Cmd+K` or `n`) or prominent floating action buttons across every screen.
- **Reactive Inbox Triage**: Quickly review captured thoughts, promote them to filed notes with one click, or trash them. Real-time unread counts in desktop sidebar and mobile bottom nav.
- **Full-Screen Editor**: Fluid writing experience with ~500ms debounced autosave, reactive save status indicators, and custom tag management.
- **Fully Local Attachments**: Store images (with full-screen lightbox viewer), files, and web links as raw binary Blobs directly in IndexedDB. Supports clipboard image pasting (`Ctrl+V`) and desktop drag-and-drop.
- **Storage Safety & Guards**: Automatic persistent storage requests (`navigator.storage.persist()`), large file size warnings (>15MB) and hard limits (>50MB). Storage dashboard in Settings.
- **Sub-Millisecond Search**: Fast client-side substring search across titles, note bodies, and tags with query snippet highlighting.
- **Organization & Lifecycle**: Pinning (desktop hover + mobile touch long-press with haptic vibration), dedicated Archive view, and soft-delete Trash with automated 30-day purge and permanent deletion guards.
- **Centralized Undo**: 6-second snackbar with reverse-action invocation across all destructive actions (delete, archive, pin, file-as-note).
- **Theme Modes**: Seamless Light, Dark, and System themes following OS preference in real time without page reload.
- **Data Portability**: Full JSON backup export and import (Version 2 format with base64 embedded attachments), offering both Merge and Replace modes, plus a typed confirmation Danger Zone.
- **Installable Offline PWA**: Precached application shell, same-origin asset caching, standalone display, responsive maskable icons, zero-white-flash branded inline HTML splash, and seamless client-side SPA routing (`_redirects`).

---

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Local Database**: [Dexie 4](https://dexie.org/) (IndexedDB wrapper) with reactive queries via `dexie-react-hooks`
- **PWA & Service Worker**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/) (Workbox)
- **Bundler & Dev Server**: [Vite](https://vite.dev/)

---

## Local Development

Ensure you have Node.js 18+ installed.

```bash
# Clone the repository
git clone https://github.com/your-username/notes-app.git
cd notes-app

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build locally
npm run preview
```

---

## Deploy

Notes App is a client-side static Single Page Application (SPA). Because it uses IndexedDB for all persistence, it requires zero backend servers or databases.

### Deploying to Cloudflare Pages via GitHub

1. **Push your repository to GitHub**:
   ```bash
   git remote add origin https://github.com/<your-username>/notes-app.git
   git branch -M main
   git push -u origin main
   ```

2. **Connect to Cloudflare Pages**:
   - Log in to your [Cloudflare Dashboard](https://dash.cloudflare.com/).
   - In the left sidebar, navigate to **Compute (Workers) > Workers & Pages** (or **Pages**).
   - Click **Create application**, choose the **Pages** tab, and select **Connect to Git**.
   - Authenticate with GitHub and select your `notes-app` repository.

3. **Configure Build Settings**:
   - **Project name**: `notes-app` (or your choice)
   - **Production branch**: `main` (or `master`)
   - **Framework preset**: `Vite` (or `None`)
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
   - **Environment variables** (optional):
     - `NODE_VERSION`: `20`

4. **Deploy**:
   - Click **Save and Deploy**.
   - Cloudflare will build the site and deploy it to a free `*.pages.dev` subdomain with automatic SSL.

5. **Client-Side SPA Routing Note**:
   The repository includes `public/_redirects` (`/* /index.html 200`), which Vite automatically outputs to `dist/_redirects`. Cloudflare Pages natively uses this file to route all deep links (such as `/inbox`, `/notes`, `/tags`, `/trash`) directly to `index.html`, ensuring 404-free navigation both online and offline.

---

## Offline & PWA Usage

Once deployed or running on `localhost`:
- **Desktop (Chrome / Edge / Brave)**: Click the install icon in the address bar to install Notes App as a standalone desktop app.
- **iOS (Safari)**: Tap the **Share** button and select **Add to Home Screen**.
- **Android (Chrome)**: Tap the menu and select **Install App** or **Add to Home screen**.
- **Updates**: When a new version is deployed, the app automatically precaches it in the background and presents an in-app "Update available — Reload to apply" snackbar.
