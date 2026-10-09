// Renders the real content script on a fake Gmail thread with a mocked Monday, clicks through it and screenshots.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const F = require("./fixtures.js"), dir = path.join(__dirname, "..");
const gmail = `<!doctype html><html><body style="margin:0;font-family:Arial;background:#f6f8fc">
  <div style="display:flex;height:100vh"><div style="width:250px;background:#f6f8fc"></div>
  <div role="main" style="flex:1;background:#fff;margin:12px;border-radius:16px;padding:24px 32px">
    <h2 class="hP" style="font-weight:400;font-size:22px">Re: Brett King - Session 02.10.26 edit feedback</h2>
    <div><span class="gD" email="brett@provoke.fm" name="Brett King"><b>Brett King</b></span> &lt;brett@provoke.fm&gt; to <span class="g2" email="abdullah@poddster.com" name="me">me</span>, <span class="g2" email="production@poddster.com" name="Production">Production</span></div>
    <div id="msg" style="margin-top:20px;line-height:1.6">Hi Abdullah,<br><br>Loved the draft! A few small things:<br>
      <p id="fb">1. At 12:40 please cut the part where I mention the old app name.<br>2. Can the intro music be a bit softer?</p>Thanks, Brett</div></div></div></body></html>`;
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  const calls = [];
  await p.exposeFunction("__gql", (q, v) => { calls.push({ q, v });
    if (/items_page_by_column_values/.test(q)) return { ok: true, data: F.clients };
    if (/items_page\(/.test(q)) return { ok: true, data: F.episodes };
    if (/users\(/.test(q)) return { ok: true, data: { users: [] } };
    if (/change_multiple_column_values/.test(q)) { const it = F.episodes.boards[0].items_page.items.find(i => i.id === String(v.i)), cv = JSON.parse(v.v);
      it.column_values.forEach(c => { if (c.id === "status" && cv.status) c.text = cv.status.label; if (cv[c.id] && cv[c.id].date) c.text = cv[c.id].date; }); }
    return { ok: true, data: { change_multiple_column_values: { id: "1" }, create_update: { id: "2" } } }; });
  await p.addInitScript(() => { window.chrome = { runtime: { sendMessage: async m => m.type === "gql" ? window.__gql(m.query, m.variables) : null }, storage: { local: { get: (k, cb) => cb && cb({}), set() {} } } }; });
  await p.route("https://mail.google.com/**", r => r.fulfill({ contentType: "text/html", body: gmail }));
  p.on("pageerror", e => { console.error("page error:", e.message); process.exitCode = 1; });
  await p.goto("https://mail.google.com/mail/u/0/#inbox/FMfcgz");
  await p.addScriptTag({ content: fs.readFileSync(path.join(dir, "logic.js"), "utf8") });
  await p.addScriptTag({ content: fs.readFileSync(path.join(dir, "content.js"), "utf8") });
  await p.waitForFunction(() => document.querySelector("#poddster-river").shadowRoot.querySelector("h2"));
  const sh = sel => p.evaluate(s => { const n = document.querySelector("#poddster-river").shadowRoot.querySelector(s); return n ? n.textContent : null; }, sel);
  assert.strictEqual((await sh("h2")).trim(), "Brett King - Session 02.10.26");
  assert.ok(/Matched Brett King/.test(await sh(".ttl span")));
  assert.ok(/1 more on Monday/.test(await sh(".others")));
  console.log("✓ opening the email shows Brett King - Session 02.10.26, with Suvo's episode as 1 more");
  await p.screenshot({ path: path.join(__dirname, "panel.png") });
  // Highlight the client's notes in the email, add them, post with Corrections.
  await p.evaluate(() => { const r = document.createRange(); r.selectNodeContents(document.getElementById("fb")); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  const shadow = s => p.locator("#poddster-river").locator(s);
  await shadow('[data-a="grab"]').click();
  assert.ok(/12:40 please cut/.test(await p.evaluate(() => document.querySelector("#poddster-river").shadowRoot.querySelector("#note").value)));
  await shadow("#note").press("End"); await shadow("#note").type("\nThanks!");
  await p.screenshot({ path: path.join(__dirname, "panel-note.png") });
  await shadow('[data-a="post"]').click(); await p.waitForTimeout(200);
  const note = calls.find(c => /create_update/.test(c.q)), cols = calls.find(c => /change_multiple_column_values/.test(c.q));
  assert.ok(/12:40 please cut/.test(note.v.b) && /<br>/.test(note.v.b)); assert.deepStrictEqual(note.v.m, [{ id: "88817643", type: "User" }]);
  const cv = JSON.parse(cols.v.v); assert.strictEqual(cv.status.label, "Corrections"); assert.ok(cv.date_mkx87nb3.date, "V1 filled");
  assert.ok(/Note posted to Akssat, moved to Corrections, V1/.test(await sh(".toast")));
  console.log("✓ selected email text → note to Akssat with @mention, moved to Corrections, V1 = " + cv.date_mkx87nb3.date);
  await p.screenshot({ path: path.join(__dirname, "panel-posted.png") });
  // Typing in the panel must not trigger Gmail shortcuts.
  const leaked = await p.evaluate(() => { let n = 0; document.addEventListener("keydown", () => n++); const ta = document.querySelector("#poddster-river").shadowRoot.querySelector("#note"); ta.dispatchEvent(new KeyboardEvent("keydown", { key: "c", bubbles: true, composed: true })); return n; });
  assert.strictEqual(leaked, 0); console.log("✓ typing in River doesn't reach Gmail's shortcuts");
  await shadow('[data-a="min"]').click(); await p.waitForTimeout(100);
  const pt = await sh(".pill"); assert.ok(/Brett King · Corrections/.test(pt), "pill: " + pt); console.log("✓ minimised pill shows Brett King · Corrections");
  await p.screenshot({ path: path.join(__dirname, "pill.png"), clip: { x: 1000, y: 780, width: 440, height: 120 } });
  await b.close(); console.log("All UI tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
