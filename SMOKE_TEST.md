# 2-Minute Smoke Test Checklist (Closed Testing)

This checklist verifies all core flows of **Notes App** on Android. It takes approximately 2 minutes to complete.

---

### Tester Information
- **Tester Name**: __________________________
- **Device Model**: __________________________
- **Android OS Version**: ____________________
- **Date Tested**: ___________________________

---

### Step-by-Step Smoke Test

| Step | Action | Expected Result | Pass / Fail |
|---|---|---|:---:|
| **1. Fast Capture** | Tap the floating blue **+** button (or bottom FAB). Type `"Launch checklist"`, tap **Save**. | Note appears immediately at the top of the **Inbox** tab with a "Just now" timestamp. | [ ] PASS<br>[ ] FAIL |
| **2. Notes & Autosave** | Tap `"Launch checklist"`. Type body text, add tag `testing`, tap the **+ Attach** button and pick a photo. | "Saved" indicator shows in top bar. Image thumbnail displays in the attachments gallery. Tapping photo opens lightbox viewer. | [ ] PASS<br>[ ] FAIL |
| **3. Tasks & Matrix** | Go to **Tasks**, type `"Submit build"` in the quick-add bar, press Enter. Tap task, toggle **Important** and **Urgent** ON. Open **Matrix** (`/matrix`). | Task appears in **Quadrant I (Do)**. Drag or long-press to move to **Schedule**. Tap circular checkbox to complete task; 6s undo snackbar displays. | [ ] PASS<br>[ ] FAIL |
| **4. Calendar & Agenda** | Open **Calendar**, tap today's date, tap **+ Add Event**, enter `"Team Sync"`, and tap Save. | Blue event indicator appears on the date cell. The event is listed under the Day Agenda below. | [ ] PASS<br>[ ] FAIL |
| **5. Habits & Streaks** | Open **Habits**. Tap the large circular check on an active habit. | Circle fills with emerald accent. Current streak updates (`🔥 1`), and today's circle in the 30-day dot grid turns green. | [ ] PASS<br>[ ] FAIL |
| **6. Focus Timer** | Open **Focus**, tap **15m** preset, tap **Start**. Wait 5 seconds, tap **Pause**, then **Reset**. | Countdown ticks down accurately. Screen wake lock keeps display active without dimming. | [ ] PASS<br>[ ] FAIL |
| **7. People Directory** | Open **People**, tap **+ Add Person**, enter `"Jordan"`, tap Save. Link to a new task. | Profile opens, showing Jordan's avatar circle, contact notes, and auto-listed linked task. | [ ] PASS<br>[ ] FAIL |
| **8. Theme & Status Bar** | Tap the Theme toggle (sun/moon icon). | App switches smoothly between Light and Dark mode. Android status bar updates background and icon contrast to match. | [ ] PASS<br>[ ] FAIL |
| **9. Airplane Mode & Persistence** | Enable **Airplane Mode** on your device. Force close the app from Android Recent Apps. Reopen **Notes App**. | App launches instantly with zero network errors. All previously created notes, tasks, events, and habits are intact. | [ ] PASS<br>[ ] FAIL |
| **10. Backup Export** | Open **Settings**, tap **Export Backup**. | JSON backup is exported with total note, task, event, habit, and attachment counts reported in snackbar. | [ ] PASS<br>[ ] FAIL |

---

### Notes / Defects Found (if any):
```
[Write any unexpected behavior, UI glitches, or crash notes here]
```
