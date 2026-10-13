// The 3D studio: serves Three.js r128 locally (npm i -g three@0.128.0), opens River Studio with a mocked runtime and checks
// that the building renders in WebGL, the views fly the camera, and picking, the drawer, the panel and drag-to-reassign work in 3D.
// Run: NODE_PATH=$(npm root -g) node studio/tests/studio3d.test.js
const { chromium } = require("playwright"), fs = require("fs"), path = require("path"), assert = require("assert");
const shots = path.join(__dirname, "shots"); fs.mkdirSync(shots, { recursive: true });
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const { ITEMS, EVENTS, MINE } = require("./fixtures");
const threeMin = fs.readFileSync(require.resolve("three/build/three.min.js"), "utf8"), orbit = fs.readFileSync(require.resolve("three/examples/js/controls/OrbitControls.js"), "utf8");
(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } }), calls = [];
  await p.exposeFunction("__call", (server, tool, input) => { calls.push({ server, tool, input });
    if (tool === "list_events") return { payload: { events: input.calendarId === "production@poddster.com" ? EVENTS : input.calendarId === "primary" && !input.fullText ? MINE : [] } };
    if (tool === "get_board_items_page") return { payload: { items: [{ id: "77", name: "AG - Test Client" }, { id: "78", name: "AG - Olga Melnyk" }, { id: "79", name: "BL - Laura Person" }] } };
    return { payload: {} }; });
  await p.addInitScript(items => {
    const store = {};
    const mcp = { watchTool(s, t, i, h) { setTimeout(() => h({ type: "result", result: { payload: t === "all_api_read" ? { notifications: [] } : { items } } }), 20); return () => {}; }, callTool: (s, t, i) => window.__call(s, t, i), invalidate: async () => {} };
    const db = { doc: path => ({ get: async () => ({ exists: !!store[path], data: () => store[path] }), set: async data => { store[path] = data; } }) };
    window.claude = { use: async n => n === "mcp" ? mcp : n === "db" ? db : null };
  }, ITEMS);
  p.on("pageerror", e => { console.error("page error:", e.message); process.exitCode = 1; });
  p.on("console", m => { if (m.type() === "error") console.error("console:", m.text()); });
  await p.route("https://studio.test/**", r => r.fulfill({ contentType: "text/html", body: '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1"></head><body>' + html + "</body></html>" }));
  await p.route("https://fonts.googleapis.com/**", r => r.abort());
  await p.route(/three\.min\.js$/, r => r.fulfill({ contentType: "text/javascript", body: threeMin }));
  await p.route(/OrbitControls\.js$/, r => r.fulfill({ contentType: "text/javascript", body: orbit }));
  await p.goto("https://studio.test/");
  await p.waitForFunction(() => window.R3D && R3D.on && R3D.stats().meshes > 300 && document.querySelectorAll(".lb").length > 10, null, { timeout: 20000 });
  await p.waitForTimeout(1500);
  const st = await p.evaluate(() => R3D.stats());
  assert.ok(await p.isVisible("#three canvas"), "WebGL canvas shown"); assert.ok(!(await p.isVisible("#scene")), "SVG hidden in 3D");
  const t = s => p.evaluate(s => [...document.querySelectorAll(s)].map(n => n.textContent.replace(/\s+/g, " ").trim()), s);
  const labels = (await t(".lb")).join(" | ");
  assert.ok(/LIVE · Katie Robertson/.test(labels), "Production live tag"); assert.ok(/Igor · /.test(labels), "booth tag"); assert.ok(/You/.test(labels));
  console.log(`✓ 3D studio renders in WebGL: ${st.meshes} pickable meshes, ${st.labels} labels, ${st.textures} textures, ${st.calls} draw calls`);
  await p.screenshot({ path: path.join(shots, "3d-1-overview.png") });
  const at = async key => { const w = await p.evaluate(k => R3D.where(k), key); assert.ok(w, "on screen: " + key); return w; };
  const still = async () => { const f0 = await p.evaluate(() => R3D.frames || 0); await p.waitForFunction(f0 => R3D.frames > f0 + 2 && R3D.still, f0, { timeout: 90000 }); };
  // views
  for (const [i, name] of [[1, "calendars"], [3, "booths"], [4, "screening"], [5, "control"], [2, "green"]]) { await p.click(`.views [data-view="${i}"]`); await still(); await p.screenshot({ path: path.join(shots, `3d-${i + 1}-${name}.png`) }); }
  console.log("✓ View buttons fly the camera to the calendars, booths, screening room, control room and green room");
  // orbit with the mouse: drag on empty canvas changes the camera
  const cam0 = await p.evaluate(() => R3D.where("room:control"));
  await p.mouse.move(1250, 760); await p.mouse.down(); await p.mouse.move(1000, 700, { steps: 10 }); await p.mouse.up(); await still();
  const cam1 = await p.evaluate(() => R3D.where("room:control"));
  assert.ok(Math.hypot(cam1.x - cam0.x, cam1.y - cam0.y) > 30, "orbit moved the view");
  console.log("✓ Dragging orbits the camera around the building");
  // keyboard turn + zoom
  await p.focus("#three"); await p.keyboard.press("e"); await p.keyboard.press("+"); await still();
  await p.click('.views [data-view="3"]');await still();
  // click a tape → episode panel
  let w = await at("tape:1"); await p.mouse.click(w.x, w.y); await p.waitForSelector("#panel h2", { timeout: 3000 });
  assert.ok(/Laiba Khan/.test((await t("#panel h2"))[0]), "panel: " + (await t("#panel h2"))[0] + " at " + JSON.stringify(w)); await p.keyboard.press("Escape"); await p.waitForTimeout(200);
  console.log("✓ Click a tape on Igor's desk in 3D → Laiba Khan's episode panel");
  // click a booth → drawer
  w = await at("drop:Akssat"); await p.mouse.click(w.x, w.y); await p.waitForSelector("#drawer .strip", { timeout: 3000 });
  assert.ok(/Akssat's booth/.test((await t("#drawer .d-h b"))[0])); await p.click('[data-act="drawer-close"]');
  console.log("✓ Click Akssat's booth → his suite drawer");
  // hover tooltip
  w = await at("drop:Stipe Majić"); await p.mouse.move(w.x, w.y); await p.waitForTimeout(150); await p.mouse.move(w.x + 2, w.y + 2); await p.waitForTimeout(150);
  assert.ok(!(await p.isHidden("#tip")) && /booth|Al Tamimi|Stipe/.test((await t("#tip"))[0]), "tooltip on hover: " + (await t("#tip"))[0]);
  console.log("✓ Hover in 3D: " + (await t("#tip"))[0]);
  // set tag → studio drawer
  await p.click('.views [data-view="1"]'); await still();
  await p.click('.lb[data-room="cal:Production"]'); await p.waitForSelector("#drawer .bk"); assert.ok(/Katie Robertson/.test((await t("#drawer .bk"))[0])); await p.click('[data-act="drawer-close"]');
  console.log("✓ Click Production's LIVE tag → its week");
  // drag a guest into a booth: frame the green room and the first booths together
  await p.evaluate(() => R3D.jump([13, 0, 18], [14, 26, 40])); await p.waitForTimeout(1500);
  const from = await at("gep:4"), to = await at("drop:Igor Garčev");
  await p.mouse.move(from.x, from.y); await p.mouse.down(); await p.mouse.move(from.x + 30, from.y + 10, { steps: 4 }); await p.mouse.move(to.x, to.y, { steps: 10 }); await p.waitForTimeout(100);
  assert.ok(/Give to Igor/.test((await t("#stage > .tip:not(#tip)")).join(" ")), "ghost names the editor: " + (await t("#stage > .tip:not(#tip)")).join(" / ") + JSON.stringify([from, to]));
  await p.screenshot({ path: path.join(shots, "3d-7-drag.png") });
  await p.mouse.up(); await p.waitForTimeout(300);
  const re = calls.find(c => c.tool === "change_item_column_values"); assert.ok(re, "reassign write"); const cv = JSON.parse(re.input.columnValues);
  assert.strictEqual(cv.status.label, "Assigned"); assert.ok(cv.person.personsAndTeams[0].id, "person set");
  console.log("✓ Drag Katie Robertson off the couch into Igor's booth in 3D → person + Assigned");
  // the outer walls fade when you look in from outside
  await p.evaluate(() => R3D.jump([30, 0, 20], [-40, 30, -30])); await p.waitForTimeout(500); await p.screenshot({ path: path.join(shots, "3d-8-behind.png") });
  console.log("✓ From behind the building the outer walls fade so you can see in");
  // phone size
  await p.setViewportSize({ width: 390, height: 844 }); await p.waitForTimeout(600); await p.click('.views [data-view="0"]'); await still();
  const sw = await p.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(sw[0] <= sw[1] + 1, "no sideways scroll " + sw);
  await p.screenshot({ path: path.join(shots, "3d-9-phone.png") });
  console.log("✓ Phone size: 3D fills the stage without sideways scrolling");
  await b.close(); console.log(process.exitCode ? "Finished with page errors." : "All 3D studio tests passed.");
})().catch(e => { console.error("✗", e.message); process.exit(1); });
