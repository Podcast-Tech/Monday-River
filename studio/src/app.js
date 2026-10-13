
/* ================= River Studio: the strategic floor ================= */
const DEFAULT_CAP = 3;               // units per week an editor can take on AG's work, until AG sets it
const WIN_BACK = 7, WIN_DAYS = 21;   // edit-suite timelines: a week back, two weeks ahead
S.cap = {}; S.bookings = null; S.bkErr = null; S.notifs = S.notifs || [];
let db = null;
const EDIT_STAGES = ["Assigned", "In Process", "In Review", "Corrections"];
const units = it => it.units || 1;
const ini = it => { const w = label(it).split(/[\s\-–(),:]+/).filter(x => /^[A-Za-zÀ-ž]/.test(x)); return ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toUpperCase(); };
const capOf = n => S.cap[firstName(n).toLowerCase()] || DEFAULT_CAP;
const editorFull = n => (EDITORS.find(([e]) => firstName(e).toLowerCase() === firstName(n).toLowerCase()) || [n])[0];

/* ---------- what's in each room ---------- */
function suites() {
  const m = new Map(), at = n => { const k = editorFull(n); if (!m.has(k)) m.set(k, { name: k, edit: [], cr: [], late: 0, u: 0 }); return m.get(k); };
  active().forEach(it => editorsOf(it).forEach(e => { const s = at(e);
    if (EDIT_STAGES.includes(it.stage)) { s.edit.push(it); s.u += units(it); if (isLate(it)) s.late++; }
    else if (it.stage === "Client Review") s.cr.push(it); }));
  return [...m.values()].sort((a, b) => b.u - a.u || b.edit.length - a.edit.length || a.name.localeCompare(b.name));
}
const guests = () => active().filter(i => i.stage === "Queue").map(i => ({ it: i, wait: Math.max(0, T() - dayNum(i.available || (i.created || todayISO()).slice(0, 10))) })).sort((a, b) => b.wait - a.wait);
const screening = () => active().filter(i => i.stage === "Client Review").sort((a, b) => ageDays(b) - ageDays(a));
const workdaysAhead = n => { const out = [], d = new Date(); while (out.length < n) { if (d.getDay() !== 0 && d.getDay() !== 6) out.push(isoOf(d)); d.setDate(d.getDate() + 1); } return out; };
const nextWorkday = iso => { const d = new Date(iso + "T12:00:00"); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return isoOf(d); };
const dayLabel = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

