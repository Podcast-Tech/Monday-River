// Opens River Pocket at iPhone size with a mocked Claude runtime, taps through it, checks the Monday writes and saves screenshots.
const { chromium, devices } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const mk = (id, name, stage, editor, draft, o = {}) => ({ id, name, url: "https://poddsterstudios-team.monday.com/boards/2472462203/pulses/" + id, updated_at: o.upd || "2026-10-08T10:00:00Z", created_at: "2026-10-01T10:00:00Z",
  column_values: { status: stage, person: editor, date: d(-6), date4: draft, date_mkx87nb3: o.v1 || null, board_relation_mkxb8cpz: [{ id: "1", name: (o.bl ? "BL - " : "AG - ") + name.split(" - ")[0] }], numeric_mm1y5e6b: "1",
    link_mkxbtnjf: "https://f.io/abc", link_mm22fna1: "https://next.frame.io/project/x/y", link_mkxbm8as: "https://www.dropbox.com/scl/fo/z" } });
const ITEMS = [
  mk("101", "Laiba Khan - Session 23.09.26 (REC 2)", "In Process", "Igor Garčev", d(-3)),
  mk("102", "Al Tamimi - Session 08.10.26", "In Process", "Stipe Majić", d(0)),
  mk("103", "Olga Melnyk - Session 02.10.26", "Corrections", "Motasem Jammal", d(-9), { v1: d(1) }),
  mk("104", "Katie Robertson - Session 01.10.26 - Highlights", "Queue", "", d(2)),
  mk("105", "Eric Krawetz - Session 25.09.26", "In Review", "Georges Saliba", d(-1)),
  mk("106", "Laiba Khan - Session 23.09.26 (REC 1 P2)", "Client Review", "Igor Garčev", d(-12)),
  mk("107", "Alice Lovell - Session 04.10.26 - Ep 4", "In Process", "Akssat", d(5)),
  mk("108", "Brett King - Session 02.10.26", "Client Review", "Akssat", d(-5)),
  mk("109", "Rayhan Aleem - Session 06.10.26", "Assigned", "Ajin", d(3)),
  mk("110", "Joana Castro - Session 03.07.26", "In Process", "Mahmoud", d(8)),
  mk("111", "Sarah Harrison - Session 23.09.26", "Client Review", "Stefan Mikić", d(-2), { bl: true }),
  mk("112", "Saeed Alghafri - Session 28.06.26 (P#1)", "Done", "Stefan Mikić", d(-100), { upd: new Date().toISOString() }),
];
const NOTES = [{ id: "n1", created_at: new Date(Date.now() - 4 * 60000).toISOString(), read: false, title: "Akssat Mentioned you in a reply", kind_name: "new_reply_im_mentioned", text: "you in a reply: @Abdullah Ghanem Uploaded, please check. I couldn't get it under 35 minutes.", item: { id: "108", name: "Brett King - Session 02.10.26", board: { id: "2472462203" } }, board: { id: "2472462203", name: "Episode editing board" }, update: { id: "5611725266" } },
  { id: "n2", created_at: new Date(Date.now() - 3 * 3600e3).toISOString(), read: true, title: "Automations", kind_name: "automation_notify", text: "Stefan Mikić started working on Pavle Rastovic - Session 17.09.26 (P#1) (Highlights)", item: { id: "77", name: "Pavle Rastovic - Session 17.09.26", board: { id: "2472462203" } }, board: { id: "2472462203", name: "Episode editing board" }, update: null }];
const EVENT = { id: "e1", summary: "Brett King | Poddster Booking", status: "confirmed", htmlLink: "https://calendar.google.com/x", start: { dateTime: "2026-10-02T16:30:00+04:00" }, end: { dateTime: "2026-10-02T17:30:00+04:00" }, organizer: { displayName: "Al Barsha Studio 1" },
  description: "Order ID: X6EC4DLU\nCustomer: Brett King\nClient email: brett@provoke.fm\nSeats: 3\nSetup: Eden\nServices:\nRecording + Pro Edit + Reels\nAdditional Services:\nYouTube Thumbnail (1)\nFile Transfer: Bring Your SD Cards" };
