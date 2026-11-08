// Local River Wrist back end with a fake Monday, for the Connect IQ simulator.
// node tests/serve-mock.js <port> <key>
process.env.TZ = "Africa/Cairo";
const http = require("http");
const L = require("../lib/logic.js");
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return L.isoOf(d); };
const col = (id, text, extra) => Object.assign({ id, text }, extra || {});
const item = (id, name, stage, ed, dates, client) => ({ id, name, url: "u", created_at: "2026-10-01", updated_at: "2026-11-01", group: { title: "g" },
  column_values: [col("status", stage), col("person", ed), col("people", "Abdullah Ghanem"), col("date", dates.a || ""), col("date4", dates.d || ""),
    col("date_mkx87nb3", dates.v1 || ""), col("dup__of_1st_cut_deadline", ""), col("date_mm02j5tr", ""),
    col("board_relation_mkxb8cpz", "", { display_value: client, linked_item_ids: ["1"] })] });
const ITEMS = [
  item("201", "Olga Melnyk - Session 02.10.26", "Corrections", "Ajin", { a: day(-30), d: day(-20), v1: day(1) }, "AG - Olga Melnyk"),
  item("202", "Soukaina El mizeb - Session 02.11.26", "Corrections", "Georges Saliba", { a: day(-6), d: day(-1), v1: day(1) }, "AG - Soukaina El mizeb"),
  item("203", "ENBD Finwell - Session 03.11.26 (Highlights)", "Assigned", "Ashraf", { a: day(-2), d: day(1) }, "AG - ENBD"),
  item("204", "Al Tamimi - Session 04.11.26 Clip 1", "In Process", "Igor Garčev", { a: day(-3), d: day(1) }, "AG - Al Tamimi"),
  item("205", "Renata Messarra - Session 05.11.26", "In Process", "Igor Garčev", { a: day(-2), d: day(2) }, "AG - Renata Messarra"),
  item("206", "Nima Shahrouzi - Session 05.11.26", "Queue", "", { a: day(-1), d: day(2) }, "AG - Nima Shahrouzi"),
  item("207", "Al Tamimi - Session 25.09.26", "Client Review", "Igor Garčev", { a: day(-50), d: day(-38) }, "AG - Al Tamimi"),
  item("208", "Daniel Dargan - Session 18.09.26 REC 2", "Client Review", "Igor Garčev", { a: day(-50), d: day(-38) }, "AG - Daniel Dargan"),
  item("209", "Fatima Al Shirawi - Session 04.10.26", "Client Review", "Stipe Majić", { a: day(-40), d: day(-32) }, "AG - Fatima Al Shirawi"),
  item("210", "Rita Baki - Session 20.10.26", "Client Review", "Motasem Jammal", { a: day(-12), d: day(-3) }, "AG - Rita Baki"),
  item("211", "Inass Wehbe - Session 22.10.26", "In Review", "Stipe Majić", { a: day(-8), d: day(4) }, "AG - Inass Wehbe"),
  item("212", "Laura client - Session 05.11.26", "In Process", "Ajin", { a: day(-3), d: day(-1) }, "BL - Laura Client"),
  item("213", "Mohamed Alyousuf - Session 02.09.26", "Client Review", "Motasem Jammal", { a: day(-60), d: day(-17) }, "AG - Mohamed Alyousuf")
];
global.fetch = async (url, opts) => {
  const b = JSON.parse(opts.body); let data;
  if (/items_page\(limit: 500/.test(b.query)) data = { boards: [{ items_page: { cursor: null, items: ITEMS } }] };
  else if (/items\(ids:/.test(b.query)) data = { items: ITEMS.filter(i => b.variables.ids.includes(i.id)) };
  else if (/change_multiple/.test(b.query)) {
    const it = ITEMS.find(i => i.id === b.variables.i), v = JSON.parse(b.variables.v);
    it.column_values.forEach(c => { if (c.id === "status") c.text = v.status.label; if (v[c.id] && v[c.id].date) c.text = v[c.id].date; });
    console.log("WRITE", b.variables.i, b.variables.v);
    data = { change_multiple_column_values: { id: b.variables.i } };
  }
  return { status: 200, json: async () => ({ data }) };
};
process.env.MONDAY_TOKEN = "fake"; process.env.WRIST_KEY = process.argv[3];
const handler = require("../api/wrist.js");
http.createServer((req, res) => {
  let body = ""; req.on("data", c => body += c); req.on("end", () => {
    console.log(req.method, req.url, req.headers["x-river-key"] ? "key" : "nokey");
    const r = { setHeader: (k, v) => res.setHeader(k, v), status(c) { res.statusCode = c; return this; }, json(o) { res.setHeader("Content-Type", "application/json"); res.end(JSON.stringify(o)); } };
    handler({ method: req.method, headers: req.headers, body: body ? JSON.parse(body) : {} }, r);
  });
}).listen(+process.argv[2], () => console.log("mock on", process.argv[2]));
