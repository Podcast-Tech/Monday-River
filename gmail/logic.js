// Pure logic shared by the Gmail panel and the tests: reading the open email, matching it to Monday, and River's business rules.
(function (root) {
  const EPISODE_BOARD = "2472462203", CLIENTS_BOARD = "18330033684", ME_ID = "49670201";
  const COLS = ["status","person","people","date","date4","date_mkx87nb3","dup__of_1st_cut_deadline","date_mm02j5tr","board_relation_mkxb8cpz","link_mm22fna1","link_mkxbtnjf","link_mkxbm8as","numeric_mm1y5e6b"];
  const STAGES = ["Queue","Assigned","In Process","In Review","Corrections","Client Review","Done"];
  const MOVE_TO = ["Assigned","In Process","In Review","Corrections","Client Review","Done"];
  const COLOR = { "Queue": "#8693A8", "Assigned": "#C9D3E2", "In Process": "#F6C94A", "In Review": "#5EB2FF", "Corrections": "#FF8F45", "Client Review": "#3EDC97", "Done": "#9C8CFF" };
  const CLOSED = new Set(["Done","Cancelled","No Client Response","Paid"]);
  const IN_EDIT = new Set(["Queue","Assigned","In Process","In Review","Corrections"]);
  const CORPORATE = /dmitrii|suvo|enbd/i;
  const DATE_COLS = [["available","date","Available"],["draft","date4","Draft"],["v1","date_mkx87nb3","V1"],["final","dup__of_1st_cut_deadline","Final"],["publishing","date_mm02j5tr","Publishing"]];
  const EDITORS = [["Igor Garčev","43400381"],["Motasem Jammal","107518052"],["Stipe Majić","61381904"],["Georges Saliba","36795459"],["Stefan Mikić","38981225"],["Akssat","88817643"],["Mahmoud","107176166"],["Glody Kikonga","60723690"],["Shrijit Chowdhury","101677796"],["Bashar M. Najjar","103717656"],["Ajin","71556126"]];
  const PEOPLE = new Map([[ME_ID, "You"], ["106221824", "Roy"], ...EDITORS.map(([n, id]) => [id, n])]);
  /* Addresses that are never the client: our own domain and the tools that email on our behalf. */
  const SKIP_DOMAINS = /(@|\.)(poddster\.com|frame\.io|monday\.com|google\.com|googlemail\.com|dropbox\.com|dropboxmail\.com|calendly\.com|zoom\.us|wetransfer\.com|notion\.so|slack\.com|squarespace\.com|stripe\.com|paypal\.com)$/i;
  const SKIP_LOCAL = /^(no-?reply|notifications?|mailer-daemon|calendar-notification|support|hello@poddster)/i;

  const MON = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const isoOf = d => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  const todayISO = () => isoOf(new Date());
  const dayNum = iso => Math.round(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) / 864e5);
  const short = iso => iso ? (+iso.slice(8, 10)) + " " + MON[+iso.slice(5, 7) - 1] : "Not set";
  function addWorkdays(n, from) { const d = from ? new Date(from) : new Date(); while (n > 0) { d.setDate(d.getDate() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) n--; } return isoOf(d); }
  const firstName = n => ((n || "").split(", ")[0] || "").split(" ")[0];
  const editorId = n => { const f = firstName(n).toLowerCase(); const e = EDITORS.find(([nm]) => firstName(nm).toLowerCase() === f); return e ? e[1] : null; };
  const stripPrefix = n => String(n || "").replace(/^(AG|BL)\s*-\s*/i, "").trim();
  const isoDate = v => /^\d{4}-\d{2}-\d{2}/.test(v || "") ? v.slice(0, 10) : null;
  const lastUrl = v => { const m = String(v || "").match(/https?:\/\/[^\s]+/g); return m ? m[m.length - 1] : null; };

  /* One Monday item → the shape the panel uses. */
  function normEpisode(raw) {
    const c = {}; (raw.column_values || []).forEach(v => c[v.id] = v);
    const t = id => (c[id] && c[id].text) || "";
    const rel = c.board_relation_mkxb8cpz || {};
    const clientRaw = rel.display_value || "";
    return { id: String(raw.id), name: raw.name || "Untitled", url: raw.url || ("https://poddsterstudios-team.monday.com/boards/" + EPISODE_BOARD + "/pulses/" + raw.id),
      created: raw.created_at, updated: raw.updated_at, group: raw.group ? raw.group.title : "",
      stage: t("status") || "No status", editor: t("person"), producer: t("people"),
      available: isoDate(t("date")), draft: isoDate(t("date4")), v1: isoDate(t("date_mkx87nb3")), final: isoDate(t("dup__of_1st_cut_deadline")), publishing: isoDate(t("date_mm02j5tr")),
      client: stripPrefix(clientRaw.split(",")[0]), clientRaw, clientIds: (rel.linked_item_ids || []).map(String), laura: /^BL\s*-/i.test(clientRaw),
      upload: lastUrl(t("link_mm22fna1")), share: lastUrl(t("link_mkxbtnjf")), dropbox: lastUrl(t("link_mkxbm8as")), units: parseFloat(t("numeric_mm1y5e6b")) || 0,
      updates: (raw.updates || []).map(u => ({ id: String(u.id), body: u.text_body || "", at: u.created_at, by: String(u.creator_id || "") })) };
  }
  function nextDue(it) {
    if (!IN_EDIT.has(it.stage)) return null;
    if (it.stage === "Corrections") return [it.v1, it.final].filter(Boolean).sort().pop() || it.draft;
    return it.draft;
  }
  const daysTo = it => { const d = nextDue(it); return d ? dayNum(d) - dayNum(todayISO()) : null; };
  function ageDays(it) { const last = [it.draft, it.v1, it.final].filter(Boolean).sort().pop() || (it.updated || "").slice(0, 10); return last ? dayNum(todayISO()) - dayNum(last) : 0; }
  const isLate = it => it.stage === "Client Review" ? (!CORPORATE.test(it.name) && ageDays(it) > 7) : (daysTo(it) !== null && daysTo(it) < 0);
  function rel(it) {
    if (CLOSED.has(it.stage)) return { cls: "", txt: it.stage === "Done" ? "Finished" : it.stage };
    if (it.stage === "Client Review") { const a = ageDays(it); return { cls: a > 7 && !CORPORATE.test(it.name) ? "late" : "", txt: a + (a === 1 ? " day" : " days") + " with the client" }; }
    const d = daysTo(it); if (d === null) return { cls: "", txt: "No deadline" };
    if (d < 0) return { cls: "late", txt: (-d) + (d === -1 ? " day late" : " days late") };
    if (d === 0) return { cls: "today", txt: "Due today" };
    return { cls: "", txt: d === 1 ? "Due tomorrow" : "Due in " + d + " days" };
  }
  /* Corrections rule: fill the next empty deadline (Available → Draft → V1 → Final → Publishing) with today + 2 working days, in the same write. */
  function correctionsPatch(it) { const slot = DATE_COLS.find(([k]) => !it[k]); if (!slot) return { cv: {}, slot: null }; const iso = addWorkdays(2); return { cv: { [slot[1]]: { date: iso } }, slot, iso }; }

  /* What the open email tells us: external addresses and names, plus episode names quoted in the subject or body (Frame.io and Monday mails). */
  const EP_RE = /([A-Z][\p{L}'’.&-]+(?:\s+[A-Z][\p{L}'’.&-]+){0,4})\s*[-–]\s*Session\s+(\d{2}\.\d{2}\.\d{2})/gu;
  function readEmail(thread) {
    const people = [], seen = new Set();
    (thread.people || []).forEach(p => {
      const email = String(p.email || "").toLowerCase().trim(); if (!email || seen.has(email)) return; seen.add(email);
      const ext = !SKIP_DOMAINS.test(email) && !SKIP_LOCAL.test(email);
      people.push({ email, name: String(p.name || "").replace(/["']/g, "").trim(), ext });
    });
    const text = (thread.subject || "") + "\n" + (thread.text || "");
    const episodes = []; let m; EP_RE.lastIndex = 0;
    while ((m = EP_RE.exec(text)) && episodes.length < 4) { const nm = m[1].replace(/^(Re|Fwd?|Fw)\s*:?\s*/i, "").trim(); const key = nm + " - Session " + m[2]; if (!episodes.includes(key)) episodes.push(key); }
    return { subject: thread.subject || "", external: people.filter(p => p.ext), people, episodes };
  }
  const nameLike = n => n && !/@/.test(n) && n.split(/\s+/).length <= 5 && /[a-z]/i.test(n);
  /* The searches to run against the episode board, best first. */
  function searchTerms(info, clients) {
    const terms = [];
    info.episodes.forEach(e => terms.push({ q: e, why: "named in the email" }));
    clients.forEach(c => terms.push({ q: stripPrefix(c.name), why: "client " + c.email, clientId: c.id }));
    if (!clients.length) info.external.forEach(p => { if (nameLike(p.name)) terms.push({ q: p.name, why: "sender name " + p.name }); });
    const seen = new Set(); return terms.filter(t => { const k = t.q.toLowerCase(); if (seen.has(k) || t.q.length < 3) return false; seen.add(k); return true; }).slice(0, 4);
  }
  /* Best match first: linked to the email's client, then named in the email, then open before finished, then newest. */
  function rank(eps, clients, info) {
    const ids = new Set(clients.map(c => c.id)), named = info.episodes.map(e => e.toLowerCase());
    const score = e => (e.clientIds.some(i => ids.has(i)) ? 100 : 0) + (named.some(n => e.name.toLowerCase().startsWith(n)) ? 60 : 0) + (CLOSED.has(e.stage) ? 0 : 30) + (e.producer.includes("Abdullah") ? 5 : 0);
    return eps.slice().sort((a, b) => score(b) - score(a) || String(b.created || "").localeCompare(String(a.created || "")));
  }
  function ago(iso) { const s = (Date.now() - Date.parse(iso)) / 1000; if (!isFinite(s)) return ""; if (s < 60) return "now"; if (s < 3600) return Math.round(s / 60) + "m"; if (s < 86400) return Math.round(s / 3600) + "h"; const d = new Date(iso); return s < 7 * 86400 ? d.toLocaleDateString("en-GB", { weekday: "short" }) : d.getDate() + " " + MON[d.getMonth()]; }

  const QUERIES = {
    clients: `query ($v: [String]!) { items_page_by_column_values(board_id: ${CLIENTS_BOARD}, limit: 10, columns: [{column_id: "text_mkxbach4", column_values: $v}]) { items { id name column_values(ids: ["text_mkxbach4","text_mkxb379a","person"]) { id text } } } }`,
    episodes: `query ($q: CompareValue!) { boards(ids: [${EPISODE_BOARD}]) { items_page(limit: 12, query_params: {rules: [{column_id: "name", compare_value: $q, operator: contains_text}], order_by: [{column_id: "__creation_log__", direction: desc}]}) { items { id name url created_at updated_at group { title } column_values(ids: ${JSON.stringify(COLS)}) { id text ... on BoardRelationValue { linked_item_ids display_value } } updates(limit: 4) { id text_body created_at creator_id } } } } }`,
    users: `query ($ids: [ID!]) { users(ids: $ids) { id name } }`,
    setCols: `mutation ($i: ID!, $v: JSON!) { change_multiple_column_values(board_id: ${EPISODE_BOARD}, item_id: $i, column_values: $v) { id } }`,
    note: `mutation ($i: ID!, $b: String!, $m: [UpdateMention]) { create_update(item_id: $i, body: $b, mentions_list: $m) { id } }`,
    me: `query { me { id name email } }`
  };

  const api = { EPISODE_BOARD, CLIENTS_BOARD, ME_ID, COLS, STAGES, MOVE_TO, COLOR, CLOSED, IN_EDIT, CORPORATE, DATE_COLS, EDITORS, PEOPLE, SKIP_DOMAINS,
    isoOf, todayISO, dayNum, short, addWorkdays, firstName, editorId, stripPrefix, normEpisode, nextDue, daysTo, ageDays, isLate, rel, correctionsPatch,
    readEmail, searchTerms, rank, ago, QUERIES };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.RiverLogic = api;
})(typeof self !== "undefined" ? self : this);