/* ---------- header ---------- */
function renderTop() {
  const a = active(), late = a.filter(isLate).length, today = a.filter(i => daysTo(i) === 0).length;
  const done = S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5).length;
  $("onair").className = "onair" + (a.some(i => i.stage === "In Process") ? " lit" : "");
  $("onair").title = a.filter(i => i.stage === "In Process").length + " episodes being edited right now";
  $("stats").innerHTML = S.items.length ? [["In the building", a.filter(i => FLOW.includes(i.stage)).length, ""], ["Late", late, late ? "bad" : ""], ["Due today", today, ""], ["Done this week", done, ""]]
    .map(([l, n, c]) => `<div class="stat ${c}"><b class="tnum">${n}</b><span>${l}</span></div>`).join("") : "";
  $("sub").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) + " · your episodes";
  const dot = $("sync-dot"), t = $("sync-t"); dot.className = "";
  if (S.error && !S.items.length) { dot.className = "off"; t.textContent = "Not connected"; }
  else if (!S.storedAt) t.textContent = "Syncing";
  else { const stale = Date.now() - S.storedAt > 5 * 60000; dot.className = stale ? "stale" : "on"; t.textContent = (stale ? "Stale, synced " : "Synced ") + new Date(S.storedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
  $("banner").innerHTML = S.error && !S.items.length ? (m => `<div class="banner"><b>${esc(m.title)}</b><span>${esc(m.body)}</span></div>`)(errorCopy(S.error)) : "";
}

/* ---------- green room (Queue) ---------- */
function greenHtml() {
  const g = guests();
  return `<div class="plaque"><b>Green room</b><span>Queue</span><em class="tnum">${g.length}</em></div>
    ${!S.items.length ? `<div class="skel"></div>` : g.length ? `<div class="couch">${g.map(({ it, wait }) => `<button class="guest ${wait >= 2 ? "long" : wait >= 1 ? "wait" : ""}" type="button" draggable="true" data-ep="${esc(it.id)}" title="${esc(it.name)}">
      <span class="av">${esc(ini(it))}</span><span style="min-width:0"><b>${esc(it.name)}</b><small>${wait ? "Waiting " + wait + (wait === 1 ? " day" : " days") : "Arrived today"}${it.units > 1 ? " · " + it.units + " units" : ""}</small></span></button>`).join("")}</div>
      <p class="hint">Drag a guest into an edit suite or onto a console channel to give it to that editor.</p>` : `<p class="empty">Nobody waiting. Every episode has an editor.</p>`}`;
}

/* ---------- edit suites ---------- */
function suitesHtml(only) {
  if (!S.items.length) return `<div class="skel"></div>`;
  const list = (() => { const l = suites(); if (!only) return l; const hit = l.find(s => firstName(s.name).toLowerCase() === firstName(only).toLowerCase()); return [hit || { name: editorFull(only), edit: [], cr: [], late: 0, u: 0 }]; })(), start = T() - WIN_BACK, pct = iso => Math.max(0, Math.min(100, (dayNum(iso) - start) / WIN_DAYS * 100));
  const busy = new Set(list.map(s => firstName(s.name).toLowerCase())), idle = EDITORS.filter(([n]) => !busy.has(firstName(n).toLowerCase()));
  const ticks = [-7, 0, 7, 14].map(k => { const d = new Date(); d.setDate(d.getDate() + k); return { x: (WIN_BACK + k) / WIN_DAYS * 100, l: k === 0 ? "Today" : d.getDate() + " " + MON[d.getMonth()] }; });
  const wk = (() => { const d = new Date(), dow = (d.getDay() + 6) % 7, a = -dow, b = a + 7; return { l: (WIN_BACK + a) / WIN_DAYS * 100, w: 7 / WIN_DAYS * 100 }; })();
  return `<div class="plaque"><b>${only ? "Edit suite" : "Edit suites"}</b><span>Each clip runs from Available to its next deadline. The red line is today.</span><em class="tnum">${list.length} in use</em></div>
    <div class="suites">${list.map((s, k) => {
      const ratio = s.u / capOf(s.name), col = ratio > 1.2 ? "var(--late)" : ratio > .8 ? "var(--today)" : "var(--ok)";
      const rows = s.edit.slice().sort((a, b) => (daysTo(a) ?? 99) - (daysTo(b) ?? 99)), shown = rows.slice(0, 6);
      return `<article class="suite" data-drop="${esc(s.name)}" aria-label="${esc(s.name)}'s suite">
        <div class="s-h"><span class="lamp ${s.edit.some(i => i.stage === "In Process") ? "lit" : ""}">ON AIR</span><span class="no">SUITE ${String(k + 1).padStart(2, "0")}</span><span class="nm">${esc(s.name)}</span>
          <span class="ld" title="${fmtU(s.u)} units in edit against ${capOf(s.name)} a week">${fmtU(s.u)}u / ${capOf(s.name)}<span class="bar"><i style="width:${Math.min(100, ratio * 100).toFixed(0)}%;background:${col}"></i></span></span></div>
        <div class="tl"><div class="tl-days">${ticks.map((t, i) => `<span style="left:${t.x}%;${i === 0 ? "transform:none" : i === ticks.length - 1 ? "transform:translateX(-100%)" : ""}">${t.l}</span>`).join("")}</div>
          <div class="tl-wk" style="left:calc(10px + (100% - 20px) * ${wk.l / 100});width:calc((100% - 20px) * ${wk.w / 100})"></div>
          <div class="tl-grid"></div>
          <div class="ph" style="left:calc(10px + (100% - 20px) * ${WIN_BACK / WIN_DAYS})"></div>
          <div class="tl-rows">${shown.length ? shown.map(it => {
            const a = it.available || (it.created || todayISO()).slice(0, 10), due = nextDue(it) || isoOf(new Date(Date.now() + 864e5));
            let l = pct(a), r = pct(due) + 100 / WIN_DAYS; if (r - l < 9) l = Math.max(0, r - 9);
            const late = isLate(it), today = daysTo(it) === 0;
            return `<div class="clip ${late ? "late" : today ? "today" : ""}"><button type="button" draggable="true" data-ep="${esc(it.id)}" style="left:${l}%;width:${Math.max(9, r - l)}%;--c:${colorOf(it.stage)}" title="${esc(it.name)} · ${esc(it.stage)} · ${esc(rel(it).txt)}">${esc(label(it))}</button></div>`; }).join("")
            : `<p class="empty" style="margin:4px 0">Nothing in edit. ${s.cr.length} with clients.</p>`}</div></div>
        <div class="s-f"><span><b>${s.edit.length}</b> in edit</span>${s.late ? `<span class="late-t"><b>${s.late}</b> late</span>` : ""}<span><b>${s.cr.length}</b> with clients</span>${rows.length > 6 ? `<span>+${rows.length - 6} more not shown</span>` : ""}</div>
      </article>`; }).join("")}</div>
    ${idle.length && !only ? `<div class="corridor"><span>FREE</span>${idle.map(([n]) => `<span class="free" data-drop="${esc(n)}">${esc(n)}</span>`).join("")}</div>` : ""}`;
}

/* ---------- screening room (Client Review) ---------- */
function screeningHtml() {
  const all = screening(), vip = all.filter(i => CORPORATE.test(i.name)), seats = all.filter(i => !CORPORATE.test(i.name));
  const seat = it => { const a = ageDays(it), c = CORPORATE.test(it.name) ? "var(--sea)" : a > 7 ? "var(--late)" : a >= 4 ? "var(--today)" : "var(--ok)";
    return `<button class="seat" type="button" data-ep="${esc(it.id)}" style="--c:${c}" title="${esc(it.name)} · ${a} ${a === 1 ? "day" : "days"} with the client"><b>${esc(ini(it))}</b><small class="tnum">${a}d</small></button>`; };
  const quiet = seats.filter(isLate).length;
  return `<div class="plaque"><b>Screening room</b><span>Client Review</span><em class="tnum">${all.length}</em></div>
    ${!S.items.length ? `<div class="skel"></div>` : `<div class="screen" aria-hidden="true"></div>
    ${seats.length ? `<div class="seats">${seats.map(seat).join("")}</div>` : `<p class="empty">No client is reviewing right now.</p>`}
    <p class="hint">${quiet ? `<span style="color:var(--late)">${quiet} quiet for more than 7 days.</span> ` : ""}Days since the latest deadline. Green under 4, amber 4–7, red after a week.</p>
    ${vip.length ? `<div class="vip"><div class="plaque"><b>VIP row</b><span>Corporate, open-ended review</span><em class="tnum">${vip.length}</em></div><div class="seats">${vip.map(seat).join("")}</div></div>` : ""}`}`;
}

/* ---------- master control: the console ---------- */
function consoleHtml() {
  const list = suites(), seen = new Set(list.map(s => firstName(s.name).toLowerCase()));
  const strips = list.concat(EDITORS.filter(([n]) => !seen.has(firstName(n).toLowerCase())).map(([n]) => ({ name: n, edit: [], cr: [], late: 0, u: 0 })));
  const totalU = list.reduce((a, s) => a + s.u, 0), totalCap = strips.reduce((a, s) => a + capOf(s.name), 0);
  return `<div class="plaque"><b>Master control</b><span>Mixing console: units in edit against what each editor can take from you per week</span><em class="tnum">${fmtU(totalU)} / ${totalCap} units</em></div>
    ${!S.items.length ? `<div class="skel"></div>` : `<div class="console">${strips.map((s, k) => {
      const ratio = s.u / capOf(s.name), top = 100 - Math.min(2, ratio) / 2 * 100, leds = Array.from({ length: 10 }, (_, i) => i < Math.min(10, s.late));
      return `<div class="strip" data-drop="${esc(s.name)}" title="${esc(s.name)}: ${fmtU(s.u)} units in edit, ${s.late} late, ${s.cr.length} with clients">
        <span class="ch">CH ${String(k + 1).padStart(2, "0")}</span>
        <div class="track"><div class="meter" aria-label="${s.late} late">${leds.map(on => `<i class="${on ? "on red" : ""}"></i>`).join("")}</div>
          <div class="rail"><span class="cap" style="top:50%"></span><span class="knob ${ratio > 1 ? "over" : ""}" style="top:${top.toFixed(1)}%"></span></div></div>
        <span class="lv tnum">${fmtU(s.u)}u<small>${ratio ? Math.round(ratio * 100) + "%" : "free"}</small></span>
        <span class="nm">${esc(firstName(s.name))}</span>
        <span class="capin"><button type="button" data-cap="${esc(s.name)}" data-d="-1" aria-label="Less capacity for ${esc(firstName(s.name))}">−</button><span class="tnum" title="Units per week">${capOf(s.name)}/wk</span><button type="button" data-cap="${esc(s.name)}" data-d="1" aria-label="More capacity for ${esc(firstName(s.name))}">+</button></span>
      </div>`; }).join("")}</div>
    <p class="hint">The fader shows load: the line marks 100% of the editor's weekly capacity, and the red meter counts late episodes. Set capacity with − and +. Drop an episode on a channel to give it to that editor.</p>`}`;
}

/* ---------- master control: on-air board + bottlenecks ---------- */
function bookingUnits(b) {
  const s = (b.services + " " + b.addons).toLowerCase(); let u = 0;
  if (/(pro(fessional)?\s*edit|full edit|editing)/.test(s)) u += 1;
  if (/\breels?\b/.test(b.services.toLowerCase()) && !/\(\d+\)/.test(b.services)) u += 1;
  (b.addons.match(/(reel|highlight|clip|short)s?[^()\n]*\((\d+)\)/gi) || []).forEach(m => { const n = +(m.match(/\((\d+)\)/) || [])[1] || 0; u += n / 3; });
  return Math.round(u * 100) / 100;
}
function bookingOwner(b) {
  if (!S.clients) return "new";
  const n = lc(b.customer || b.name), c = S.clients.find(c => { const x = lc(c.name); return x.length > 2 && (x === n || n.includes(x) || x.includes(n)); });
  return c ? (c.mine ? "yours" : "laura") : "new";
}
async function loadBookings() {
  if (!mcp) return;
  const from = todayISO(), to = isoOf(new Date(Date.now() + 16 * 864e5));
  const input = c => ({ calendarId: c, fullText: "Booking", startTime: from + "T00:00:00+04:00", endTime: to + "T23:59:59+04:00", orderBy: "startTime", pageSize: 250, timeZone: "Asia/Dubai" });
  const res = await Promise.all(BOOK_CALS.map(c => mcp.callTool(GCAL, "list_events", input(c), { cache: { staleTime: 600000 } }).then(r => ({ ok: r }), e => ({ err: e }))));
  if (res.every(r => r.err)) { S.bkErr = res[0].err; S.bookings = []; render(); return; }
  await loadClients();
  const seen = new Set(), list = [];
  res.forEach(r => ((r.ok && r.ok.payload && r.ok.payload.events) || []).forEach(ev => {
    if (!/booking/i.test(ev.summary || "") || ev.status === "cancelled" || seen.has(ev.id)) return; seen.add(ev.id);
    const b = toBooking(ev); if (!b.date) return; const k = lc(b.name) + "|" + b.start; if (seen.has(k)) return; seen.add(k);
    b.units = bookingUnits(b); b.owner = bookingOwner(b); b.arrives = nextWorkday(b.date); list.push(b);
  }));
  S.bookings = list.sort((a, b) => String(a.start).localeCompare(String(b.start))); S.bkErr = null; render();
}
function boardHtml() {
  const days = workdaysAhead(10);
  if (!S.items.length) return `<div class="skel"></div>`;
  const capDay = EDITORS.reduce((a, [n]) => a + capOf(n), 0) / 5;
  const due = d => active().filter(i => EDIT_STAGES.includes(i.stage) && nextDue(i) === d).reduce((a, i) => a + units(i), 0);
  const inc = (d, who) => (S.bookings || []).filter(b => b.arrives === d && who.includes(b.owner)).reduce((a, b) => a + b.units, 0);
  const cols = days.map(d => ({ d, due: due(d), yours: inc(d, ["yours"]), nw: inc(d, ["new"]) })).map(c => Object.assign(c, { tot: c.due + c.yours + c.nw, over: c.due + c.yours + c.nw > capDay }));
  const max = Math.max(capDay * 1.25, ...cols.map(c => c.tot), 1), h = v => (v / max * 100).toFixed(1) + "%";
  const over = cols.filter(c => c.over);
  const verdict = S.bookings === null ? `<p class="verdict">Reading the studio calendars…</p>`
    : S.bkErr ? `<p class="verdict bad">${esc(calErr(S.bkErr))} Deadlines still show.</p>`
    : over.length ? `<p class="verdict bad"><b>${over.length} ${over.length === 1 ? "day goes" : "days go"} over capacity.</b> ${over.slice(0, 3).map(c => `${dayLabel(c.d)}: ${fmtU(c.tot)} units landing against ${fmtU(capDay)}`).join("; ")}.</p>`
    : `<p class="verdict ok"><b>Within capacity for the next two working weeks.</b> The busiest day is ${dayLabel(cols.reduce((a, c) => c.tot > a.tot ? c : a).d)}.</p>`;
  const bks = (S.bookings || []).filter(b => b.date >= todayISO());
  return `<div class="board"><div class="plaque"><b>On-air board</b><span>Work landing per working day: deadlines due, plus booked sessions arriving the next working day</span></div>
    <div class="days" role="img" aria-label="Units landing per day against team capacity">${cols.map(c => `<div class="day ${c.over ? "over" : ""}" title="${dayLabel(c.d)}: ${fmtU(c.due)} due, ${fmtU(c.yours)} arriving from your sessions, ${fmtU(c.nw)} from new clients · capacity ${fmtU(capDay)}">
      <span class="capline" style="bottom:${h(capDay)}"></span>${c.nw ? `<i class="b new" style="height:${h(c.nw)}"></i>` : ""}${c.yours ? `<i class="b in" style="height:${h(c.yours)}"></i>` : ""}${c.due ? `<i class="b due" style="height:${h(c.due)}"></i>` : ""}</div>`).join("")}</div>
    <div class="dlabels">${cols.map(c => `<span class="${c.over ? "over" : ""}">${dayLabel(c.d)}</span>`).join("")}</div>
    <div class="legend"><span><i style="background:var(--st-corr)"></i>Deadlines due</span><span><i style="background:var(--water)"></i>Your sessions arriving</span><span><i style="background:repeating-linear-gradient(135deg,var(--foam) 0 3px,#7FB8E6 3px 6px)"></i>New clients arriving</span><span><i style="background:var(--ink);height:2px;vertical-align:3px"></i>Team capacity per day (${fmtU(capDay)})</span></div>
    ${verdict}
    ${bks.length ? `<div class="bks" aria-label="Booked sessions">${bks.map(b => `<div class="bk ${b.owner === "laura" ? "laura" : ""}"><time>${dayLabel(b.date)}</time><span title="${esc(b.services)}${b.addons ? " + " + esc(b.addons.replace(/\n/g, ", ")) : ""}">${esc(b.name)}${b.nc ? " · new" : ""}${b.owner === "laura" ? " · Laura's" : ""} <span style="color:var(--muted)">· ${esc(b.studio)}</span></span><em>${b.units ? "≈" + fmtU(b.units) + "u" : "rec only"}</em></div>`).join("")}</div>
      <p class="hint">Units are estimated from the booked package: a Pro Edit is 1 unit, three reels or highlights are 1 unit. Laura's sessions are listed but not counted.</p>` : S.bookings ? `<p class="empty">No studio bookings in the next two weeks.</p>` : ""}</div>`;
}
function necksHtml() {
  if (!S.items.length) return "";
  const rows = FLOW.map(st => { const g = active().filter(i => i.stage === st), u = g.reduce((a, i) => a + units(i), 0);
    const wait = g.length ? g.reduce((a, i) => a + (st === "Client Review" ? ageDays(i) : Math.max(0, T() - dayNum(i.available || (i.created || todayISO()).slice(0, 10)))), 0) / g.length : 0;
    return { st, n: g.length, u, wait, score: u * Math.max(1, wait) }; });
  const worst = rows.reduce((a, r) => r.score > a.score ? r : a, rows[0]), max = Math.max(1, ...rows.map(r => r.u));
  return `<div class="board" style="margin-top:14px"><div class="plaque"><b>Bottleneck meter</b><span>Units in each stage and how long they've waited on average</span></div>
    <div class="necks">${rows.map(r => `<div class="neck ${r === worst && r.n ? "worst" : ""}"><span>${esc(r.st)}</span><div class="nb"><i style="width:${(r.u / max * 100).toFixed(0)}%;--c:${colorOf(r.st)}"></i></div><em class="tnum">${r.n} · ${r.wait.toFixed(1)}d</em></div>`).join("")}</div>
    ${worst.n ? `<p class="verdict ${worst.wait > 7 ? "bad" : ""}"><b>Most work is held in ${esc(worst.st)}:</b> ${worst.n} episodes, ${fmtU(worst.u)} units, ${worst.wait.toFixed(1)} days on average${worst.st === "Client Review" ? " since the last deadline" : " since Available"}.</p>` : ""}</div>`;
}

/* ---------- render + panel ---------- */
function render() { renderTop(); renderScene(); renderDrawer(); renderPanel(); }
const renderGates = () => {};
/* Clicking a room (or a booth, the console, a wall screen) opens its detail in the drawer. */
S.drawer = null;
function renderDrawer() {
  const el = $("drawer"); el.hidden = !S.drawer; if (!S.drawer) { el.innerHTML = ""; return; }
  const [kind, who] = S.drawer.split(":"), title = { green: "Green room", suite: (who || "") + "'s booth", screening: "Screening room", control: "Control room", board: "On-air board", necks: "Bottleneck meter" }[kind];
  const body = kind === "green" ? greenHtml() : kind === "suite" ? suitesHtml(who) + `<div style="margin-top:14px">${consoleHtml().replace(/^[\s\S]*?<div class="console">/, '<div class="console">').replace(/<p class="hint">[\s\S]*$/, "")}</div>` : kind === "screening" ? screeningHtml() : kind === "control" ? consoleHtml() + boardHtml() + necksHtml() : kind === "board" ? boardHtml() : necksHtml();
  el.innerHTML = `<div class="d-h"><b>${esc(title)}</b><button class="ib" type="button" data-act="drawer-close" aria-label="Close" title="Close (Esc)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="d-b ${kind === "suite" ? "one" : ""}">${body}</div>`;
  if (kind === "suite") el.querySelectorAll(".strip").forEach(n => { if (firstName(n.dataset.drop).toLowerCase() !== firstName(who).toLowerCase()) n.remove(); });
}
function openEp(id) { const it = S.items.find(i => i.id === id); if (!it) return; if (S.sel !== id) { S.draft = ""; S.corr = true; S.mention = true; } S.sel = id; renderPanel(); loadPackage(it); }
function closeEp() { S.sel = null; renderPanel(); }
function sync() { if (!mcp) return; mcp.invalidate(SERVER, "get_board_items_page").catch(() => {}); S.bookings = null; render(); loadBookings(); }

/* ---------- capacity, kept in the artifact's database ---------- */
async function loadCaps() {
  try { db = window.claude && window.claude.use ? await window.claude.use("db") : null; } catch (_) { db = null; }
  if (db) { try { const s = await db.doc("settings/capacity").get(); if (s.exists) S.cap = (s.data() || {}).caps || {}; } catch (_) {} }
  else { try { S.cap = JSON.parse(localStorage.getItem("studio.cap") || "{}"); } catch (_) {} }
  render();
}
let capT;
function bumpCap(name, d) {
  const k = firstName(name).toLowerCase(); S.cap[k] = Math.max(1, Math.min(20, capOf(name) + d)); render();
  clearTimeout(capT); capT = setTimeout(async () => {
    if (db) { try { await db.doc("settings/capacity").set({ caps: S.cap, updatedAt: new Date().toISOString() }); } catch (e) { toast("Couldn't save capacity: " + (e.message || e.code || "try again"), { bad: true }); } }
    else { try { localStorage.setItem("studio.cap", JSON.stringify(S.cap)); } catch (_) {} }
  }, 600);
}

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const cap = e.target.closest("[data-cap]"); if (cap) { bumpCap(cap.dataset.cap, +cap.dataset.d); return; }
  if (e.target.closest("#panel")) {
    const it = S.items.find(i => i.id === S.sel); if (!it) return;
    const st = e.target.closest("[data-stage]"); if (st && !st.disabled) { setStage(it, st.dataset.stage); return; }
    const a = e.target.closest("[data-act]"); if (!a) return;
    if (a.dataset.act === "close") closeEp(); else if (a.dataset.act === "post") postNote(); else if (a.dataset.act === "pkg-retry") loadPackage(it, true);
    return;
  }
  const dc = e.target.closest('[data-act="drawer-close"]'); if (dc) { S.drawer = null; renderDrawer(); return; }
  const ep = e.target.closest("[data-ep]"); if (ep) { openEp(ep.dataset.ep); return; }
  if (e.target.closest("[data-gep]")) return;
  const room = e.target.closest("[data-room]"); if (room) { S.drawer = room.dataset.room; renderDrawer(); }
});
$("scrim").addEventListener("click", closeEp);
$("refresh").addEventListener("click", sync);
document.addEventListener("input", e => { if (e.target.id === "note") S.draft = e.target.value; });
document.addEventListener("change", e => { if (e.target.id === "corr") S.corr = e.target.checked; if (e.target.id === "mention") S.mention = e.target.checked; });
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && S.sel) { e.preventDefault(); closeEp(); }
  else if (e.key === "Escape" && S.drawer) { e.preventDefault(); S.drawer = null; renderDrawer(); }
  if (e.target.id === "note" && (e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); postNote(); }
});
/* Drag an episode (guest or clip) onto a suite, a free editor or a console channel to reassign it. */
let dragId = null;
document.addEventListener("dragstart", e => { const ep = e.target.closest && e.target.closest("[data-ep][draggable]"); if (!ep) return; dragId = ep.dataset.ep; ep.classList.add("dragging"); try { e.dataTransfer.setData("text/plain", dragId); e.dataTransfer.effectAllowed = "move"; } catch (_) {} });
document.addEventListener("dragend", () => { dragId = null; document.querySelectorAll(".dragging,.drop").forEach(n => n.classList.remove("dragging", "drop")); });
document.addEventListener("dragover", e => { const t = e.target.closest && e.target.closest("[data-drop]"); if (!t || !dragId) return; e.preventDefault(); document.querySelectorAll(".drop").forEach(n => n !== t && n.classList.remove("drop")); t.classList.add("drop"); });
document.addEventListener("dragleave", e => { const t = e.target.closest && e.target.closest("[data-drop]"); if (t && !t.contains(e.relatedTarget)) t.classList.remove("drop"); });
document.addEventListener("drop", e => {
  const t = e.target.closest && e.target.closest("[data-drop]"); if (!t) return; e.preventDefault(); t.classList.remove("drop");
  const id = dragId || (e.dataTransfer && e.dataTransfer.getData("text/plain")), it = S.items.find(i => i.id === id); dragId = null;
  if (it) reassign(it, t.dataset.drop);
});

