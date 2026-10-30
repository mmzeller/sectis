# Sectis

A private to-do app modeled on Things 3. It runs in any modern browser on a Mac or iPhone, works offline, and keeps your data on your own device. There is no account and nothing is sent anywhere.

Version 1.21.0

## What's in it

- **Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook and Trash**
- **Logbook**: completed items move there immediately, once a day or only when you say (Settings). Until then, a to-do you check drops to the bottom of its list a moment later, and unchecking it puts it right back where it was. Prefer them to stay put? **Settings → Completed to-dos → Stay in Place**. To send one there right away, use **Move to Logbook** in its ••• or right-click menu; an unfinished to-do is completed first. Works on a selection and on a completed project too
- **Projects** with notes, headings, a progress circle, When dates and deadlines
- **Areas** to group projects and to-dos (Home, Work…). Click a project in an area to open it in place and see its to-dos; open or close each one, or use Expand All / Collapse All. With a project selected there (or anywhere else, the Board included), `N` or the + button adds a to-do to that project, and an empty project shows a **New To-Do** button. In the sidebar, the arrow beside an area hides or shows the projects under it (⌥-click for every area)
- **One to-do in several places**: ••• → **Also Add To…** puts a to-do in another project or area too. The copies share their title, notes, tags and checklist; check it off in one place, or use **Complete Everywhere**
- **To-dos** with notes, checklists, tags, a When date, a reminder time and a deadline. Click a to-do's checklist count (like 0/4) to show the checklist under it and tick items off without opening it; ⌥-click shows or hides every checklist in the list, and → / ← do it for the selected to-do
- **Formatted notes**: links you can click, plus `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `# headings`, `- bullets`, `1. numbered lists` and `> quotes`. Tap the notes to edit the plain text
- **Checklists** you can reorder by dragging the grip (or ⌘↑ / ⌘↓), and any item can become its own to-do from its ••• menu
- **Repeating to-dos and projects**, on a schedule (every weekday, the last Friday of each month…) or a set time after you finish the last one. A repeating project makes a fresh copy with all its headings and to-dos each time
- **Automatic backups**: each device keeps a daily copy for 14 days, plus a copy before big changes. Restore from **Settings → Backups**
- **Templates**: **Save as Template** in a project's ••• menu keeps its headings, to-dos and checklists to reuse; **New Project from Template…** (in **+ New List**) makes a fresh copy, in the template's area. To-dos with checklists can be templates too: **New To-Do from Template…** in any list's ••• menu, or **Add To-Do from Template…** in a project's. Edit them all under **+ New List → Templates**
- **Headings as a board** (Mac): the columns button at the top of a project shows each heading as a column. Drag cards between columns to change their heading, add headings with **Add Heading**, rename them in place, and reorder or resize columns
- **Waiting For**: press `W` (or ••• → **Waiting For…**) to note who a to-do is waiting on and when to follow up. The **Waiting** list groups them by person, and each comes back to Today on its follow-up date
- **Status report**: ••• → **Status Report…** in any list, area, project or the Board gives what got done, what's coming up and who you're waiting on for this week, last week or the last 7 or 30 days, ready to copy, email, share or print
- **Tags**, nestable, with a tag bar on every list to filter it. In **Settings → Manage Tags**, drag a tag's grip (or press ⌘↑ / ⌘↓ in its name) to put tags in your own order, or use **Sort A to Z**; the tag bar, the tag picker and the tags on each to-do all follow that order. Each tag has a soft color, shown everywhere it appears: click its dot in Manage Tags to change it. New tags get a color no other tag is using yet, and a nested tag shares its parent's color unless you give it its own. To-dos added to or moved into a project or area take on its tags (switchable in Settings). Lists show only a to-do's own tags, not the ones it gets from its project or area or ones named after the project or area it's in; change this in **Settings → Tags shown in lists** (Own Only, All or None)
- **Quick Find** (`/`) for lists, projects, tags and to-dos, including the Logbook
- **Quick Entry** (`Q`) that reads dates, deadlines, tags and priority as you type: `Pay rent friday #Home !oct 31 !!`
- **Type a date** anywhere you pick one: `tom`, `fri`, `next week`, `in 3 days`, `oct 24`, `10/24`
- **Drag and drop** to reorder, to move into projects and headings, or onto the sidebar to schedule, complete or delete. On iPhone, press and hold to drag
- **Multi-select** (⌘-click or ⇧-click on a Mac, ••• → Select To-Dos on iPhone). With several selected, use the bar at the bottom, the ••• menu or a right-click to tag, schedule, move, set a deadline, complete or delete them all at once
- **Undo** for everything (`⌘Z`)
- **Keyboard shortcuts** for nearly everything. Press `?` in the app to see them all
- **Board** (Mac): put projects and areas side by side in columns, like a kanban board. Use **Add Column**, **Add to Board** in any project or area's ••• menu (or right-click it in the sidebar), or an area's **Open as Board** to lay out all its projects. Drag to-dos between columns, check them off, or add new ones with each column's +. Drag a column's right edge to make it wider or narrower (double-click the edge to fit automatically). Press `8` to open it
- **Priority** (optional): High, Medium or Low on any to-do or project, shown as **!!!**, **!!** or **!** before its title. Press `P`, use **Priority…** in the ••• or right-click menu (or a selection's), the bars button in an open to-do, or type `!!!`, `!!` or `!` in Quick Entry
- **Sort any list** by priority, deadline, date, title or recently added from its ••• menu (**Sort By…**), or keep your own manual order. **Priority** puts High first; items with the same priority keep your order and ones without go last. In an area it sorts its projects too Each list remembers its sort on each device
- **Compact rows** (Settings → Row spacing, or the Board's ••• menu) fit more to-dos on screen
- **Light and dark** themes that follow your system, or pick one in Settings
- **Share and export**: send any list, area, project, selection or single to-do as text (Messages, Mail, Notes), Markdown, or a spreadsheet file, or print it / save as PDF. Use the share button at the top of any list, project or area, or **Share…** in the ••• menus, the selection bar and a to-do's own menu
- **Backup**: export and import a JSON file. Paste a plain list to add it as to-dos
- **Sync** between your Mac and iPhone through your own Firebase project, encrypted on your device before upload
- **Works with [Sintr](https://github.com/mmzeller/Sintr)**, the meeting-notes app: it sends a meeting's action items here (see below)

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

## Sintr: action items from your meetings

[Sintr](https://github.com/mmzeller/Sintr) takes private meeting notes on your Mac and iPhone. With sync turned on here and your join code saved in Sintr (**Settings → Integrations → Sectis**), Sintr adds each meeting's action items to Sectis, encrypted the same way Sectis encrypts its own:

- **Yours** become to-dos, tagged **Meeting**, with any sub-points as a checklist and the deadline from the meeting.
- **Other people's** ("Send the quote — Dana") go to **Waiting For** under their name, back in Today on the date they gave.
- They land in the **Inbox**, or the **project or area** you pick for that note (or for a whole folder of notes) in Sintr.
- Each one's notes have an **Open in Sintr** link that opens the meeting's note.

Sintr also shows a meeting's to-dos at the end of its note, done or not. On a Mac, clicking one opens it here.

Once Sectis has to-dos from Sintr, **Record in Sintr** appears in the ••• menu of projects, areas and to-dos. It starts a Sintr note with that title, and the meeting's action items come back to the same project or area. Sintr asks before it starts recording.

Sectis opens at a to-do, project or area from its address: add `#todo:ID`, `#project:ID` or `#area:ID` to your Sectis address. Opening a Sintr link from Sectis tells Sintr that address, so Sintr can link back.

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
| When / Deadline / Priority / Tags / Move / Repeat / Waiting For | `S` / `D` / `P` / `#` / `M` / `R` / `W` |
| Move up or down | `⌘↑` `⌘↓` |
| Go to Inbox … Trash, Board | `1` … `8` |
| Delete | `⌫` |
| Undo | `⌘Z` |
