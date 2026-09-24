# Google Play Store Release & Submission Guide

This document is the complete submission, compliance, and testing reference for publishing **Notes App** (`com.tagore.notes`) on the Google Play Store using **Capacitor 8** targeting **Android 16 (API Level 36)**.

---

## 1. Store Listing Copy

### App Title
**Notes App — Local-First Notes** *(29/30 characters)*

### Short Description
**A calm, fast, local-first notes, tasks, calendar, habits, and focus app.** *(73/80 characters)*

### Full Description
```
Notes App is a calm, lightning-fast personal knowledge and productivity system built on a local-first philosophy. Your notes, tasks, calendar, habits, and focus sessions belong to you — stored 100% locally on your device with zero cloud tracking, zero accounts, and complete offline capability.

⚡ LIGHTNING-FAST INSTANT CAPTURE
• Capture thoughts in under 3 seconds with the global capture dialog.
• Instant inbox triage: process ideas, file them as notes, or convert them into actionable tasks with a single tap.

📝 NOTES & RICH WRITING
• Clean writing canvas with instant autosave.
• Multi-entry tag cloud for fluid organization and rapid tag filtering.
• Attach photos, images, PDFs, and documents directly to notes.
• All attachments are stored as native binary data right on your device.

✅ TASKS & EISENHOWER MATRIX
• Flexible task manager with priorities, due dates, and circular one-tap completion.
• Interactive 2×2 Eisenhower Matrix: prioritize work into Do, Schedule, Delegate, and Eliminate quadrants.
• Drag-and-drop tasks between quadrants on desktop or long-press on mobile.
• 6-second undo toast on completion or deletion for peace of mind.

📅 CALENDAR & AGENDA
• Clean month grid and day agenda views.
• Dynamic recurring event engine (daily, weekly, monthly) with single-occurrence exception overrides.
• Schedule notes to resurface on future dates.
• Local on-device reminder notifications.

🎯 FOCUS TIMER
• Pomodoro-style countdown timer with 15m, 25m, 45m, and 60m presets.
• Built-in screen wake lock to keep your display awake during focus blocks.
• Completion chime via Web Audio.
• Optional task linkage and historical focus session log.

🔄 HABIT TRACKING & STREAKS
• Big, satisfying tap-to-complete circles for today's habits.
• Current and all-time best streak calculations for daily, weekday, and weekly cadence.
• Visual 30-day dot grid showing historical consistency at a glance.

👥 PEOPLE DIRECTORY
• Lightweight local people directory with profile photos and contact notes.
• Cross-entity linking: view all events, tasks, and notes associated with any person.

🛡️ 100% LOCAL-FIRST & PRIVATE
• No accounts, no sign-ins, and zero internet trackers.
• Powered entirely by client-side IndexedDB storage on your device.
• Full JSON backup export and import with instant rollback.
• Danger zone for permanent one-click data erasure.
```

---

## 2. Google Play Graphic Assets Specifications

| Asset | Dimensions | Format | Notes |
|---|---|---|---|
| **App Icon** | 512 × 512 px | 32-bit PNG (with alpha) | Max 1024 KB. Clean Notes logo on dark background (`#0f172a`). |
| **Feature Graphic** | 1024 × 500 px | 24-bit PNG or JPEG (no alpha) | Max 15 MB. Highlight core tagline: *"Calm. Fast. 100% Local-First."* |
| **Phone Screenshots** | Minimum 4, max 8<br>Aspect ratio 16:9 or 9:16 (e.g. 1080 × 2400) | JPEG or 24-bit PNG | Showcase: (1) Upcoming Home, (2) Note Editor, (3) Eisenhower Matrix, (4) Habits & Streaks, (5) Calendar Agenda, (6) Focus Timer. |
| **7-Inch Tablet** | 1080 × 1920 or 1200 × 1920 | JPEG or PNG | Demonstrates responsive shell with sidebar. |
| **10-Inch Tablet** | 1600 × 2560 or 1920 × 1200 | JPEG or PNG | Demonstrates widescreen productivity. |

---

## 3. Target API Level 36 Confirmation

- **Google Play Requirement**: As of August 31, 2026, Google Play mandates that all new applications and updates target **API Level 36 (Android 16)** or higher.
- **Verification**: Verified in `android/variables.gradle`:
  ```groovy
  compileSdkVersion = 36
  targetSdkVersion = 36
  minSdkVersion = 24
  ```
- **Compliance Status**: **PASS (100% Compliant)**. Capacitor 8.5 natively targets API 36 out of the box.

---

## 4. Play App Signing & Release Build Steps

Google Play requires the **Android App Bundle (.aab)** format signed with an upload key. Google Play re-signs the app with your private app signing key for end-user distribution.

