# River for Gmail

A Chrome extension that adds a floating River panel to Gmail. When you open an email, the panel finds the Monday episode behind it and shows its stage, editor, deadlines, files and latest notes. You can move the episode or send the editor a note without leaving the email.

## Install (about 2 minutes)

1. Unzip `river-for-gmail.zip` somewhere you'll keep it, for example `Documents/River for Gmail`. Chrome loads it from that folder, so don't delete it.
2. In Chrome, go to `chrome://extensions` and turn on **Developer mode** (top right).
3. Click **Load unpacked** and choose the unzipped folder.
4. Click the puzzle icon in the toolbar and pin **Poddster River for Gmail**.
5. Click the River icon and paste your Monday token:
   - In Monday, click your profile picture, then **Developers**, then **My access tokens**.
   - Copy the token, paste it into River and click **Save and test**.
   - It should say "Connected as Abdullah Ghanem".
6. Reload Gmail and open any client email.

## How it finds the task

The panel tries these in order:

1. **An episode named in the email.** Subjects and bodies like "Brett King - Session 02.10.26" match directly, which covers Frame.io and Monday notification emails.
2. **The client's email address.** Every address in the thread that isn't Poddster, Frame.io, Google, Dropbox or a no-reply is looked up on PP Clients Only. The panel then pulls that client's episodes.
3. **The sender's name.** If nobody is on PP Clients Only, it searches episodes by the sender's name.

The best match comes first: an episode linked to the client, then one named in the email, then open work before finished, then the newest. Other matches are listed underneath; click one to switch to it. The search box finds any episode by name.

## What you can do from the panel

- **See the episode:** stage, how late it is, client, editor, units, the five deadlines (the one that's due is highlighted), and links to Frame.io review, Frame.io upload and Dropbox raws. The title opens the episode in Monday.
- **Move it:** stage buttons with Undo. Moving to Corrections fills the next empty deadline with today plus 2 working days, the same rule as River.
- **Brief the editor:** highlight the client's notes in the email, click **+ Selected text**, then **Post**.
  - The note goes to the episode on Monday, mentions the editor, and sets Corrections with the next deadline.
  - Untick either box if you don't want that.
  - Ctrl or Cmd + Enter posts.
- **Read the latest notes:** the last 4 updates on the episode.

## Details

- **Laura's clients:** episodes for `BL -` clients are view-only until you click Unlock.
- **Moving the panel:** drag it by its header and it remembers where you put it. Minimise it to a pill, which shows the matched client and stage and pulses red when the episode is late.
- **Gmail shortcuts:** typing in the panel never triggers them.
- **Your token:** it stays in this Chrome profile and is only sent to `api.monday.com`.
- **Email:** the extension never sends email.

## Files

- `manifest.json`: the Chrome extension, Manifest V3.
- `background.js`: calls the Monday API with your token.
- `logic.js`: reads the email, matches it to Monday, and holds River's rules (Corrections, lateness, working days).
- `content.js`: the floating panel. It sits in a Shadow DOM, so Gmail's styles can't touch it.
- `options.html` and `options.js`: the token screen.
- `tests/`:
  - `node tests/logic.test.js` runs on real Monday responses.
  - `node tests/ui.test.js` clicks through a mock Gmail.
  - `node tests/ext.test.js` loads the real extension in Chromium.
