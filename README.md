# Sectis

A private to-do app modeled on Things 3. It runs in any modern browser on a Mac or iPhone, works offline, and keeps your data on your own device. There is no account and nothing is sent anywhere.

Version 1.45.1

## What's in it

- **Inbox, Today, This Evening, Upcoming, Anytime, Someday, Logbook and Trash**
- **Focus**: show only some areas at a time, like Work or Home. **+ New List → New Focus…** (or **Settings → Focus**) picks the areas it shows and whether to-dos and projects outside any area show too, and can turn it on by itself on a schedule (weekdays from 8 to 5, say; a stretch can run past midnight). Switch at the top of the sidebar: **All**, then each focus, or the ◎ menu once there are more than three. Today, Upcoming, Anytime, Someday, Deadlines, Waiting, the Logbook, tags, smart lists, the Upcoming calendar, status reports, the Board and the sidebar's counts all follow it; Board columns it hides say so, with a way back to All Areas. The **Inbox always shows everything**, so nothing new gets missed, and Quick Find still finds everything: a project or area opened from it shows all of itself. To-dos still in the Inbox count as outside any area: a focus that hides those keeps them out of Today, Deadlines and every other list until you file them, while the Inbox itself still lists them. When a focus hides to-dos outside any area, new ones you make in Today, Deadlines, a tag and similar lists go into its first area so they don't disappear (ones you make in the Inbox stay there). Picking one by hand lasts until the next scheduled change, and **Follow Schedule** in the ◎ menu goes back to it sooner. Focuses sync between devices; which one is on is each device's own
- **Smart lists**: saved filters in the sidebar. **+ New List → New Smart List…** picks tags (any or all), projects and areas, when (Today, Next 7 Days, Scheduled, No Date, Someday), deadline (overdue, within a week or a month…), priority, Waiting For (including waiting 7+ days) and words in the title or notes, with a live count as you choose. They update as to-dos come and go, group by project and area, by date or not at all, sort like other lists, sync between devices, and can be Board columns. **Edit** at the top changes the filters; new to-dos made in one start out fitting it. Drag them in the sidebar to reorder
- **Deadlines**: everything with a deadline, across all projects and areas, soonest first: Overdue, Today, Tomorrow, This Week, then by month. The sidebar shows how many are due within a week, and a red badge for overdue ones. Drop to-dos on it to give them a deadline
- **Notepad**: for things that aren't to-dos, like a serial number, a phone number or what someone said on a call. Open it from any screen with `J`, the notepad button at the bottom of the sidebar, or on iPhone the button at the top of every list. Start typing in the box at the top and it becomes a note (empty ones aren't kept); `⌘↩` starts another. Each note remembers the list, project, area or Board you wrote it on (a Board by its name, so renaming the Board renames the chip), and **Attach To…** in its ••• menu changes that: tick any lists, areas, projects or Boards, as many as you like, and it shows on each of them (a **+N** beside its chip lists the others; **Move to** / **Also Attach to** the page you're on are there too). Its chip takes you back there, and **This Page** shows only the notes written where you are. A page with notes shows a notepad badge with how many in its header; click it to see them (and again to close the Notepad). Search them at the top, or with Quick Find. Notes read formatted, like a to-do's notes (links you can click, `**bold**`, bullets, headings, checkboxes), and **stay formatted while you type**: click anywhere in a note and the caret lands on that spot. Bullets, numbers, checkboxes, headings and quotes always show as themselves, and the line you're on shows its `**`, `*`, `~~`, `` ` `` and link Markdown so you can see what you're changing. **Checkboxes**: write `- [ ] ` (or type `[] ` at the start of a line, or press `⇧⌘L`) and click a box to tick it, in the note or while typing in it, without opening it; ⌘Z undoes a tick. **Return** carries on a list (bullets, numbers, checkboxes, quotes) and Return on an empty item ends it; **Backspace** at the start of an item takes its bullet or checkbox away. **Typing shortcuts**: `⌘B` bold, `⌘I` italic, `⇧⌘X` strikethrough, `⌘E` code, `⌘K` link, `⇧⌘L` checkbox (or tick it), each on the selection or the word you're in, and again to take it off; pasting a link over selected text links it; copying copies the Markdown; `⌘Z` / `⇧⌘Z` undo and redo while you type. The things you keep notes for get a copy button you click once: serial numbers and other labelled values (`Serial:`, `S/N`, `Service Tag`, `Asset`, `Ticket #`, `RMA`, `Key:`…), IP and MAC addresses, license keys, GUIDs, code-like tokens such as `C02XK1JHJG5J`, long numbers and anything in `` `code` ``. Phone numbers become links that call, with their own copy button. A long note shows its first lines with **Show More**. **+ To-Do** on a note makes an Inbox to-do of it (first line the title, the rest its notes), or of just the text you've selected; ••• → **One To-Do per Line** makes a to-do of each line (or of each list item, when the note has a list, so a title above it isn't one; checked-off items are skipped), or of each line you've selected. ••• also pins a note to the top, copies it, shows it as a sticky, moves it to the page you're on, archives it, or deletes it (with Undo). **Archive** puts a note away without deleting it: it leaves the list, but searching the Notepad and Quick Find still find it, and ••• at the top of the Notepad → **Archived Notes** lists them (••• → **Move Out of Archive** brings one back). ••• at the top → **Group by Page** lists your notes under the page each was written on, the page you're on first. **Stickies** (Mac): ••• → **Show as Sticky** pops a note out as a small card of its own that stays on screen on every page, with the Notepad open or closed. Drag its top strip to move it and its edges or corners to resize it; click it to type, Esc when you're done. Its notepad button finds it in the Notepad and ✕ puts it away (the note stays). Each device remembers where its stickies are. Sintr can add a meeting's summary as a note, on the page its to-dos went to. On a wide Mac window it sits beside your list, in a narrower one it slides over it, and on iPhone it fills the screen. On a Mac, drag its left edge to make it wider or narrower (double-click the edge for the usual width). To put it anywhere, drag it by its title, press the float button in its header, or double-click the title: it becomes a window of its own that you can move around and resize from any edge or corner. Drag it back to the right edge of the window (a highlight shows where it'll go) or press the button again to put it back at the side. Each device remembers its own width, and where and how big the floating Notepad was. Notes sync between your devices and are kept in backups
- **Timeline**: your deadlines laid out across the coming weeks or months, under **Deadlines** in the sidebar. Each project with a deadline is a bar from its start (its When date, or the day you made it) to its deadline, filled in as its to-dos get done. Each to-do with a deadline is a flag on its day, or a bar when it also has a start date. They're grouped by area, then project, soonest first, and overdue ones sit at the left edge in red. Pick **2 Weeks**, **Month** or **3 Months**, or **Custom** for any span from a week to a year: click its start or end date to choose another day (from a calendar, or type one like "dec 1" or "jan 31"), or drag its slider to stretch or shrink the span and watch the timeline change as you drag. Spans over nine weeks go by the week. Custom remembers its span when you switch away and back. Page with ‹ ›, and **Today** comes back. Drag a flag (or a bar's right end) to change the deadline, a bar's left end to change its start, or the whole bar to move both; you can undo each change. Click a flag or bar for its dates, a name to open it, or its checkbox to complete it. Each flag or bar has its **name beside it** (with its date), so you don't have to trace back to the list on the left (on iPhone the name is above its row). The **Due** row under the dates shows how much is due each day (each week at 3 Months, or a Custom span over nine weeks), darker as it piles up and orange where it really does; click one for what's due then and open any of it. **Fold** an area or project with the ▸ beside it to one line: a dot on each deadline and how many (⌥-click folds or unfolds them all, or use **Fold All** / **Unfold All** in the ••• menu; what's folded is remembered). **Click an empty day** on a row (a + shows where) to add a to-do due that day in that project or area through Quick Entry, or to move that to-do's or project's deadline there. In the ••• menu, **Scheduled To-Dos Too** adds things that only have a When date, **To-Dos Inside Projects** shows or hides each project's to-dos, and **Names Beside Flags** turns the names off. It follows the focus and the tag bar, fills the window's width, and scrolls sideways when the window is narrow. On iPhone each name sits above its row. Drop to-dos on it in the sidebar to give them a deadline
- **Timeline on a Board**: the timeline button at the top of a Board (or **Show Timeline** in its ••• menu) adds a strip across the top with just that Board's projects, areas and lists, one row per column, so you can see what's due on it at a glance. Each to-do in a row is named beside its flag or bar, and things due (or starting) on the same days get lines of their own in the row, so none hides another. It has its own **2 Weeks** / **Month** / **3 Months** / **Custom** and ‹ › buttons (Custom with the same start and end dates and slider, shared with the Timeline), and works like the Timeline: drag a flag or a bar to move its dates, click one for its menu, the **Due** row shows where things pile up, ▸ folds a row to one line, and clicking an empty day on a row adds a to-do due then (in that project, area, tag or smart list). The ⌃ button folds it away; each Board remembers whether it's showing
- **Upcoming calendar**: a month grid above the Upcoming list shows how many to-dos start each day and a red dot where something's due. Drop to-dos or projects on a day to schedule them, click a day to jump to it in the list, or double-click one to add a to-do on it. The arrows page through months, and the chevron folds it away
- **Logbook**: completed items move there immediately, once a day or only when you say (Settings). Until then, a to-do you check drops to the bottom of its list a moment later, and unchecking it puts it right back where it was. A heading whose to-dos are all done drops below the project's other headings the same way, its title dimmed, and comes back when you reopen one. Prefer them to stay put? **Settings → Completed to-dos → Stay in Place**. Done something weeks ago and only now checked it off? Change when it was completed with **Date Completed…** in its ••• or right-click menu (or a selection's), or click the **Completed** date in the open to-do or a completed project's banner. Typed dates look back: `last fri`, `oct 2`, `3 weeks ago`. The Logbook and status reports follow the new date, and a to-do that repeats after completion counts from it. To send one there right away, use **Move to Logbook** in its ••• or right-click menu; an unfinished to-do is completed first. Works on a selection and on a completed project too. In a project or area, logged to-dos wait at its end behind **Show logged items**, or, with **Settings → Logged to-dos in projects and areas → Under Their Heading**, sit right under the heading (or project or area) they were in, below the completed ones, newest first with the day each was done. **Hide logged items** at the end of the list tucks them away there. The Board and a project's headings board follow the same setting
- **Projects** with notes, headings, a progress circle, When dates and deadlines. Lists nest as Area › Project › Heading › To-do › Checklist: to group to-dos inside a project, use headings. Drag a heading by its name to move it with its to-dos (or use **Move Up** / **Move Down** in its ••• menu, or ⌘↑ / ⌘↓ while renaming it). The + beside a heading adds a to-do under it, and after naming a new heading, Return starts its first to-do. **Move Into Project…** in a project's ••• or right-click menu makes it a heading in another project, with all its to-dos (the emptied project goes to the Trash, keeping its notes); a heading's **Convert to Project** turns it back. A to-do's **Convert to Heading** (or several selected at once) makes it a heading in the same spot of its project, with its checklist items as the to-dos under it
- **Colors** for projects and areas: ••• (or right-click) → **Color…** picks one of the soft tag colors. It tints the icon everywhere, puts a stripe along the top of its Board column, and a dot beside its name under to-dos in Today, Upcoming and other mixed lists (a project without one uses its area's)
- **Areas** to group projects and to-dos (Home, Work…). **Rename** in a project's or area's ••• or right-click menu edits its name right where it is, in an area, any list or on the Board (Return saves, Esc cancels). Click a project in an area to open it in place and see its to-dos; open or close each one, or use Expand All / Collapse All. With a project selected there (or anywhere else, the Board included), `N` or the + button adds a to-do to that project, and an empty project shows a **New To-Do** button. In the sidebar, the arrow beside an area hides or shows the projects under it (⌥-click for every area)
- **One to-do in several places**: ••• → **Also Add To…** puts a to-do in another project or area too. The copies share their title, notes, tags and checklist; check it off in one place, or use **Complete Everywhere**
- **To-dos** with notes, checklists, tags, a When date, a reminder time and a deadline. To give one to-do a deadline, press `D`, use **Deadline…** in its ••• or right-click menu, or click the flag button in the open to-do; **Remove Deadline** in the same menu takes it off (checklist items don't have deadlines of their own). Click a to-do's checklist count (like 0/4) to show the checklist under it and tick items off without opening it; ⌥-click shows or hides every checklist in the list, and → / ← do it for the selected to-do
- **Formatted notes**: links you can click, plus `**bold**`, `*italic*`, `~~strike~~`, `` `code` ``, `# headings`, `- bullets`, `1. numbered lists` and `> quotes`. Tap the notes to edit the plain text
- **Checklists** you can reorder by dragging the grip (or ⌘↑ / ⌘↓), and any item can become its own to-do from its ••• menu. **Copy Checklist** in a to-do's ••• or right-click menu, then **Paste Checklist** on another to-do, or on several selected at once, to add the same items (unchecked; ones a to-do already has are skipped). The items go to your clipboard too, so you can paste them into any checklist's Add item box
- **Copy and paste to-dos**: select one or several and press `⌘C` (or **Copy To-Do** in the ••• or right-click menu), then select a to-do anywhere and press `⌘V` (or **Paste**) to put copies after it, in its project, heading or list; with nothing selected they go into the list you're in. Copies keep the title, notes, tags, checklist (unchecked), deadline and priority. **Paste as Checklist** turns copied to-dos into checklist items on the selected to-dos instead. Lines of text copied in another app paste as one to-do each. Copying something else replaces what's copied, and **Clear Copied Items** in the menu forgets it. On iPhone, Paste is in a to-do's menu and in a list's ••• menu
- **Repeating to-dos and projects**, on a schedule (every weekday, the last Friday of each month…) or a set time after you finish the last one. A repeating project makes a fresh copy with all its headings and to-dos each time
- **Automatic backups**: each device keeps a daily copy for 14 days, plus a copy before big changes. Restore from **Settings → Backups**
- **Templates**: **Save as Template** in a project's ••• menu keeps its headings, to-dos and checklists to reuse; **New Project from Template…** (in **+ New List**) makes a fresh copy, in the template's area. To-dos with checklists can be templates too: **New To-Do from Template…** in any list's ••• menu, or **Add To-Do from Template…** in a project's. Edit them all under **+ New List → Templates**
- **Headings as a board** (Mac): the columns button at the top of a project shows each heading as a column, laid out like the Board. Drag a column by its name (or the grip on its top edge) to move it, beside the others or stacked under one; the project's headings follow, left to right and top to bottom, and No Heading stays first. **Add Heading Below** (point under a column, or its ••• menu) puts a new heading right under it. Drag cards between columns to change their heading, click a name to rename it, and drag a column's edges or corner to resize it
- **Waiting For**: press `W` (or ••• → **Waiting For…**) to note who a to-do is waiting on and when to follow up. The **Waiting** list groups them by person, and each comes back to Today on its follow-up date
- **Status report**: ••• → **Status Report…** in any list, area, project or the Board gives what got done, what's coming up and who you're waiting on for this week, last week or the last 7 or 30 days, ready to copy, email, share or print
- **Tags**, nestable, with a tag bar on every list to filter it. **Tag groups** keep tags together without being tags themselves: in Manage Tags, **New Group** (or ••• → **Make It a Group** on a tag you made just to hold others, like Departments), then choose the group beside each tag. A group is only a heading: it never goes on a to-do, never shows in the tag bar, and the tag picker lists its tags under it (typing the group's name shows them all). Making a tag a group takes it off anything it was on, with Undo. ••• → **Sort Tags Inside A to Z** sorts one group, and its tags share its color unless you give them their own. In a smart list, **Any in Departments** matches any tag in the group. In **Settings → Manage Tags**, drag a tag's grip (or press ⌘↑ / ⌘↓ in its name) to put tags in your own order, or use **Sort A to Z**; the tag bar, the tag picker and the tags on each to-do all follow that order. Each tag has a soft color, shown everywhere it appears: click its dot in Manage Tags to change it. New tags get a color no other tag is using yet, and a nested tag shares its parent's color unless you give it its own. To-dos added to or moved into a project or area take on its tags (switchable in Settings). Lists show only a to-do's own tags, not the ones it gets from its project or area or ones named after the project or area it's in; change this in **Settings → Tags shown in lists** (Own Only, All or None)
- **Quick Find** (`/`) for lists, projects, tags and to-dos, including the Logbook
- **Quick Entry** (`Q`) that reads dates, deadlines, tags, priority and where it goes as you type: `Pay rent friday @Home #Bills !oct 31 !!`. Type `@` and a project or area to file the to-do there. A few letters are enough when they point to one place (the start of its name, of any word in it, or the name run together), and `@Project/Heading` puts it under a heading. A list of matches appears as you type: ↑ ↓ and Return or Tab pick one, Esc closes it, and places in your current focus come first. The chip under the title shows where it's going; its ✕ keeps it in the Inbox. A list you choose with the arrow button wins over a typed `@`
- **Type a date** anywhere you pick one: `tom`, `fri`, `next week`, `in 3 days`, `oct 24`, `10/24`
- **Drag and drop** to reorder, to move into projects and headings, or onto the sidebar to schedule, complete or delete. On iPhone, press and hold to drag. Drop a to-do on a project's row (in an area, a Board column or Today) to move it into that project. Drag a project or area onto **Board** in the sidebar to add it as a column, and a heading onto a project in the sidebar to move it there with its to-dos. While you drag a project and none is outside an area, a **No Area** spot appears at the top of the sidebar to take it out of its area. On a Mac, drag the sidebar's right edge to make it wider or narrower (double-click it for the usual width)
- **Multi-select** (⌘-click or ⇧-click on a Mac, ••• → Select To-Dos on iPhone). With several selected, use the bar at the bottom, the ••• menu or a right-click to tag, schedule, move, set a deadline, complete or delete them all at once
- **Right-click almost anything** on a Mac for what you can do with it: a project's or list's title, a heading, a list or smart list in the sidebar, a tag in the tag bar, a day in Upcoming or This Evening (new to-do there, or paste), a group in Deadlines (change all its deadlines at once, or select them), a project or area named under a to-do, the open to-do and its checklist items, a note, the focus switcher. A project's or area's menu offers **Paste** into it when you've copied to-dos, and a heading's menu can copy all its to-dos. Click the circle beside a project's name to complete it (and again to reopen it), and double-click a project, area or smart list in the sidebar to rename or edit it. While you're typing in a field, right-click still gives the usual Cut / Copy / Paste
- **Undo** for everything (`⌘Z`)
- **Keyboard shortcuts** for nearly everything. Press `?` in the app to see them all
- **Board** (Mac): put projects and areas in columns, like a kanban board. **Several Boards**: click the arrow beside a Board's name for **New Board**, **Duplicate Board**, **Delete Board…** or to switch; click the name to rename it. Once there's more than one, each is in the sidebar (drop a project or area on one to add it there), and **Add to Board…** in a project's or area's menu shows which Boards it's on. An area's **Open as Board** makes a Board of its own, named after it. **Lists, tags and smart lists as columns**: Add Column also offers Inbox, Today, Upcoming, Anytime, Someday, Waiting and Deadlines, every tag and every smart list. Dropping a to-do on one of those columns does what dropping it on that list does: Today schedules it, a tag column tags it, Deadlines asks for a deadline. Their + adds a to-do that belongs there. Use **Add Column**, **Add to Board** in any project or area's ••• menu (or right-click it in the sidebar), or an area's **Open as Board** to lay out all its projects. Columns can also sit one under another, so short lists don't leave empty space below them: point under a column and click **Add Below** (or use **Add Below…** in its ••• menu). Drag a column by its title bar, or the grip on its top edge, to move it: drop it above or below another column, in the empty space under one, or near a column's left or right edge to give it a place of its own. Drag a column's right edge to change its width (columns stacked together share one), its bottom edge to change its height (a longer list then scrolls inside it), or its corner for both; double-click an edge to fit it automatically. **Move Up**, **Down**, **Left** and **Right** are in each column's ••• menu too. Drag to-dos between columns, check them off, or add new ones with each column's +. Press `8` to open it. A project's headings in its column (and under a project you've expanded in an area) rename right where they are: click one, type, and press Return; + beside it adds a to-do under it, and ••• has its menu. **Add Heading** in a project column's menu adds one there, without leaving the Board.
- **Priority** (optional): High, Medium or Low on any to-do or project, shown as **!!!**, **!!** or **!** before its title. Press `P`, use **Priority…** in the ••• or right-click menu (or a selection's), the bars button in an open to-do, or type `!!!`, `!!` or `!` in Quick Entry. Lists keep higher priorities on top unless you sort them another way, and you can still drag or use ⌘↑ / ⌘↓ to arrange to-dos within each priority (turn this off in **Settings → Keep higher priorities on top**)
- **Sort any list** by priority, deadline, date, title or recently added from its ••• menu (**Sort By…**), or keep your own manual order. **Priority** (the usual order) puts High first; items with the same priority keep your order and ones without go last. In an area it sorts its projects too. On the Board, **Sort Board By…** is in the Board's ••• menu and in each column's Each list remembers its sort on each device
- **Narrow windows** (Mac): Sectis keeps its Mac layout, Board included, however narrow the window gets, down to phone size. Hide the sidebar for more room with the button at its bottom right or `⌃⌘S`, and bring it back with the button at the top left. In a window 640px wide or less the sidebar starts hidden and slides in over the list when you open it, then gets out of the way once you pick a list or click elsewhere. Dragging a to-do? Hold it over the sidebar button for a moment and the sidebar slides in, so you can drop it on a list, project or area. The iPhone layout is for phones (and any window narrower than one)
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
- **The cloud** at the bottom of the sidebar syncs right away when you click it (the same as **Settings → Sync → Sync Now**): it sends what changed here, then brings in anything new from your other devices, and says how it went. It pulses while syncing, turns gray when you're offline and red if something's wrong; the message then has a **Settings** button to see more.
- Offline changes wait on the device and sync when it reconnects.
- If the same to-do is edited on both devices before they sync, the most recent edit wins.
- When Sectis opens, it brings in your other devices' changes before it sends any of its own, so a device that was asleep (or just updated) can't put back an older copy of something you changed elsewhere. And it never overwrites a newer copy in Firebase with an older one: the newer one comes to this device instead.
- **Check Everything** (Settings → Sync) compares everything on this device with Firebase and fixes anything out of step: changes that never arrived come in, and anything an older copy overwrote goes back up. Each device does this once on its own after updating to 1.44.
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
| Show or hide the sidebar | `⌃⌘S` |
| Notepad | `J` |
| In a note: bold / italic / strikethrough / code / link / checkbox | `⌘B` / `⌘I` / `⇧⌘X` / `⌘E` / `⌘K` / `⇧⌘L` |
| Delete | `⌫` |
| Undo | `⌘Z` |
