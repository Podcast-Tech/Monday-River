# Poddster River

A live view of Abdullah Ghanem's (AG) episode pipeline on Monday.com, drawn as a river. Stages are stretches of the river, gates sit between them, and the "sea" at the mouth holds finished work. AG works the board from here instead of opening Monday: drag episodes between stages, open an episode to change its stage or post an editor note, and add new tasks.

Owner: AG (abdullah@poddster.com), Podcast Content Producer at Poddster Studios, Dubai. Works in Africa/Cairo time; bookings are in Asia/Dubai.

## How it runs (read this first)

- **One file:** `index.html` is a self-contained page (HTML + CSS + JS, no build step). Fonts come from Google Fonts. No other external hosts are allowed.
- **Where it runs:** it is published as a **claude.ai Artifact** at https://claude.ai/artifact/VdyYthkp8rzoVTWecnXpoF. It only works inside claude.ai or the Claude app. Opened anywhere else it shows "Open this in Claude", because it has no backend of its own.
- **How it reads and writes Monday:** through the artifact runtime's `mcp` capability, using the viewer's own monday.com connector. It never sees tokens.
  - Runtime contract `0.2.66`. Reach it with `const mcp = await window.claude.use("mcp")`, which resolves `null` when unavailable.
  - Reads use `mcp.watchTool("monday.com", "get_board_items_page", INPUT, handler, { refetchInterval: 45000 })`.
  - Writes use `mcp.callTool("monday.com", tool, input, { cache: false })`, then `mcp.invalidate("monday.com", "get_board_items_page")`.
  - `get_board_activity` (read-only) names who made a change for the Live feed. It needs `includeData: true`; each row's `data` is a JSON string with `pulse_id` and `column_id`, and `user_id` maps through `USERS`. If it fails, the feed leaves the name out.
  - Every write calls `markWrote(id)` so Live ripples ignore the page's own changes for 2 minutes.
  - Errors reject with a `.code`. Branch on the code; `errorCopy()` and `writeErr()` hold the copy. `server_unavailable` and `upstream_error` on a write are ambiguous: the write may have run, so never auto-retry a write.
- **Declared capabilities** (must be re-declared in full whenever tools change):
  ```json
  {"mcp": {"servers": [{"server": "monday.com", "tools": ["get_board_items_page", "change_item_column_values", "create_update", "create_item", "get_board_activity"]}, {"server": "Google Calendar", "tools": ["list_events"]}]}}
  ```
- **Publishing from Claude Code:** use the Artifact tool with `file_path: index.html` and `url: https://claude.ai/artifact/VdyYthkp8rzoVTWecnXpoF`, so it updates the same link. Read the artifact first (`action: "read"`) if this session hasn't published it. Pass `capabilities` only when the tool list changes; omitting it keeps the current declaration.
- **Browser limits inside an artifact:**
  - No `alert` or `confirm`; build confirmations in the page.
  - `localStorage` only for per-viewer conveniences, wrapped in try/catch.
  - No microphone.
  - Audio only after a user gesture.
  - Fullscreen may be refused; treat it as optional.
  - Plain `#anchor` deep links only.

## Monday data model

Episode Editing Board `2472462203`, filtered to Episode Producer = AG (`people` column, `"assigned_to_me"`).

| Column ID | Meaning |
|---|---|
| `status` | PP Status (stage) |
| `person` | Editor |
| `people` | Episode Producer |
| `date` | Available |
| `date4` | Draft |
| `date_mkx87nb3` | V1 |
| `dup__of_1st_cut_deadline` | Final |
| `date_mm02j5tr` | Publishing |
| `status_1` | Invoice (Payment pending / Paid). Still fetched but no longer shown in the panel (AG asked to remove it). |
| `board_relation_mkxb8cpz` | Client (links to PP Clients Only `18330033684`) |
| `link_mm22fna1` | F.IO Upload link (internal; this goes in editor notes) |
| `link_mkxbtnjf` | F.IO Share/review link (client-facing) |
| `link_mkxbm8as` | Dropbox raws |
| `numeric_mm1y5e6b` | Units (1 = full episode + trailer, or 3 highlights) |

Groups: Queue `topics`, Assigned `new_group60072`. Status changes move groups automatically via Monday automations.

PP Clients Only `18330033684`: names are prefixed `AG - ` (AG's clients) or `BL - ` (Laura's). Columns: `text_mkxbach4` email, `text_mkxb379a` first name, `person` producer.

People: AG Monday ID `49670201`. The editor IDs live in `EDITOR_IDS` and `EDITORS` in index.html.

Value formats:
- Status: `{"label":"Corrections"}`
- Date: `{"date":"YYYY-MM-DD"}`; clear a date with `null`
- Person: `{"personsAndTeams":[{"id":123,"kind":"person"}]}`
- Relation: `{"item_ids":[123]}`

## Business rules (do not break)

