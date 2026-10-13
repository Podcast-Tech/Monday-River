// Fallback path (Three.js blocked). Opens River Studio at desktop size with a mocked Claude runtime (Monday, Calendar, db), checks the rooms, drags, capacity and panel.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const { ITEMS, EVENTS, MINE } = require("./fixtures");
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }), calls = [], dbw = [];
  await p.exposeFunction("__call", (server, tool, input) => { calls.push({ server, tool, input });
    if (tool === "list_events") return { payload: { events: input.calendarId === "production@poddster.com" ? EVENTS : input.calendarId === "primary" && !input.fullText ? MINE : [] } };
    if (tool === "get_board_items_page") return { payload: { items: [{ id: "77", name: "AG - Test Client" }, { id: "78", name: "AG - Olga Melnyk" }, { id: "79", name: "BL - Laura Person" }] } };
    return { payload: {} }; });
  await p.exposeFunction("__dbset", (path, data) => { dbw.push({ path, data }); });
  await p.addInitScript(items => {
    const store = {};
    const mcp = { watchTool(s, t, i, h) { setTimeout(() => h({ type: "result", result: { payload: t === "all_api_read" ? { notifications: [] } : { items } } }), 20); return () => {}; }, callTool: (s, t, i) => window.__call(s, t, i), invalidate: async () => {} };
    const db = { doc: path => ({ get: async () => ({ exists: !!store[path], data: () => store[path] }), set: async data => { store[path] = data; window.__dbset(path, data); } }) };
    window.claude = { use: async n => n === "mcp" ? mcp : n === "db" ? db : null };
  }, ITEMS);
  p.on("pageerror", e => { console.error("page error:", e.message); process.exitCode = 1; });
  await p.route("https://studio.test/**", r => r.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>' + html + "</body></html>" }));
  await p.route("https://fonts.googleapis.com/**", r => r.abort());
  await p.route(/cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net/, r => r.abort()); // no Three.js: the SVG drawing is the fallback
  await p.goto("https://studio.test/"); await p.waitForSelector("#scene [data-gep]"); await p.waitForTimeout(400);
  const t = s => p.evaluate(s => [...document.querySelectorAll(s)].map(n => n.textContent.replace(/\s+/g, " ").trim()), s);
  const n = s => p.evaluate(s => document.querySelectorAll(s).length, s);
  assert.strictEqual(await n("#scene [data-gep]"), 2, "two guests on the green-room couches");
  assert.strictEqual(await n("#scene .booth"), 11, "a booth per editor");
  assert.strictEqual(await n('#scene [data-room="screening"]'), 1);
  const seated = await p.evaluate(() => [...document.querySelectorAll("#scene [data-ep]")].map(e => e.dataset.ep));
  ["10", "11", "12", "13", "14"].forEach(id => assert.ok(seated.includes(id), "client-review " + id + " seated"));
  assert.ok(seated.includes("15"), "done tape on the delivery shelf");
  assert.ok(/lit/.test(await p.getAttribute("#onair", "class")));
  console.log("✓ Illustrated floor: 2 guests on the couches, 11 editor booths with tapes and monitors, 5 clients seated (2 VIP), delivery shelf, ON AIR lit");
  await p.screenshot({ path: path.join(shots, "1-studio.png"), fullPage: true });
  assert.ok(/LIVE · Katie Robertson/.test((await t('#scene g[data-room="cal:Production"]')).join(" ")), "Production shows the live session");
  await p.locator('#scene g[data-room="cal:Production"]').first().dispatchEvent("click"); await p.waitForSelector("#drawer .bk");
  assert.ok(/Katie Robertson/.test((await t("#drawer .bk"))[0])); await p.click('[data-act="drawer-close"]');
  console.log("✓ Calendar wing: Production is ON AIR with Katie Robertson's booking; clicking the room opens its week");
  // hover tooltip
  await p.hover('#scene g[data-room="suite:Igor Garčev"] > text'); assert.ok(/Igor Garčev's booth/.test((await t("#tip"))[0]));
  console.log("✓ Hover a booth: " + (await t("#tip"))[0]);
  // tape → episode panel
  await p.click('#scene [data-ep="1"] polygon >> nth=2'); await p.waitForSelector("#panel h2");
  assert.ok(/Laiba Khan/.test((await t("#panel h2"))[0])); await p.keyboard.press("Escape");
  console.log("✓ Click a tape on Igor's desk → Laiba Khan's episode panel");
  // drag a guest into a booth
  const from = await p.locator('#scene [data-gep="4"]').boundingBox(), to = await p.locator('#scene .booth[data-drop="Akssat"] polygon').first().boundingBox();
  await p.mouse.move(from.x + from.width / 2, from.y + from.height / 2); await p.mouse.down();
  await p.mouse.move(from.x + 40, from.y + 30, { steps: 4 }); await p.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 8 }); await p.mouse.up(); await p.waitForTimeout(200);
  const re = calls.find(c => c.tool === "change_item_column_values"); assert.ok(re, "reassign write"); const cv = JSON.parse(re.input.columnValues);
  assert.strictEqual(cv.person.personsAndTeams[0].id, 88817643); assert.strictEqual(cv.status.label, "Assigned");
  console.log("✓ Drag Katie Robertson off the couch into Akssat's booth → person Akssat + Assigned");
  // control room drawer: capacity
  await p.click('#scene [data-room="board"] polygon >> nth=0'); await p.waitForSelector("#drawer .days");
  assert.ok(/On-air board/.test((await t("#drawer .d-h b"))[0]));
  await p.click('[data-act="drawer-close"]');
  await p.locator('#scene .booth[data-drop="Igor Garčev"]').dispatchEvent('click'); await p.waitForSelector("#drawer .strip");
  assert.strictEqual(await n("#drawer .strip"), 1, "booth drawer shows only Igor's channel");
  await p.click('#drawer [data-d="1"]'); await p.waitForTimeout(800);
  assert.ok(dbw.length && dbw[0].data.caps.igor === 4, "capacity saved");
  console.log("✓ Click Igor's booth → his suite + channel; + raises capacity to 4/wk and saves it");
  await p.screenshot({ path: path.join(shots, "2-drawer.png") });
  await p.click('[data-act="drawer-close"]');
  await p.setViewportSize({ width: 420, height: 900 }); await p.waitForTimeout(100);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw[0] <= sw[1] + 1, "no sideways scroll at phone width " + sw);
  console.log("✓ Phone width scales the illustration without sideways scrolling");
  await b.close(); console.log("All studio tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
