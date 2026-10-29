# Sectis

A private to-do app modeled on Things 3. It runs in any modern browser on a Mac or iPhone, works offline, and keeps your data on your own device. There is no account and nothing is sent anywhere.

Version 1.4.0

## What's in it

- **Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook and Trash**
- **Projects** with notes, headings, a progress circle, When dates and deadlines
- **Areas** to group projects and to-dos (Home, Work…)
- **To-dos** with notes, checklists, tags, a When date, a reminder time and a deadline
- **Formatted notes**: links you can click, plus `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `# headings`, `- bullets`, `1. numbered lists` and `> quotes`. Tap the notes to edit the plain text
- **Checklists** you can reorder by dragging the grip (or ⌘↑ / ⌘↓), and any item can become its own to-do from its ••• menu
- **Repeating to-dos and projects**, on a schedule (every weekday, the last Friday of each month…) or a set time after you finish the last one. A repeating project makes a fresh copy with all its headings and to-dos each time
- **Automatic backups**: each device keeps a daily copy for 14 days, plus a copy before big changes. Restore from **Settings → Backups**
- **Tags**, nestable, with a tag bar on every list to filter it
- **Quick Find** (`/`) for lists, projects, tags and to-dos, including the Logbook
- **Quick Entry** (`Q`) that reads dates, deadlines and tags as you type: `Pay rent friday #Home !oct 31`
- **Type a date** anywhere you pick one: `tom`, `fri`, `next week`, `in 3 days`, `oct 24`, `10/24`
- **Drag and drop** to reorder, to move into projects and headings, or onto the sidebar to schedule, complete or delete. On iPhone, press and hold to drag
- **Multi-select** (⌘-click or ⇧-click on a Mac, ••• → Select To-Dos on iPhone). With several selected, use the bar at the bottom, the ••• menu or a right-click to tag, schedule, move, set a deadline, complete or delete them all at once
- **Undo** for everything (`⌘Z`)
- **Keyboard shortcuts** for nearly everything. Press `?` in the app to see them all
- **Light and dark** themes that follow your system, or pick one in Settings
- **Backup**: export and import a JSON file. Paste a plain list to add it as to-dos
- **Sync** between your Mac and iPhone through your own Firebase project, encrypted on your device before upload

## Put it online with GitHub Pages (for your iPhone)

1. Create a new repository on GitHub named `sectis`.
2. Upload everything in this folder (`index.html`, `sw.js`, `manifest.webmanifest`, `README.md` and the `icons` folder) to the repository.
3. In the repository, open **Settings → Pages**, set **Source** to *Deploy from a branch*, choose `main` and `/ (root)`, and save.
4. After a minute, Sectis is at `https://<your-username>.github.io/sectis/`.

**iPhone:** open that address in Safari, tap **Share → Add to Home Screen**. It opens full screen like an app and works offline.

**Mac:** in Safari choose **File → Add to Dock**, or in Chrome click the install icon in the address bar. It gets its own window and Dock icon.

Each installed copy keeps its own data until you turn on sync (below).

## Run it portably (thumb drive or any folder)

Copy this folder anywhere and double-click `index.html`. Everything works without a server or internet connection.

By default your to-dos are saved inside that browser on that Mac. To keep them **on the drive itself**, use Chrome or Edge:

1. Open Sectis from the drive in Chrome or Edge.
2. Go to **Settings → Your data → Create File…** and save `sectis-data.json` on the thumb drive, next to Sectis.
3. Sectis now saves every change to that file. On another Mac, open Sectis from the drive in Chrome or Edge and choose **Open File…** once to pick up the same file.

Safari can't write to files like this. In Safari, use **Export Backup** and **Import** to carry your data between Macs.

## Sync your Mac and iPhone