- **Pipeline:** Queue → Assigned → In Process → In Review → Corrections → Client Review → Done (→ Paid on `status_1`). The river shows the first six stages; Done is the sea.
- **Working days:** Sat and Sun are the weekend. "Two working days" skips them (`addWorkdays(2)`).
- **Corrections rule:** any move to Corrections (drag, stage button, or a note with "Set to Corrections") also fills the **next empty** date column, in the order Available → Draft → V1 → Final → Publishing, with today + 2 working days, in the same write. Undo clears that date. Filled dates are never overwritten.
- **New task rule:**
  - Producer = AG, Available = today, Draft = today + 2 working days.
  - If an editor is chosen, set `person` and status Assigned (group `new_group60072`); otherwise group Queue.
  - Name pattern: `{Client} - Session dd.mm.yy` plus a suffix (` (Highlights)`, ` Reel`, ` (Teaser)`).
- **Editor notes:** post with `create_update` and an HTML body (`<br>` line breaks, escaped text). Mention the editor via `mentionsList` `[{"id":"…","type":"User"}]`. Posting an editor-actionable note sets Corrections by default.
- **Clear the gates** (`G`): walks `lateList()`, most overdue first (`overdueBy`). Its actions go through `setStage` and `postNote`, so the Corrections rule and Undo apply. "Nudge editor" posts a canned note with a mention and does **not** change the stage; it's off for Client Review and for episodes with no editor.
- **Drag to reassign:** dropping a dot on an editor chip writes `person`; from Queue it also sets Assigned in the same write. Undo restores the previous editors (and Queue). If a previous editor isn't in `EDITORS`, Undo is off.
- **Corporate clients** (Dmitrii Tverdokhleb, Suvo Sarkar, ENBD) have open-ended review timelines. Never count them as "quiet" in Client Review (`CORPORATE` regex).
- **"Late":**
  - In edit stages: the next deadline has passed. For Corrections that is the latest of V1/Final, falling back to Draft.
  - In Client Review: more than 7 days since the latest deadline date, excluding corporate clients.
- **Client emails:** never send email from this app. Any future email feature creates Gmail **drafts** only, CCs production@poddster.com, and shows the full draft for AG to confirm first.
- **Package details:** the episode panel shows the studio booking behind the episode (session, order ID, services, add-ons, setup, seats, guests, requests, file transfer, Calendar link).
  - It is read-only, loaded lazily with `loadPackage()` when an episode opens, and cached per item in `S.pkg`.
  - It searches `production@poddster.com` and `studio@poddster.com` for "Booking" events within ±1 day of the `dd.mm.yy` in the task name; if nothing matches, it tries AG's `primary` calendar. With no date in the name, it searches the 14 days before Available.
  - Matching is by client name or customer (including a shared surname plus first initial), or by client email from PP Clients Only `text_mkxbach4`.
  - Descriptions come as plain newlines or `<br>` HTML. `parseDesc()` handles both, and free text after a blank line goes to Requests.
- **Laura's lane:** never act on `BL - ` clients' episodes automatically.

## Known quirks

- **Mirror columns** (client email/first name on the episode board) return "Column value type is not supported" through the connector. Read PP Clients Only instead.
- **`create_item` payload:** its shape varies. Read the ID from `id`, `item_id` or `item.id`; otherwise search by exact name with `get_board_items_page` + `searchTerm`.
- **Frame.io folder trigger** (`dropdown_mkxb29zm`): needs two writes, `{}` then `{"labels":["Create Frame.IO Folder"]}`. The link appears in about 90 seconds.
- **`updated_at`** is reset by bulk edits, so "Done this week" can be inflated. Treat it as approximate.
- **Status filters** with index compare values are unreliable. Fetch broadly and filter by label in JS.

## Design system

- Dark-only, by design.
- Colour tokens live on `:root` at the top of the `<style>` block.
- Poddster red `#FF003C` is the only brand accent (logo, primary buttons, focus outlines).
- Water blues `#3FA9FF` / `#BFE3FF`, sea violet `#9C8CFF`.
- Stage colours are in `--st-*`; late is `--late` and due today is `--today`.
- Type: Geist (UI) and Geist Mono (small numbers).
- Respect `prefers-reduced-motion` for every animation.
- The river is one SVG in a 1400×520 viewBox. `geometry()` sizes each stretch by episode count, `place()` maps deadline to position, and `relax()` stops dots overlapping.
- **Names on the river:** every visible dot carries client initials, and `placeLabels()` puts the client name beside it, trying 8 spots and skipping any that collide with dots, names, stage headers or the sea. Placement is most urgent first, so in a crowded stretch the calm names drop and their initials stay. A client with several open tasks gets a tag (HL, Reel, Teaser or session date) from `nameTag()`. The Names toggle (All / Urgent) is per viewer in localStorage `river.names`.

## Working on it

- Check syntax: `node tests/check.js`
- Smoke test with sample data: `node tests/smoke.js`. It mocks `mcp`, renders, drags, adds a task and applies the Corrections rule.
- Keep everything in `index.html`. Don't add a build step or extra script hosts. Only cdnjs, jsdelivr and unpkg are allowed if a library is truly needed.
- After a change, smoke test, then republish to the same URL. Tell AG in one line what changed.
- `archive/` holds the earlier four-view version (Orbit radar, Heartbeat from Gmail, Arrivals from Google Calendar with intake, and the first River). Reuse its code when a roadmap item needs Gmail or Calendar.

See `ROADMAP.md` for the next ten upgrades.