(async () => {
  const b = await chromium.launch(); const ctx = await b.newContext({ ...devices["iPhone 14"], colorScheme: "dark" }); const p = await ctx.newPage();
  const calls = [];
  await p.exposeFunction("__call", (server, tool, input) => { calls.push({ server, tool, input });
    if (tool === "get_updates") return { payload: { updates: [{ id: "u1", text_body: "Raw files: DB Link\nUpload Link: Frame.io", created_at: new Date(Date.now() - 3600e3).toISOString(), creator: { name: "Roy" } }] } };
    if (tool === "list_events") return { payload: { events: input.calendarId === "production@poddster.com" ? [EVENT] : [] } };
    if (tool === "get_board_items_page") return { payload: { items: [{ id: "77", name: "AG - Test Client", column_values: { text_mkxbach4: "t@x.com" } }] } };
    if (tool === "create_item") return { payload: { id: "13200000001" } };
    return { payload: {} }; });
  await p.addInitScript(([items, notes]) => {
    window.claude = { use: async () => ({ watchTool(s, t, i, h) { setTimeout(() => h({ type: "result", result: { payload: t === "all_api_read" ? { notifications: notes } : { items } } }), 20); return () => {}; },
      callTool: (s, t, i) => window.__call(s, t, i), invalidate: async () => {} }) };
  }, [ITEMS, NOTES]);
  p.on("pageerror", e => { console.error("page error:", e.message); process.exitCode = 1; });
  await p.route("https://pocket.test/**", r => r.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + html + "</body></html>" }));
  await p.route("https://fonts.googleapis.com/**", r => r.abort());
  await p.goto("https://pocket.test/"); await p.waitForSelector(".row");
  const text = s => p.evaluate(s => [...document.querySelectorAll(s)].map(n => n.textContent.replace(/\s+/g, " ").trim()), s);
  const groups = await text(".group h3"); assert.deepStrictEqual(groups, ["Late3", "Due today1", "Next two days2"], "focus groups: " + groups);
  assert.ok((await text(".seg b"))[0] === "1" && (await text(".pc b")).join(",") === "3,1,3", "strip/press: " + (await text(".pc b")));
  const w = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(w[0] <= w[1], "no sideways scroll " + w);
  console.log("✓ Home: river strip, Late 3 · Due today 1 · With clients 3, and the Needs-you list grouped Late / Due today / Next two days");
  await p.screenshot({ path: path.join(shots, "1-home.png"), fullPage: true });
  await p.fill("#q", "igor late"); assert.strictEqual((await text(".row .nm")).length, 2);
  await p.fill("#q", ""); await p.click('.seg[data-stage="Client Review"]'); assert.strictEqual((await text(".row")).length, 3);
  console.log("✓ Search (“igor late” → 2) and tapping a stage in the river filters the list");
  await p.click('.seg[data-stage="Client Review"]');
  await p.click('.row[data-id="108"]'); await p.waitForSelector(".pkg dl"); await p.waitForSelector(".up");
  const sheet = (await text("#sheet"))[0];
  assert.ok(/X6EC4DLU/.test(sheet) && /Recording \+ Pro Edit \+ Reels/.test(sheet) && /Roy/.test(sheet) && /Akssat/.test(sheet), "task sheet content");
  console.log("✓ Task sheet: dates, links, the Calendar package (X6EC4DLU, Recording + Pro Edit + Reels), latest notes and mentions");
  await p.screenshot({ path: path.join(shots, "2-task.png"), fullPage: false });
  await p.fill("#note", "Please cut 12:40 and soften the intro music"); await p.click('[data-act="post"]'); await p.waitForTimeout(150);
  const up = calls.find(c => c.tool === "create_update"); assert.ok(/12:40/.test(up.input.body) && JSON.parse(up.input.mentionsList)[0].id === "88817643");
  const cv = JSON.parse(calls.filter(c => c.tool === "change_item_column_values").pop().input.columnValues); assert.strictEqual(cv.status.label, "Corrections"); assert.ok(cv.date_mkx87nb3.date);
  console.log("✓ Note posts to @Akssat and moves to Corrections with V1 " + cv.date_mkx87nb3.date);
  await p.click('[data-act="close"]'); await p.click('.row[data-id="111"]'); assert.ok(await p.$(".lock"), "Laura's client is locked");
  console.log("✓ Laura's client opens view-only until Unlock");
  await p.click('[data-act="close"]'); await p.click("#bell"); await p.waitForSelector(".nf");
  await p.click('[data-nfr="n1"]'); await p.fill("#nf-text", "Thanks, checking now"); await p.click('[data-act="nf-send"]'); await p.waitForTimeout(100);
  const rp = calls.filter(c => c.tool === "create_update").pop().input; assert.strictEqual(rp.parentId, 5611725266);
  console.log("✓ Inbox: notifications with a threaded reply to Akssat");
  await p.click('[data-nfr="n1"]'); await p.screenshot({ path: path.join(shots, "3-inbox.png") }); await p.click('[data-act="close"]');
  await p.click("#add"); await p.fill("#f-client", "test"); await p.click("[data-pick]"); await p.selectOption("#f-editor", "Igor Garčev");
  await p.screenshot({ path: path.join(shots, "4-add.png") });
  await p.click('[data-act="create"]'); await p.waitForTimeout(150);
  const ci = calls.find(c => c.tool === "create_item").input, ccv = JSON.parse(ci.columnValues);
  assert.ok(/^Test Client - Session \d\d\.\d\d\.\d\d$/.test(ci.name) && ccv.status.label === "Assigned" && ccv.board_relation_mkxb8cpz.item_ids[0] === 77);
  console.log("✓ Add task: " + ci.name + ", Assigned to Igor, linked to the client");
  await b.close(); console.log("All phone tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