Sync uses a Firebase project you own (your budget ledger's project works fine). There are no accounts or passwords. A join code links your devices, and it also encrypts every to-do on your device before it's uploaded, so Firebase only ever stores scrambled data.

**One-time Firebase setup (about 5 minutes)**

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and open your budget ledger project (or create a new project).
2. Click the gear icon → **Project settings**. Under **Your apps**, find the web app and copy its `firebaseConfig` block. If there's no web app, click **</>** to add one (any name), then copy the config it shows.
3. If the project has no Firestore database yet, open **Firestore Database** and click **Create database** (production mode, any location).
4. Open **Firestore Database → Rules**. Paste this block on a new line just inside `match /databases/{database}/documents {`, then click **Publish**:

```
match /sectis/{space}/items/{item} {
  allow read: if space.size() >= 40;
  allow create, update: if space.size() >= 40
    && request.resource.data.keys().hasOnly(['k', 'm', 'd', 'c', 'iv', 't'])
    && request.resource.data.c is string
    && request.resource.data.c.size() < 500000;
}
```

For a brand-new project, the whole rules file looks like this:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /sectis/{space}/items/{item} {
      allow read: if space.size() >= 40;
      allow create, update: if space.size() >= 40
        && request.resource.data.keys().hasOnly(['k', 'm', 'd', 'c', 'iv', 't'])
        && request.resource.data.c is string
        && request.resource.data.c.size() < 500000;
    }
  }
}
```

**Turn it on**

1. On your Mac, open Sectis → **Settings → Sync → Set Up Sync**, paste the config, and click **Turn On Sync**.
2. Click **Copy Code**.
3. On your iPhone, open Sectis → **Settings → Sync → Join with a Code**, paste, and tap **Join**. With Universal Clipboard, what you copied on the Mac pastes straight onto the iPhone.

If the iPhone only has the sample to-dos, they're replaced by your Mac's list. If it has real to-dos, you can keep both or use the synced list.

**How it behaves**

- Changes show up on the other device within a few seconds while both are open.
- Offline changes wait on the device and sync when it reconnects.
- If the same to-do is edited on both devices before they sync, the most recent edit wins.
- Deleting from the Trash, or Erase All Data, removes things on every synced device.
- **Settings → Sync → Add Another Device** shows the code again. **Turn Off on This Device** stops syncing without deleting anything.
- Keep the join code private: anyone who has it can read and change your list. Settings stay separate on each device, such as theme and week start.
- Sync needs internet the first time each device loads it (the Firebase library is then cached for offline use). It doesn't run in the Claude preview.

## Your data

- Stored locally in the browser (or the data file above). Nothing leaves your device unless you turn on sync, and then only in encrypted form.
- Clearing your browser's website data deletes it, so export a backup now and then (**Settings → Export Backup**).
- The sample to-dos can be removed in **Settings → Remove Sample To-Dos**.

## Updates

The installed app checks for a new version when you bring it to the front (and every few hours while it stays open). When one is ready, a message appears with an **Update Now** button. You can also check any time in **Settings**, next to the version number. Updating keeps your to-dos and sync settings, and there's no need to remove Sectis from your Dock or Home Screen.

## Good to know

- Reminders appear while Sectis is open (in a tab or as an installed app). Turn on system notifications in Settings to get them as banners.

## Keyboard shortcuts (Mac)

| Action | Keys |
| --- | --- |
| New to-do | `N` or `Space` |
| New heading in a project | `⇧N` |
| Quick Entry / Quick Find | `Q` / `/` or `⌘F` |
| Open selected to-do | `Return` |
| Complete / Cancel | `K` or `⌘K` / `⌥K` |
| Today / This Evening / Anytime / Someday | `T` / `E` / `A` / `O` |
| When / Deadline / Tags / Move / Repeat | `S` / `D` / `#` / `M` / `R` |
| Move up or down | `⌘↑` `⌘↓` |
| Go to Inbox … Trash | `1` … `7` |
| Delete | `⌫` |
| Undo | `⌘Z` |
