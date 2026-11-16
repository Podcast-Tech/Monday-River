// Mocks Monday and the HTTP layer; checks auth, the summary shape and the Corrections rule.
process.env.TZ = "Africa/Cairo";
const assert = require("assert");
const L = require("../lib/logic.js");
// The back end's rules must be River's: lib/logic.js is a verbatim copy of extension/logic.js.
const fs = require("fs"), path = require("path");
const src = path.join(__dirname, "../../../extension/logic.js");
if (fs.existsSync(src)) assert.strictEqual(fs.readFileSync(path.join(__dirname, "../lib/logic.js"), "utf8"), fs.readFileSync(src, "utf8"), "wrist/api/lib/logic.js is out of date: copy extension/logic.js");

const iso = d => L.isoOf(d);
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
const col = (id, text, extra) => Object.assign({ id, text }, extra || {});
const item = (id, name, stage, dates, client) => ({
  id, name, url: "u", created_at: "2026-10-01", updated_at: "2026-11-01", group: { title: "g" },
  column_values: [col("status", stage), col("person", "Igor Garčev"), col("people", "Abdullah Ghanem"),
    col("date", dates.a || ""), col("date4", dates.d || ""), col("date_mkx87nb3", dates.v1 || ""),
    col("dup__of_1st_cut_deadline", ""), col("date_mm02j5tr", ""),
    col("board_relation_mkxb8cpz", "", { display_value: client || "AG - Rita Baki", linked_item_ids: ["1"] })]
});
const ITEMS = [
  item("101", "Rita Baki - Session 01.11.26", "In Process", { a: day(-6), d: day(-2) }),
  item("102", "Inass Wehbe - Session 03.11.26", "Assigned", { a: day(-1), d: day(0) }),
  item("103", "Olga Melnyk - Session 04.11.26 Reel", "In Review", { a: day(-1), d: day(2) }),
  item("104", "Someone - Session 05.11.26", "Client Review", { a: day(-20), d: day(-12) }),
  item("105", "ENBD - Session 05.11.26", "Client Review", { a: day(-20), d: day(-12) }),
  item("106", "Laura client - Session 05.11.26", "In Process", { a: day(-3), d: day(-1) }, "BL - Laura Client"),
  item("107", "Old - Session 01.10.26", "Done", { a: day(-40), d: day(-38) }),
  item("108", "Later - Session 06.11.26", "Assigned", { a: day(0), d: day(9) }),
  item("109", "Parked - Session 01.11.26", "No Rush", { a: day(-30), d: day(-20) })
];

let calls = [];
global.fetch = async (url, opts) => {
  const body = JSON.parse(opts.body); calls.push(body);
  assert.strictEqual(opts.headers.Authorization, "tok");
  let data;
  if (/items_page\(limit: 500/.test(body.query)) data = { boards: [{ items_page: { cursor: null, items: ITEMS } }] };
  else if (/items\(ids:/.test(body.query)) data = { items: ITEMS.filter(i => body.variables.ids.includes(i.id)) };
  else if (/change_multiple_column_values/.test(body.query)) data = { change_multiple_column_values: { id: body.variables.i } };
  return { status: 200, json: async () => ({ data }) };
};

const handler = require("../api/wrist.js");
function call(method, headers, body) {
  return new Promise(resolve => {
    const res = { code: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, status(c) { this.code = c; return this; }, json(o) { resolve({ code: this.code, body: o }); } };
    handler({ method, headers, body }, res);
  });
}

(async () => {
  process.env.WRIST_KEY = "secret-key"; process.env.MONDAY_TOKEN = "tok";
  const K = { "x-river-key": "secret-key" };

  // auth
  assert.strictEqual((await call("GET", {})).code, 401);
  assert.strictEqual((await call("GET", { "x-river-key": "secret-kez" })).code, 401);

  // summary
  const s = await call("GET", K);
  assert.strictEqual(s.code, 200, JSON.stringify(s.body));
  const b = s.body;
  assert.strictEqual(b.late, 3, "late: 101, 104 (quiet CR), 106 — not ENBD");
  assert.strictEqual(b.today, 1);
  assert.strictEqual(b.review, 2);
  assert.strictEqual(b.open, 7, "No Rush 109 not counted");
  assert.ok(!b.eps.some(e => e.id === "109"), "No Rush not listed");
  assert.deepStrictEqual(b.st, [0, 2, 2, 1, 0, 2], "per stage: Assigned 102+108, In Process 101+106, In Review 103, CR 104+105");
  assert.strictEqual(b.soon, 2, "102 today + 103 in 2 days");
  assert.deepStrictEqual(b.eps.map(e => e.id), ["101", "106", "104", "102", "103"], "River order: late edits, then quiet clients, 108/105/107 left out");
  assert.strictEqual(b.eps.find(e => e.id === "106").lk, 1, "Laura locked");
  assert.strictEqual(b.eps.find(e => e.id === "101").r, "2d late");
  assert.strictEqual(b.eps.find(e => e.id === "103").n, "Olga Melnyk 04.11 Reel");
  assert.ok(JSON.stringify(b).length < 4000, "small enough for the watch: " + JSON.stringify(b).length);

  // moves
  calls = [];
  const m = await call("POST", K, { id: "103", stage: "Corrections" });
  assert.strictEqual(m.code, 200, JSON.stringify(m.body));
  const w = calls.find(c => /change_multiple/.test(c.query));
  const v = JSON.parse(w.variables.v);
  assert.deepStrictEqual(v.status, { label: "Corrections" });
  assert.ok(v.date_mkx87nb3 && v.date_mkx87nb3.date, "Corrections fills the next empty date (V1)");
  assert.ok(/V1/.test(m.body.msg), m.body.msg);

  assert.strictEqual((await call("POST", K, { id: "106", stage: "Done" })).code, 403, "Laura's lane");
  assert.strictEqual((await call("POST", K, { id: "101", stage: "Paid" })).code, 400);
  assert.strictEqual((await call("POST", K, { id: "x;drop", stage: "Done" })).code, 400);
  const plain = await call("POST", K, JSON.stringify({ id: "102", stage: "In Process" }));
  assert.strictEqual(plain.body.msg, "Moved to In Process");

  delete process.env.MONDAY_TOKEN;
  const nt = await call("GET", K); assert.strictEqual(nt.code, 503); assert.strictEqual(nt.body.err, "no_token");
  console.log("api tests passed · summary bytes", JSON.stringify(b).length);
})().catch(e => { console.error(e); process.exit(1); });
