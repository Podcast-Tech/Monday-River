# River roadmap

AG approved all ten on 2 Oct 2026. Build in this order: 1, 2 and 7 first, because they save the most clicks and make the river feel alive. Each item lists what done looks like.

## Faster

### 1. Clear the gates
- A "Clear the gates" button, plus the key `G`, opens a focus mode that walks through every overdue episode one card at a time, most overdue first.
- Each card shows the name, client, editor, how late it is and the file links.
- Quick actions on each card: Corrections, Client Review, Done, "Nudge editor" (a canned note with a mention), and Skip.
- A progress bar shows "4 of 11 cleared". When the list is empty, show a finish state.
- Every action uses the existing `setStage` and `postNote`, so the Corrections date rule and Undo still apply.

### 2. Drag to reassign
- Drop a dot onto an editor chip to write that editor to `person` and set status Assigned. Skip the status change if the episode is already past Assigned.
- Editor chips show live load: episode count and the sum of units in edit stages.
- Undo restores the previous editor.

### 3. Lasso and batch moves
- Shift-drag on empty water draws a selection box. Selected dots get a ring and a "N selected" bar appears.
- Moving a selection runs one `change_item_column_values` per item in sequence, with a single combined Undo.
- The Corrections date rule applies per item.

### 4. One-tap notes
- Snippet chips above the note box, for example:
  - "Please upload to the F.IO Upload link when ready"
  - "Check audio levels"
  - "C#1 Cut start: … Cut end: …"
- Snippets are editable and saved per viewer in localStorage, wrapped in try/catch.
- Tapping a snippet inserts it; it does not post.

### 5. Keyboard flow
- Arrow keys move focus between dots in reading order (stage, then position). Enter opens the episode.
- Keys 1–6 move the focused episode to Assigned, In Process, In Review, Corrections, Client Review or Done.
- `?` shows a shortcut sheet.

## More immersive

### 6. The river reacts to the week
- Current speed (the animation duration of `.current`) follows throughput: faster when Done this week is at least last week's count, slower when it isn't.
- Water texture and colour follow the backlog trend:
  - Calm and clear blue when draining.
  - Choppy waves (an SVG turbulence filter or extra sine harmonics) with a darker tint when rising.
- Must stay readable, and must turn off under reduced motion.

### 7. Live ripples
- On each watch refresh, compare the new items with the previous snapshot by ID: status, editor and dates.
- Any change that this page didn't make shows as a ripple on that dot, plus a line in a small "Live" feed. For example: "Igor moved Laiba Khan to In Review, 2 min ago". Keep the last 20 entries for the session.
- Don't ripple on the first load. Ignore changes this page just wrote by tracking the IDs it wrote recently.

### 8. Sound, off by default
- A speaker toggle in the header. Audio starts only after that click.
- Web Audio only: generate sounds in code, with no audio files from other hosts.
- Sounds: a soft brown-noise water bed at low volume, a splash when an episode reaches Done, a low tone when an episode becomes overdue on refresh.
- Remember the on/off choice per viewer.

### 9. Day and night
- The palette follows Africa/Cairo time:
  - Morning: lighter blue water with a pale sky gradient.
  - Afternoon: neutral.
  - Dusk (around 17:00–19:00): warm amber banks.
  - Night: the current deep palette.
- Blend tokens smoothly; don't flip them in one jump. Contrast must stay at least 4.5:1 for text.

### 10. Flow mode
- The `F` key or a button hides the header, stats, chips and list, and shows only the river and the sea.
- Try `requestFullscreen` and accept refusal. If it's refused, use full-viewport CSS.
- `Esc` exits. Good for a second screen or the office TV.

## Later ideas, not yet approved
- Bring back Heartbeat (Gmail client silence) and Arrivals (studio calendar plus intake) as river features. The code is in `archive/`.
- A standalone version outside claude.ai would need a small backend holding a Monday API token, for example a Vercel function. AG has a Vercel team.
