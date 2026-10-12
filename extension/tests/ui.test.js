// Runs the real content script on fake pages (Gmail, Frame.io, any site) with a mocked Monday, clicks through it and screenshots.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const F = require("./fixtures.js"), dir = path.join(__dirname, ".."), shots = path.join(__dirname, "shots");
fs.mkdirSync(shots, { recursive: true });
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
// "My tasks": real names from AG's board, with deadlines relative to today.
const mk = (id, name, stage, editor, draft, extra = {}) => ({ id, name, url: "https://poddsterstudios-team.monday.com/boards/2472462203/pulses/" + id, created_at: "2026-10-01T10:00:00Z", updated_at: "2026-10-08T10:00:00Z",
  column_values: [{ id: "status", text: stage }, { id: "person", text: editor }, { id: "people", text: "Abdullah Ghanem" }, { id: "date", text: d(-6) }, { id: "date4", text: draft }, { id: "date_mkx87nb3", text: extra.v1 || "" },
    { id: "dup__of_1st_cut_deadline", text: "" }, { id: "date_mm02j5tr", text: "" }, { id: "board_relation_mkxb8cpz", linked_item_ids: ["1"], display_value: "AG - " + name.split(" - ")[0] },
    { id: "link_mm22fna1", text: extra.upload || "" }, { id: "link_mkxbtnjf", text: "" }, { id: "link_mkxbm8as", text: "" }, { id: "numeric_mm1y5e6b", text: "1" }] });
const MINE = [
  mk("101", "Laiba Khan - Session 23.09.26 (REC 2)", "In Process", "Igor Garčev", d(-3)),
  mk("102", "Al Tamimi - Session 08.10.26", "In Process", "Stipe Majić", d(1), { upload: "https://next.frame.io/project/aaa-111/bbb-222" }),
  mk("103", "Olga Melnyk - Session 02.10.26", "Corrections", "Motasem Jammal", d(-9), { v1: d(0) }),
  mk("104", "Katie Robertson - Session 01.10.26 - Highlights", "Queue", "", d(2)),
  mk("105", "Eric Krawetz - Session 25.09.26", "Corrections", "Georges Saliba", d(-8), { v1: d(-2) }),
  mk("106", "Laiba Khan - Session 23.09.26 (REC 1 P2)", "Client Review", "Igor Garčev", d(-12)),
  mk("107", "Alice Lovell - Session 04.10.26 - Ep 4", "In Process", "Akssat", d(3)),
  mk("108", "Saeed Alghafri - Session 28.06.26 (P#1)", "Done", "Stefan Mikić", d(-100)),
  ...F.episodes.boards[0].items_page.items];
const ALL = MINE.concat([mk("201", "Brett Lee - Session 01.08.26", "Done", "Ajin", d(-60))]);
const page = (title, body) => `<!doctype html><html><head><title>${title}</title></head><body style="margin:0;font-family:Arial;background:#f6f8fc">${body}</body></html>`;
const GMAIL = page("Inbox - abdullah@poddster.com - Poddster Mail", `<div style="display:flex;height:100vh"><div style="width:250px"></div>
  <div role="main" style="flex:1;background:#fff;margin:12px;border-radius:16px;padding:24px 32px"><h2 class="hP" style="font-weight:400;font-size:22px">Re: Brett King - Session 02.10.26 edit feedback</h2>
  <div><span class="gD" email="brett@provoke.fm" name="Brett King"><b>Brett King</b></span> &lt;brett@provoke.fm&gt; to <span class="g2" email="abdullah@poddster.com" name="me">me</span></div>
  <div style="margin-top:20px;line-height:1.6">Hi Abdullah,<br><br>Loved the draft! A few small things:<p id="fb">1. At 12:40 please cut the part where I mention the old app name.<br>2. Can the intro music be a bit softer?</p>Thanks, Brett</div></div></div>`);
const ARTICLE = page("How to grow a podcast in 2026 – Some Blog", `<div style="max-width:720px;margin:60px auto;line-height:1.7;font-size:18px;color:#222"><h1>How to grow a podcast in 2026</h1><p>Lorem ipsum dolor sit amet, consectetur adipiscing elit. Our guest <b id="nm">Laiba Khan</b> shares her process.</p></div>`);
const FRAMEIO = page("Brett King - Session 02.10.26.mp4 | Frame.io", `<div style="background:#111;height:100vh;color:#ddd;padding:40px">Frame.io review player</div>`);
const FRAMEIO_FOLDER = page("Uploads | Frame.io", `<div style="background:#111;height:100vh;color:#ddd;padding:40px">Frame.io folder</div>`);

