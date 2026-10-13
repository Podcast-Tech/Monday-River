// Opens River Studio at desktop size with a mocked Claude runtime (Monday, Calendar, db), checks the rooms, drags, capacity and panel.
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
const mk = (id, name, stage, editor, avail, draft, o = {}) => ({ id, name, url: "https://poddsterstudios-team.monday.com/boards/2472462203/pulses/" + id, updated_at: o.upd || "2026-10-08T10:00:00Z", created_at: d(-8) + "T10:00:00Z",
  column_values: { status: stage, person: editor, date: avail, date4: draft, date_mkx87nb3: o.v1 || null, board_relation_mkxb8cpz: [{ id: "1", name: "AG - " + name.split(" - ")[0] }], numeric_mm1y5e6b: String(o.u || 1), link_mkxbtnjf: "https://f.io/x" } });
const ITEMS = [
  mk("1", "Laiba Khan - Session 23.09.26 (REC 2)", "In Process", "Igor Garčev", d(-8), d(-3), { u: 2 }),
  mk("2", "Al Tamimi - Session 08.10.26", "In Process", "Stipe Majić", d(-4), d(0)),
  mk("3", "Olga Melnyk - Session 02.10.26", "Corrections", "Motasem Jammal", d(-9), d(-6), { v1: d(1) }),
  mk("4", "Katie Robertson - Session 01.10.26 - Highlights", "Queue", "", d(-3), d(2)),
  mk("5", "Rayhan Aleem - Session 12.10.26", "Queue", "", d(0), d(2)),
  mk("6", "Eric Krawetz - Session 25.09.26", "In Review", "Georges Saliba", d(-6), d(-1)),
  mk("7", "Alice Lovell - Session 04.10.26 - Ep 4", "In Process", "Akssat", d(-5), d(4)),
  mk("8", "Alice Lovell - Session 04.10.26 - Ep 5", "Assigned", "Akssat", d(-2), d(6)),
  mk("9", "Joana Castro - Session 03.07.26", "In Process", "Igor Garčev", d(-10), d(5), { u: 3 }),
  mk("10", "Brett King - Session 02.10.26", "Client Review", "Akssat", d(-8), d(-5)),
  mk("11", "Laiba Khan - Session 23.09.26 (REC 1 P2)", "Client Review", "Igor Garčev", d(-14), d(-12)),
  mk("12", "Chris Steiner - Session 01.10.26", "Client Review", "Stefan Mikić", d(-6), d(-2)),
  mk("13", "Dmitrii Tverdokhleb - Session 07.08.26 (P#2)", "Client Review", "Stefan Mikić", d(-60), d(-55)),
  mk("14", "ENBD (Finwell - Arabic) - Session 02.10.26", "Client Review", "Mahmoud", d(-9), d(-8)),
  mk("15", "Saeed Alghafri - Session 28.06.26 (P#1)", "Done", "Stefan Mikić", d(-100), d(-99), { upd: new Date().toISOString() }),
];
const wd = n => { const x = new Date(); let k = 0; while (k < n) { x.setDate(x.getDate() + 1); if (x.getDay() % 6) k++; } return x.toISOString().slice(0, 10); };
const ev = (id, name, day, services, addons) => ({ id, summary: name + " | Poddster Booking", status: "confirmed", start: { dateTime: day + "T14:00:00+04:00" }, end: { dateTime: day + "T15:00:00+04:00" }, organizer: { displayName: "Al Barsha Studio 1" },
  description: `Order ID: X${id}\nCustomer: ${name}\nServices:\n${services}` + (addons ? `\nAdditional Services:\n${addons}` : "") });
const EVENTS = [ev("a", "Test Client", wd(1), "Recording + Pro Edit + Reels"), ev("b", "Olga Melnyk", wd(1), "Recording + Professional Edit", "Standard Reel (12)"),
  ev("c", "Sharon Pakir", wd(2), "Recording + Live Mix"), ev("d", "Laura Person", wd(2), "Recording + Professional Edit"), ev("e", "Brand New Co", wd(1), "Recording + Pro Edit + Reels")];
(async () => {
  const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }), calls = [], dbw = [];
  await p.exposeFunction("__call", (server, tool, input) => { calls.push({ server, tool, input });
    if (tool === "list_events") return { payload: { events: input.calendarId === "production@poddster.com" ? EVENTS : [] } };
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
  await p.goto("https://studio.test/"); await p.waitForSelector(".suite"); await p.waitForSelector(".bk");
  const t = s => p.evaluate(s => [...document.querySelectorAll(s)].map(n => n.textContent.replace(/\s+/g, " ").trim()), s);
  const suites = await t(".suite .s-h .nm"); assert.strictEqual(suites[0], "Igor Garčev", "busiest suite first: " + suites);
  assert.strictEqual((await t(".guest")).length, 2); assert.strictEqual((await t("#screening .seats .seat")).length, 5);
  assert.strictEqual((await t(".vip .seat")).length, 2, "Dmitrii and ENBD in the VIP row");
  assert.ok(/lit/.test(await p.getAttribute("#onair", "class")));
  console.log("✓ Floor: green room 2 guests, suites " + suites.slice(0, 4).join(", ") + "…, screening room with a VIP row, ON AIR lit");
  const bk = await t(".bk"); assert.ok(bk.some(x => /Laura Person.*Laura's/.test(x)) && bk.some(x => /Sharon Pakir.*rec only/.test(x)) && bk.some(x => /Olga Melnyk.*≈5u/.test(x)), "bookings: " + bk);
  console.log("✓ On-air board: sessions read from the calendar, units estimated (Olga ≈5u = edit + 12 reels), Laura's not counted, live mix = rec only");
  assert.ok(/Most work is held in/.test((await t("#necks .verdict"))[0]));
  console.log("✓ Bottleneck meter: " + (await t("#necks .verdict"))[0]);
  await p.screenshot({ path: path.join(shots, "1-studio.png"), fullPage: true });
  // capacity
  const capBefore = (await t('.strip:first-child .capin span'))[0];
  await p.click('.strip:first-child [data-d="1"]'); await p.waitForTimeout(800);
  assert.ok(dbw.length && dbw[0].path === "settings/capacity" && dbw[0].data.caps.igor === 4, "capacity saved: " + JSON.stringify(dbw));
  console.log("✓ Capacity + on Igor: " + capBefore + " → " + (await t('.strip:first-child .capin span'))[0] + ", saved to the studio database");
  // drag a guest into a suite
  await p.dragAndDrop('.guest[data-ep="4"]', '.suite[data-drop="Akssat"]'); await p.waitForTimeout(150);
  const re = calls.find(c => c.tool === "change_item_column_values"); const cv = JSON.parse(re.input.columnValues);
  assert.strictEqual(cv.person.personsAndTeams[0].id, 88817643); assert.strictEqual(cv.status.label, "Assigned");
  console.log("✓ Drag Katie Robertson from the green room into Akssat's suite → person Akssat + Assigned");
  // panel
  await p.click('.seat[data-ep="10"]'); await p.waitForSelector("#panel h2");
  assert.ok(/Brett King/.test((await t("#panel h2"))[0]));
  console.log("✓ Clicking a seat opens River's episode panel");
  await p.screenshot({ path: path.join(shots, "2-panel.png") });
  await p.keyboard.press("Escape");
  await p.setViewportSize({ width: 420, height: 900 }); await p.waitForTimeout(100);
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw[0] <= sw[1] + 1, "no sideways scroll at phone width " + sw);
  console.log("✓ Phone width stacks the rooms without sideways scrolling");
  await b.close(); console.log("All studio tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
