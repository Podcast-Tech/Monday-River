# Poddster River for Chrome

A Chrome extension that brings your Monday tasks to every site.

- **Search from anywhere:** search your tasks from any tab.
- **Automatic matching:** River shows the task behind what you're looking at:
  - a Gmail thread, matched by the client's email, their name, or an episode named in it
  - a Frame.io or Dropbox page that is one of your tasks' links
  - any page whose title names an episode, for example "Brett King - Session 02.10.26.mp4"
- **Work on the task:** move it, or brief the editor, without opening Monday.

## Install, or update from the Gmail-only version

1. If you installed **River for Gmail** before, go to `chrome://extensions` and click **Remove** on it.
2. Unzip `river-for-chrome.zip` into a folder you'll keep, for example `Documents/River`. Chrome loads it from there, so don't delete it.
3. In `chrome://extensions`, turn on **Developer mode** (top right), click **Load unpacked** and choose the folder.
4. The settings page opens. Paste your Monday token:
   - In Monday, click your profile picture, then **Developers**, then **My access tokens**.
   - Click **Save and test**.
5. Pin River from the puzzle icon in the toolbar.
6. Reload any tabs that were already open.

## Opening River

- **Alt + Shift + R** on any tab, or click the River icon. You can change the shortcut at `chrome://extensions/shortcuts`.
- **The River button** in the bottom-right corner of every site. On Gmail it becomes the panel. On a page about a task, it becomes a pill showing the client and stage, and the pill pulses red when the task is late.
- **Address bar:** type `rv`, a space, then a client name. Your tasks appear as suggestions, and Enter opens one in Monday.
- **Right-click:** highlight a name on any page, right-click it and choose **Find in River**.
- **Protected pages:** on Chrome's own pages (new tab, settings, Web Store), River opens as its own tab.

## Search

- **My tasks:** your whole board loads once, about 400 tasks, so results appear as you type.
- **How words match:** every word you type has to appear in the task name, client, editor or stage.
  - `laiba` finds Laiba Khan's tasks.
  - `igor late` finds Igor's overdue ones.
  - `corrections` lists everything in Corrections.
- **Filters:** Open (the default), Late, Done or All. Results are sorted most urgent first: overdue, due today, due soon, then clients waiting longest.
- **Everyone:** searches every producer's tasks on Monday by name, for example Laura's clients.
- **Keyboard:** the arrow keys and Enter open a task, Back returns to the results, and Esc clears the search or closes the panel.

## On a task

- **What you see:** stage and lateness, client, editor, units, the five deadlines (the one that's due is highlighted), Frame.io and Dropbox links, and the last 4 Monday notes.
- **Move it:** stage buttons with Undo. Corrections fills the next empty deadline with today plus 2 working days.
- **Note to the editor:**
  - Highlight text on the page and click **+ Selected text**, then **Post**.
  - The note mentions the editor and sets Corrections, unless you untick those boxes.
  - Ctrl or Cmd + Enter posts.
- **Laura's clients** (`BL -`) are view-only until you click Unlock.

## Details

- **Hiding the button:** use the link at the bottom of the panel to hide the River button on a site. Settings also let you show it only in Gmail. The shortcut and the toolbar icon always work.
- **Your token:** it stays in this Chrome profile and is only sent to `api.monday.com`.
- **Email:** River never sends email.

## Files

- `manifest.json`: Manifest V3. It runs on all sites, with the shortcut, the right-click menu and the `rv` address-bar keyword.
- `background.js`: calls Monday with your token, and handles the toolbar icon, the shortcut, the right-click menu and the address-bar suggestions.
- `logic.js`: matching, search, urgency, and River's rules (Corrections, lateness, working days).
- `content.js`: the floating panel, in a Shadow DOM so sites can't restyle it. `river.html` hosts the same panel as a full page.
- `options.html` and `options.js`: settings for the token, where River shows, and hidden sites.
- `tests/`:
  - `node tests/logic.test.js`
  - `node tests/ui.test.js` (mock Gmail, a blog, Frame.io)
  - `node tests/ext.test.js` (the real extension in Chromium)
  - Run the last two with `NODE_PATH=$(npm root -g)`.