### Step 1: Generate Release Upload Keystore (One-Time)
Run this command from your terminal:
```bash
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore android/notes-upload-key.jks \
  -alias notes-upload-key \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```
*(Store this file securely and never check it into git; `*.jks` is ignored in `android/.gitignore`)*.

### Step 2: Configure `android/key.properties`
Create `android/key.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=notes-upload-key
storeFile=notes-upload-key.jks
```

### Step 3: Build Signed Release AAB with One Command
Run the automated release script:
```bash
npm run release
```
*(This automatically increments `versionCode` by 1 in `android/app/build.gradle`, builds web assets with `npm run build`, syncs Capacitor, and compiles the signed release bundle).*

Output artifact:
```
android/app/build/outputs/bundle/release/app-release.aab
```

---

## 5. Google Play Data Safety Answers

When completing the **Data Safety** questionnaire in Google Play Console:

| Question | Answer | Rationale |
|---|---|---|
| **Does your app collect or share any user data?** | **No** | All data (notes, tasks, calendar, habits, contacts) is stored locally on the user's device in IndexedDB. Zero data is transmitted to remote servers. |
| **Is all user data collected by your app encrypted in transit?** | **Not applicable** | No data is transmitted over any network. |
| **Do you provide a way for users to request data deletion?** | **Yes** | Users can delete all records at any time via Settings > Danger Zone ("DELETE ALL"), or by clearing app storage / uninstalling. |
| **Is your app targeted at children under 13?** | **No** | General utility / productivity app. |

---

## 6. Content Rating (IARC Questionnaire)

When completing the IARC content rating questionnaire:
- **Category**: Utility, Productivity, Communication or Other.
- **Violence, Fear, Sexual Content, Profanity, Crude Humor**: **No**.
- **Controlled Substances, Alcohol, Tobacco, Drugs**: **No**.
- **User-generated content or user communication**: **No** (The app does not have social feeds, public forums, or chat).
- **Shares current physical location**: **No**.
- **Allows digital purchases**: **No**.
- **Expected Rating**: **Everyone / PEGI 3 / USK 0** (universal accessibility).

---

## 7. Privacy Policy URL

A standalone, responsive, dark/light aware privacy policy is included in the project repository at `public/privacy-policy.html` and `privacy-policy.html`.

- **Host on GitHub Pages**:
  Point GitHub Pages to the `main` branch or `/docs` folder, yielding:
  `https://<username>.github.io/notes-app/privacy-policy.html`
- **Play Console Field**: Paste this URL under **App Content** > **Privacy Policy**.

---

## 8. Two-Minute Closed Tester Smoke Test Checklist

Closed testing requires running standard smoke tests before production rollout. Testers should follow this 2-minute checklist:

| Step | Action | Expected Result | Pass/Fail |
|---|---|---|---|
| **1. Fast Capture** | Tap the blue **+** button (or press `N`). Type `"Test capture"` and tap Save. | Note appears at the top of the **Inbox** tab immediately. | [ ] |
| **2. Notes & Editor** | Open the note, edit content, add tag `#test`, attach a photo or image. Wait 1 second. | "Saved" indicator appears. Image thumbnail displays cleanly. Lightbox opens on tap. | [ ] |
| **3. Tasks & Matrix** | Go to **Tasks**, create a task `"Urgent task"`, toggle importance/urgency to True. Navigate to **Matrix** (`/matrix`). | Task appears in **Quadrant I (Do)**. Drag/move to **Schedule**. Tap circular checkbox to mark done; 6s undo toast displays. | [ ] |
| **4. Calendar** | Open **Calendar**, tap today's date, tap **+ Add Event**, save `"Meeting"`. | Blue event dot appears on date. Day agenda lists the event. | [ ] |
| **5. Habits** | Open **Habits**, tap the large circle on an active habit to mark complete. | Circle fills with animation, streak increments (`🔥 1`), and today's dot in the 30-day grid turns green. | [ ] |
| **6. Focus Timer** | Open **Focus**, select **15m**, tap **Start**. Let it run 5 seconds, tap **Pause**, tap **Reset**. | Countdown ticks down smoothly. Screen remains awake while running. | [ ] |
| **7. People** | Open **People**, tap **+ Add Person**, create `"Alex"`. Link to a task. | Person profile auto-lists the linked task. | [ ] |
| **8. Theme Adaptation** | Tap Theme toggle in sidebar / mobile header. | Colors transition smoothly between Light and Dark mode. Android status bar updates color and contrast. | [ ] |
| **9. Offline & Restart** | Turn on **Airplane Mode** (disable Wi-Fi and Cellular). Force close app and reopen. | App opens instantly without network errors. All notes, tasks, events, and habits are intact. | [ ] |
| **10. Backup Export** | Open **Settings**, tap **Export Backup**. | JSON backup downloads to device containing complete database snapshot. | [ ] |
