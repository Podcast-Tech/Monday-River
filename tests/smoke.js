// Smoke test: runs the page script against a fake DOM and a mocked monday.com connector.
// Usage: node tests/smoke.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/start\(\);\s*$/, "");

const el = () => ({ innerHTML: "", textContent: "", hidden: false, className: "", style: {}, value: "", disabled: false,
  classList: { contains() { return false; }, toggle() {} }, addEventListener() {}, querySelector() { return null; }, focus() {},
  getBoundingClientRect() { return { left: 0, top: 0, width: 1400, height: 520, right: 0 }; },
  setPointerCapture() {}, releasePointerCapture() {}, offsetWidth: 100, offsetHeight: 40 });
const els = {};
global.document = { getElementById: id => els[id] || (els[id] = el()), querySelector: () => el(), addEventListener() {}, activeElement: null };
global.window = {}; global.setInterval = () => 0; global.setTimeout = () => 0; global.clearTimeout = () => 0;
global.localStorage = { getItem() { return null; }, setItem() {} };

const test = new Function("els", "assert", src + `
  return (async () => {
    const calls = [];
    mcp = { invalidate: async () => {}, callTool: async (server, tool, input) => {
      calls.push({ tool, input });
      if (tool === "get_board_items_page" && input.boardId === CLIENTS_BOARD) return { payload: { items: [{ id: "77", name: "AG - Test Client" }] } };
      if (tool === "create_item") return { payload: { id: "13200000001" } };
      return { payload: {} };
    } };
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return isoOf(x); };
    const iso = n => new Date(Date.now() + n * 864e5).toISOString();
    const st = ["Queue","Assigned","In Process","In Review","Corrections","Client Review","Done"];
    S.items = Array.from({ length: 40 }, (_, k) => norm({ id: String(1000 + k), name: "Client " + k + " - Session", updated_at: iso(-(k % 10)), created_at: iso(-(k % 9)),
      column_values: { status: st[k % 7], person: "Igor Garčev", date: d(-5), date4: d((k % 12) - 5), board_relation_mkxb8cpz: [{ id: "77", name: "AG - Client " + k }] } }));
    S.loading = false; S.storedAt = Date.now();

    render();
    assert.ok(!/NaN/.test(els.river.innerHTML), "river has NaN coordinates");
    assert.strictEqual((els.river.innerHTML.match(/<g class="fish /g) || []).length, S.items.filter(i => FLOW.includes(i.stage)).length, "one dot per open episode");
    console.log("✓ river renders", (els.river.innerHTML.match(/<g class="fish /g) || []).length, "episodes");

    const it = S.items.find(i => i.stage === "In Review"); it.v1 = null; it.final = null;
    await setStage(it, "Corrections");
    const cv = JSON.parse(calls[calls.length - 1].input.columnValues);
    assert.strictEqual(cv.status.label, "Corrections"); assert.strictEqual(cv.date_mkx87nb3.date, addWorkdays(2));
    console.log("✓ Corrections fills next empty date (V1 =", cv.date_mkx87nb3.date + ")");

    openAdd(); await loadClients();
    Object.assign(S.form, { client: "Test Client", clientId: "77", editor: "Igor Garčev" }); S.form.name = autoName(S.form);
    await createTask();
    const ci = calls.find(c => c.tool === "create_item").input, ccv = JSON.parse(ci.columnValues);
    assert.strictEqual(ccv.date.date, todayISO()); assert.strictEqual(ccv.date4.date, addWorkdays(2)); assert.strictEqual(ccv.status.label, "Assigned");
    console.log("✓ Add task sets Available today, Draft", ccv.date4.date + ", Assigned");

    const mover = S.items.find(i => i.stage === "Assigned");
    S.drag = { id: mover.id, from: mover.stage, sx: 0, sy: 0, x: 0, y: 0, moved: true }; S.dropZone = "In Process";
    endDrag({ pointerId: 1 }, false); await new Promise(r => r());
    assert.ok(calls.some(c => c.tool === "change_item_column_values" && /In Process/.test(c.input.columnValues)), "drag moves stage");
    console.log("✓ Drag across a gate changes stage");
    console.log("All smoke tests passed.");
  })();
`);
test(els, assert).catch(e => { console.error("✗", e.message); process.exit(1); });