/* ---------- data ---------- */
async function loadMore(cursor, acc, depth) {
  if (!cursor || depth > 3) return acc;
  try {
    const r = await mcp.callTool(SERVER, "get_board_items_page", { boardId: BOARD, includeColumns: true, includeGroup: false, columnIds: COLS, limit: 500, cursor }, { cache: { staleTime: 30000 } });
    const p = r.payload || {}; acc.push(...(p.items || []));
    return loadMore(p.pagination && p.pagination.has_more ? p.pagination.nextCursor : null, acc, depth + 1);
  } catch (e) { return acc; }
}
async function onBoard(ev) {
  if (ev.type === "error") {
    if (["needs_reauth","server_not_connected","selection_required","not_in_manifest","not_granted","blocked_by_policy","approval_required","capability_disabled"].includes(ev.error && ev.error.code)) S.items = [];
    S.error = ev.error; S.loading = false; render(); return;
  }
  const p = ev.result.payload || {}; let raw = p.items || [];
  if (p.pagination && p.pagination.has_more) raw = await loadMore(p.pagination.nextCursor, raw.slice(), 1);
  S.items = raw.map(norm); S.storedAt = ev.result.cache ? ev.result.cache.storedAt : Date.now(); S.error = null;
  render();
}
function onNotifsStudio(ev) {
  if (ev.type === "error") return;
  const p = ev.result.payload || {}; S.notifs = (p.notifications || (p.data && p.data.notifications) || []).map(normNotif).sort((a, b) => b.t - a.t);
  if (S.sel) renderPanel();
}
async function start() {
  setInterval(renderTop, 30000);
  render();
  try { mcp = window.claude && window.claude.use ? await window.claude.use("mcp") : null; } catch (e) { mcp = null; }
  if (!mcp) { S.loading = false; S.error = { code: "no_mcp" }; render(); return; }
  mcp.watchTool(SERVER, "get_board_items_page", INPUT, onBoard, { refetchInterval: 45000, cache: { staleTime: 30000 } });
  mcp.watchTool(SERVER, "all_api_read", { query: NOTIF_Q }, onNotifsStudio, { refetchInterval: 120000, cache: { staleTime: 60000 } });
  loadCaps(); loadBookings();
  setInterval(loadBookings, 15 * 60000);
}
start();
