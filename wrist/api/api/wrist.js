// River Wrist back end: the fēnix 8 Pro's window onto AG's Monday episodes.
// GET  /api/wrist            → counters + Needs-you list, small enough for the watch
// POST /api/wrist {id,stage} → move an episode to a stage (Corrections rule included)
// Auth: header X-River-Key must equal WRIST_KEY. Monday token lives in MONDAY_TOKEN and never leaves here.
process.env.TZ = "Africa/Cairo"; // AG's day, same as River in his browser
const L = require("../lib/logic.js");

const API = "https://api.monday.com/v2";
const MAX_EPS = 40; // ~150 bytes each; the watch handles this easily

async function gql(query, variables) {
  const token = process.env.MONDAY_TOKEN;
  if (!token) throw Object.assign(new Error("Monday token not set"), { code: "no_token", status: 503 });
  const res = await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: token, "API-Version": "2024-10" },
    body: JSON.stringify({ query, variables: variables || {} })
  });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Monday rejected the token"), { code: "bad_token", status: 502 });
  if (res.status === 429) throw Object.assign(new Error("Monday rate limit"), { code: "rate", status: 503 });
  const j = await res.json().catch(() => ({}));
  if (j.errors && j.errors.length) throw Object.assign(new Error(j.errors.map(e => e.message).join("; ")), { code: "api", status: 502 });
  if (j.error_message) throw Object.assign(new Error(j.error_message), { code: j.error_code || "api", status: 502 });
  return j.data;
}

async function myEpisodes() {
  const d = await gql(L.QUERIES.mine);
  let page = (((d.boards || [])[0] || {}).items_page) || {};
  let items = page.items || [];
  let guard = 0;
  while (page.cursor && guard++ < 5) {
    const m = await gql(L.QUERIES.more, { c: page.cursor });
    page = m.next_items_page || {};
    items = items.concat(page.items || []);
  }
  return items.map(L.normEpisode).filter(L.tracked); // "No Rush" is never tracked
}

// "Rita Baki - Session 01.11.26 Reel" → "Rita Baki 01.11 Reel": fits a watch row.
const shortName = n => String(n || "").replace(/\s*[-–]\s*Session\s+(\d{2}\.\d{2})\.\d{2}/i, " $1").replace(/[()]/g, "").replace(/\s+/g, " ").trim();
// "2 days late" → "2d late", "Due in 3 days" → "Due in 3d", "5 days with the client" → "5d with client".
const shortRel = t => String(t || "").replace(/(\d+) days? late/, "$1d late").replace(/Due in (\d+) days/, "Due in $1d").replace(/(\d+) days? with the client/, "$1d with client");
const clip = (s, n) => { s = String(s || ""); return s.length > n ? s.slice(0, n - 1) + "…" : s; };

function summary(eps) {
  const active = eps.filter(e => !L.CLOSED.has(e.stage));
  const late = active.filter(L.isLate);
  const today = active.filter(e => L.daysTo(e) === 0);
  const review = active.filter(e => e.stage === "Client Review");
  // Needs you (same as Pocket): late, then due today, then due in the next two days.
  const needs = active.filter(e => L.isLate(e) || (L.daysTo(e) !== null && L.daysTo(e) >= 0 && L.daysTo(e) <= 2))
    .sort((a, b) => L.urgency(a) - L.urgency(b));
  // Open episodes per stage, in River's flow order, for the watch's stage ring.
  const FLOW = ["Queue", "Assigned", "In Process", "In Review", "Corrections", "Client Review"];
  const st = FLOW.map(f => active.filter(e => e.stage === f).length);
  const soon = active.filter(e => !L.isLate(e) && L.daysTo(e) !== null && L.daysTo(e) >= 0 && L.daysTo(e) <= 2).length;
  const now = new Date();
  return {
    v: 1,
    at: String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0"),
    late: late.length, today: today.length, soon, review: review.length, open: active.length, st,
    eps: needs.slice(0, MAX_EPS).map(e => {
      const r = L.rel(e);
      return { id: e.id, n: clip(shortName(e.name), 26), c: clip(e.client, 22), s: e.stage, e: L.firstName(e.editor), r: shortRel(r.txt), k: r.cls, lk: e.laura ? 1 : 0 };
    }),
    more: Math.max(0, needs.length - MAX_EPS),
    stages: L.MOVE_TO
  };
}

async function moveStage(id, stage) {
  if (!/^\d+$/.test(String(id || ""))) throw Object.assign(new Error("Bad id"), { code: "bad_input", status: 400 });
  if (!L.MOVE_TO.includes(stage)) throw Object.assign(new Error("Bad stage"), { code: "bad_input", status: 400 });
  const d = await gql(L.QUERIES.item, { ids: [String(id)] });
  const raw = (d.items || [])[0];
  if (!raw) throw Object.assign(new Error("Episode not found"), { code: "not_found", status: 404 });
  const it = L.normEpisode(raw);
  if (it.laura) throw Object.assign(new Error("Laura's client: change it in River"), { code: "locked", status: 403 });
  if (it.stage === stage) return { ok: 1, msg: "Already " + stage };
  const cv = { status: { label: stage } };
  let msg = "Moved to " + stage;
  if (stage === "Corrections") {
    const p = L.correctionsPatch(it);
    Object.assign(cv, p.cv);
    if (p.slot) msg += " · " + p.slot[2] + " " + L.short(p.iso);
  }
  await gql(L.QUERIES.setCols, { i: String(id), v: JSON.stringify(cv) });
  return { ok: 1, msg };
}

function authed(req) {
  const want = process.env.WRIST_KEY;
  const got = req.headers["x-river-key"];
  if (!want || typeof got !== "string" || got.length !== want.length) return false;
  let diff = 0; for (let i = 0; i < want.length; i++) diff |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return diff === 0;
}

async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!authed(req)) return res.status(401).json({ err: "auth", msg: "Wrong watch key" });
  try {
    if (req.method === "GET") return res.status(200).json(summary(await myEpisodes()));
    if (req.method === "POST") {
      const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
      return res.status(200).json(await moveStage(b.id, b.stage));
    }
    return res.status(405).json({ err: "method", msg: "GET or POST" });
  } catch (e) {
    return res.status(e.status || 500).json({ err: e.code || "error", msg: clip(e.message, 80) });
  }
}

module.exports = handler;
module.exports._test = { summary, moveStage, authed };