(async () => {
  const b = await chromium.launch(), calls = [];
  async function open(url, html) {
    const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
    await p.exposeFunction("__gql", (q, v) => { calls.push({ q, v });
      if (/items_page_by_column_values/.test(q)) return { ok: true, data: F.clients };
      if (/assigned_to_me/.test(q)) return { ok: true, data: { boards: [{ items_page: { cursor: null, items: MINE } }] } };
      if (/items\(ids/.test(q)) { const it = ALL.find(i => i.id === String(v.ids[0])); return { ok: true, data: { items: [Object.assign({ updates: [{ id: "9", text_body: "Raw files: DB Link\nUpload Link: Frame.io", created_at: new Date(Date.now() - 3600e3).toISOString(), creator_id: "106221824" }] }, it)] } }; }
      if (/contains_text/.test(q)) { const s = String(v.q[0]).toLowerCase(); return { ok: true, data: { boards: [{ items_page: { items: ALL.filter(i => i.name.toLowerCase().includes(s.replace(/ - session.*/, "")) || i.name.toLowerCase().includes(s)) } }] } }; }
      if (/users\(/.test(q)) return { ok: true, data: { users: [] } };
      if (/change_multiple_column_values/.test(q)) { const it = ALL.find(i => i.id === String(v.i)), cv = JSON.parse(v.v); it.column_values.forEach(c => { if (c.id === "status" && cv.status) c.text = cv.status.label; if (cv[c.id] && cv[c.id].date) c.text = cv[c.id].date; }); }
      return { ok: true, data: { change_multiple_column_values: { id: "1" }, create_update: { id: "2" } } }; });
    await p.addInitScript(() => { const store = {}; window.chrome = { runtime: { sendMessage: async m => m.type === "gql" ? window.__gql(m.query, m.variables) : null, onMessage: { addListener(f) { window.__onMsg = f; } } },
      storage: { local: { get: (k, cb) => cb && cb(store), set(o) { Object.assign(store, o); } }, onChanged: { addListener() {} } } }; });
    await p.route(u => u.href.split("#")[0] === url.split("#")[0], r => r.fulfill({ contentType: "text/html", body: html }));
    p.on("pageerror", e => { console.error("page error:", e.message); process.exitCode = 1; });
    await p.goto(url);
    await p.addScriptTag({ content: fs.readFileSync(path.join(dir, "logic.js"), "utf8") });
    await p.addScriptTag({ content: fs.readFileSync(path.join(dir, "content.js"), "utf8") });
    return p;
  }
  const txt = (p, s) => p.evaluate(s => { const n = document.querySelector("#poddster-river").shadowRoot.querySelector(s); return n ? n.textContent.replace(/\s+/g, " ").trim() : null; }, s);
  const all = (p, s) => p.evaluate(s => [...document.querySelector("#poddster-river").shadowRoot.querySelectorAll(s)].map(n => n.textContent.replace(/\s+/g, " ").trim()), s);
  const sh = (p, s) => p.locator("#poddster-river").locator(s);
  const wait = (p, s, re) => p.waitForFunction(([s, re]) => { const n = document.querySelector("#poddster-river")?.shadowRoot?.querySelector(s); return n && new RegExp(re).test(n.textContent); }, [s, re.source], { timeout: 6000 });

  // 1. Gmail: the open email's task, then a note from the highlighted feedback.
  let p = await open("https://mail.google.com/mail/u/0/#inbox/FMfcgz", GMAIL);
  await wait(p, "h2", /Brett King - Session 02\.10\.26/);
  assert.ok(/Matched Brett King/.test(await txt(p, ".ttl span")));
  await wait(p, ".ups", /Roy|Someone/);
  console.log("✓ Gmail: the open email shows Brett King - Session 02.10.26 with its latest notes");
  await p.screenshot({ path: path.join(shots, "1-gmail.png") });
  await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById("fb")); getSelection().removeAllRanges(); getSelection().addRange(r); });
  await sh(p, '[data-a="grab"]').click(); await sh(p, '[data-a="post"]').click(); await p.waitForTimeout(200);
  const note = calls.find(c => /create_update/.test(c.q)); assert.ok(/12:40 please cut/.test(note.v.b) && note.v.m[0].id === "88817643");
  await wait(p, ".toast", /Note posted to Akssat, moved to Corrections, V1/);
  console.log("✓ Gmail: highlighted feedback → note to @Akssat, Corrections, V1 date");

  // 2. Search your tasks from the same panel.
  await sh(p, "#q").click(); await wait(p, ".count", /open tasks?/);
  let names = await all(p, ".rs .nm");
  assert.ok(!names.some(n => /Saeed/.test(n)), "Done hidden under Open");
  assert.ok(/Eric Krawetz|Laiba Khan - Session 23\.09\.26 \(REC 2\)/.test(names[0]), "most overdue first: " + names[0]);
  console.log("✓ Search: focusing it lists your open tasks, most overdue first (" + names.length + ")");
  await sh(p, "#q").type("laiba"); await p.waitForTimeout(50);
  names = await all(p, ".rs .nm"); assert.deepStrictEqual(names.length, 2, "two Laiba tasks: " + names);
  await sh(p, "#q").fill("igor late"); await p.waitForTimeout(50);
  names = await all(p, ".rs .nm"); assert.ok(names.length === 2 && names.every(n => /Laiba/.test(n)), "editor + late words: " + names);
  console.log("✓ Search: instant, every word matches name/client/editor/stage, “late” works as a word");
  await p.screenshot({ path: path.join(shots, "2-search.png") });
  await sh(p, "#q").fill("saeed"); await sh(p, '[data-filter="done"]').click();
  assert.ok(/Saeed Alghafri/.test(await txt(p, ".res")), "Done filter shows finished work");
  await sh(p, '[data-scope="everyone"]').click(); await sh(p, "#q").fill("brett"); await wait(p, ".res", /Brett Lee/);
  assert.ok(/Ajin/.test(await txt(p, ".res")));
  console.log("✓ Search: Done filter, and Everyone searches all producers on Monday");
  await sh(p, '[data-scope="mine"]').click(); await sh(p, '[data-filter="open"]').click(); await sh(p, "#q").fill("olga");
  await sh(p, "#q").press("Enter"); await wait(p, "h2", /Olga Melnyk/);
  assert.ok(/Back to results/.test(await txt(p, ".back")));
  await sh(p, ".back").click(); assert.ok(/Olga/.test(await txt(p, ".res")));
  console.log("✓ Search: Enter opens the task, Back returns to the results");
  await p.close();

  // 3. Any other site: a small River button, search with the shortcut, right-click text.
  p = await open("https://someblog.example/podcast-growth", ARTICLE);
  await p.waitForFunction(() => document.querySelector("#poddster-river").shadowRoot.querySelector(".fab"));
  console.log("✓ Any site: a small River button sits in the corner");
  await p.screenshot({ path: path.join(shots, "3-site-fab.png") });
  await p.evaluate(() => window.__onMsg({ type: "toggle", q: "Laiba Khan" })); await wait(p, ".count", /2 open tasks/);
  console.log("✓ Any site: right-click “Find in River” opens the panel searching the highlighted name");
  await p.screenshot({ path: path.join(shots, "4-site-search.png") });
  await sh(p, '[data-a="hide"]').click(); await p.waitForTimeout(50);
  assert.strictEqual(await txt(p, ".fab"), null, "hidden on this site");
  await p.evaluate(() => window.__onMsg({ type: "toggle" })); await wait(p, ".find", /./);
  console.log("✓ Any site: “Hide on this site” removes the button; the shortcut still opens River");
  await p.close();

  // 4. Frame.io: the episode in the page title, and a task's upload folder by its link.
  p = await open("https://next.frame.io/player/xyz", FRAMEIO);
  await wait(p, ".pill", /Brett King · /);
  console.log("✓ Frame.io: a review page titled “Brett King - Session 02.10.26.mp4” shows that task in the pill");
  await p.screenshot({ path: path.join(shots, "5-frameio-pill.png"), clip: { x: 1000, y: 780, width: 440, height: 120 } });
  await p.close();
  p = await open("https://next.frame.io/project/aaa-111/bbb-222", FRAMEIO_FOLDER);
  await wait(p, ".pill", /Al Tamimi · In Process/);
  console.log("✓ Frame.io: opening a task's upload folder recognises Al Tamimi - Session 08.10.26 from its link");
  await sh(p, ".pill").click(); await wait(p, "h2", /Al Tamimi/);
  await p.screenshot({ path: path.join(shots, "6-frameio-card.png") });
  await p.close();

  await b.close(); console.log("All UI tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
