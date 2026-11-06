
/* ================= River Studio: the strategic floor ================= */
const DEFAULT_CAP = 6;               // units per week an editor can take on AG's work, until AG sets it
const WIN_BACK = 7, WIN_DAYS = 21;   // edit-suite timelines: a week back, two weeks ahead
S.cap = {}; S.bookings = null; S.bkErr = null; S.notifs = S.notifs || [];
let db = null;
const EDIT_STAGES = ["Assigned", "In Process", "In Review", "Corrections"];
const units = it => it.units || 1;
const ini = it => { const w = label(it).split(/[\s\-–(),:]+/).filter(x => /^[A-Za-zÀ-ž]/.test(x)); return ((w[0] || "?")[0] + (w[1] ? w[1][0] : "")).toUpperCase(); };
const capOf = n => S.cap[firstName(n).toLowerCase()] || DEFAULT_CAP;
const editorFull = n => (EDITORS.find(([e]) => firstName(e).toLowerCase() === firstName(n).toLowerCase()) || [n])[0];

/* ---------- what's in each room ---------- */
/* Load is measured by delivery date, not by when work became available: an editor's load is the units of their
   episodes whose next deadline falls within the next LOAD_DAYS working days (overdue ones included, they still have to be delivered).
   Work due later doesn't count against this week's capacity. */
const LOAD_DAYS = 5;
const loadEnd = () => workdaysAhead(LOAD_DAYS).pop();
const loadEndLabel = () => dayLabel(loadEnd());
const inLoad = it => { const d = nextDue(it); return !!d && d <= loadEnd(); };
const loadU = it => inLoad(it) ? units(it) : 0;
function suites() {
  const m = new Map(), at = n => { const k = editorFull(n); if (!m.has(k)) m.set(k, { name: k, edit: [], cr: [], late: 0, u: 0 }); return m.get(k); };
  active().forEach(it => editorsOf(it).forEach(e => { const s = at(e);
    if (EDIT_STAGES.includes(it.stage)) { s.edit.push(it); s.u += loadU(it); s.all = (s.all || 0) + units(it); if (isLate(it)) s.late++; }
    else if (it.stage === "Client Review") s.cr.push(it); }));
  return [...m.values()].sort((a, b) => b.u - a.u || b.edit.length - a.edit.length || a.name.localeCompare(b.name));
}
const guests = () => active().filter(i => i.stage === "Queue").map(i => ({ it: i, wait: Math.max(0, T() - dayNum(i.available || (i.created || todayISO()).slice(0, 10))) })).sort((a, b) => b.wait - a.wait);
const screening = () => active().filter(i => i.stage === "Client Review").sort((a, b) => ageDays(b) - ageDays(a));
const workdaysAhead = n => { const out = [], d = new Date(); while (out.length < n) { if (d.getDay() !== 0 && d.getDay() !== 6) out.push(isoOf(d)); d.setDate(d.getDate() + 1); } return out; };
const nextWorkday = iso => { const d = new Date(iso + "T12:00:00"); do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6); return isoOf(d); };
const dayLabel = iso => new Date(iso + "T12:00:00").toLocaleDateString("en-GB", { weekday: "short", day: "numeric" });

/* ---------- due today + done this week ---------- */
const dueToday = () => active().filter(i => daysTo(i) === 0).sort((a, b) => (isLate(b) - isLate(a)) || label(a).localeCompare(label(b)));
const doneWeek = () => S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5).sort((a, b) => Date.parse(b.updated) - Date.parse(a.updated));
const epRow = (it, right) => `<button class="eprow" type="button" data-ep="${esc(it.id)}" style="--c:${colorOf(it.stage)}"><i></i><span><b>${esc(it.name)}</b><small>${esc(it.stage)}${it.editor ? " · " + esc(it.editor) : ""}${it.units > 1 ? " · " + it.units + " units" : ""}</small></span><em>${right}</em></button>`;
function dueHtml() {
  if (!S.items.length) return `<div class="skel"></div>`;
  const list = dueToday(), late = active().filter(isLate).length;
  return `<div class="plaque"><b>Due today</b><span>Episodes whose next deadline is today</span><em class="tnum">${list.length}</em></div>
    ${list.length ? `<div class="eprows">${list.map(it => epRow(it, esc(rel(it).txt))).join("")}</div>` : `<p class="empty">Nothing is due today.</p>`}
    <p class="hint">${late ? `<span style="color:var(--late)">${late} more already late.</span> ` : ""}Click an episode to open it, change its stage or post a note to the editor.</p>`;
}
function doneHtml() {
  if (!S.items.length) return `<div class="skel"></div>`;
  const list = doneWeek(), byDay = new Map();
  list.forEach(it => { const d = dubaiISO(it.updated); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d).push(it); });
  const u = list.reduce((a, i) => a + units(i), 0);
  return `<div class="plaque"><b>Done this week</b><span>Moved to Done in the last 7 days</span><em class="tnum">${list.length} · ${fmtU(u)}u</em></div>
    ${list.length ? [...byDay.keys()].map(d => `<h4 class="calday">${esc(d === dubaiISO(new Date()) ? "Today" : dayLabel(d))}</h4><div class="eprows">${byDay.get(d).map(it => epRow(it, dubaiTime(it.updated))).join("")}</div>`).join("") : `<p class="empty">Nothing delivered in the last 7 days yet.</p>`}
    <p class="hint">Based on Monday's last-updated time, so a bulk edit can make this look busier than it was.</p>`;
}

/* ---------- header ---------- */
function renderTop() {
  const a = active(), late = a.filter(isLate).length, today = a.filter(i => daysTo(i) === 0).length;
  const done = S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5).length;
  $("onair").className = "onair" + (a.some(i => i.stage === "In Process") ? " lit" : "");
  $("onair").title = a.filter(i => i.stage === "In Process").length + " episodes being edited right now";
  const fl = insights(), flN = fl ? fl.flags.length : 0, flR = fl ? fl.flags.some(f => f.sev === "red") : false;
  $("stats").innerHTML = S.items.length ? [["Flags", flN, flR ? "bad" : flN ? "warn" : ""], ["On now", CALS.filter(c => calNow(c).live).length, ""], ["In post", a.filter(i => FLOW.includes(i.stage)).length, ""], ["Late", late, late ? "bad" : ""], ["Due today", today, ""], ["Done this week", done, ""]].concat(S.growth ? [["Growth plan", Math.round(growthTotals().pct * 100) + "%", growthTotals().late ? "bad" : ""]] : [])
    .map(([l, n, c]) => { const r = { "Flags": "flags", "Due today": "due", "Done this week": "done", "Growth plan": "strategy" }[l]; return r ? `<button class="stat ${c}" type="button" data-room="${r}" title="Show ${l.toLowerCase()}"><b class="tnum">${n}</b><span>${l}</span></button>` : `<div class="stat ${c}"><b class="tnum">${n}</b><span>${l}</span></div>`; }).join("") : "";
  $("sub").textContent = "Poddster Dubai · Al Barsha, Sheikh Zayed Rd · " + new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
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
          <span class="ld" title="${fmtU(s.u)} units due by ${loadEndLabel()} against ${capOf(s.name)} a week (${fmtU(s.all || 0)} in edit in total)">${fmtU(s.u)}u / ${capOf(s.name)}<span class="bar"><i style="width:${Math.min(100, ratio * 100).toFixed(0)}%;background:${col}"></i></span></span></div>
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
  return `<div class="plaque"><b>Master control</b><span>Mixing console: units due by ${loadEndLabel()} (next 5 working days) against what each editor can take from you per week</span><em class="tnum">${fmtU(totalU)} / ${totalCap} units</em></div>
    ${!S.items.length ? `<div class="skel"></div>` : `<div class="console">${strips.map((s, k) => {
      const ratio = s.u / capOf(s.name), top = 100 - Math.min(2, ratio) / 2 * 100, leds = Array.from({ length: 10 }, (_, i) => i < Math.min(10, s.late));
      return `<div class="strip" data-drop="${esc(s.name)}" title="${esc(s.name)}: ${fmtU(s.u)} units due by ${loadEndLabel()} (${fmtU(s.all || 0)} in edit in total), ${s.late} late, ${s.cr.length} with clients">
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
    b.units = bookingUnits(b); b.owner = bookingOwner(b); b.arrives = nextWorkday(b.date); if (b.owner !== "laura") list.push(b); /* Laura's sessions aren't AG's work: left out everywhere */
  }));
  S.bookings = list.sort((a, b) => String(a.start).localeCompare(String(b.start))); S.bkErr = null; render();
}
/* ---------- flags + recommendations: what needs AG, in plain words, with the move to make ---------- */
function edLoads() {
  const m = {}; EDITORS.forEach(([n]) => m[n] = { name: n, u: 0, cap: capOf(n) });
  active().filter(i => EDIT_STAGES.includes(i.stage) && inLoad(i)).forEach(i => editorsOf(i).forEach(e => { const k = editorFull(e); if (m[k]) m[k].u += units(i); }));
  return m;
}
const pickFree = (m, excl, need) => Object.values(m).filter(e => e.name !== excl && e.u + need <= e.cap).sort((a, b) => a.u / a.cap - b.u / b.cap || a.u - b.u)[0] || null;
const epChip = (it, extra) => `<button class="fchip" type="button" data-ep="${esc(it.id)}" style="--c:${colorOf(it.stage)}"><i></i>${esc(label(it))}${extra ? ` <em>${esc(extra)}</em>` : ""}</button>`;
const giveBtn = (it, to) => `<button class="fact" type="button" data-assign="${esc(it.id)}" data-to="${esc(to)}">Give ${esc(label(it))} to ${esc(firstName(to))}</button>`;
const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
function insights() {
  if (!S.items.length) return null;
  const A = active(), m = edLoads(), F = [], sim = JSON.parse(JSON.stringify(m));
  /* 1. late edits */
  const lateEd = A.filter(i => EDIT_STAGES.includes(i.stage) && isLate(i)).map(i => ({ it: i, by: T() - dayNum(nextDue(i)) })).sort((a, b) => b.by - a.by);
  if (lateEd.length) { const byEd = {}; lateEd.forEach(x => { const e = firstName(x.it.editor) || "No editor"; byEd[e] = (byEd[e] || 0) + 1; });
    const top = Object.entries(byEd).sort((a, b) => b[1] - a[1])[0];
    F.push({ sev: "red", title: plural(lateEd.length, "episode") + " late in edit", detail: (top[1] > 1 ? top[0] + " has " + top[1] + ". " : "") + "Most overdue: " + label(lateEd[0].it) + ", " + plural(lateEd[0].by, "day") + ".",
      items: lateEd.slice(0, 6).map(x => epChip(x.it, x.by + "d")), rec: "Open each one and post a note to the editor with a new delivery time today. If " + top[0] + " is stuck, move one of theirs to a free editor." }); }
  /* 2. queue waiting */
  const g = guests();
  if (g.length) { const acts = g.slice(0, 3).map(({ it }) => { const f = pickFree(sim, null, loadU(it)); if (f) sim[f.name].u += loadU(it); return f ? giveBtn(it, f.name) : ""; }).filter(Boolean);
    F.push({ sev: g[0].wait >= 2 ? "red" : "amber", title: plural(g.length, "episode") + " waiting for an editor", detail: "Longest wait: " + label(g[0].it) + (g[0].wait ? ", " + plural(g[0].wait, "day") : ", arrived today") + ".",
      items: g.slice(0, 6).map(({ it, wait }) => epChip(it, wait ? wait + "d" : "new")), rec: acts.length ? "Assign now. These editors have room this week:" : "Nobody has spare capacity. Raise someone's capacity on the console or bring in a freelancer.", acts }); }
  /* 3. overloaded editors: units due in the next 5 working days against weekly capacity */
  Object.values(m).filter(e => e.u > e.cap).sort((a, b) => b.u / b.cap - a.u / a.cap).slice(0, 3).forEach(e => {
    const theirs = A.filter(i => EDIT_STAGES.includes(i.stage) && inLoad(i) && editorsOf(i).some(x => editorFull(x) === e.name)).sort((a, b) => (daysTo(a) ?? 99) - (daysTo(b) ?? 99));
    const mine = theirs.filter(i => i.stage === "Assigned").sort((a, b) => (daysTo(b) ?? -99) - (daysTo(a) ?? -99));
    const mv = mine[0], f = mv ? pickFree(sim, e.name, units(mv)) : null; if (f) { sim[f.name].u += units(mv); sim[e.name].u -= units(mv); }
    F.push({ sev: e.u / e.cap >= 1.5 ? "red" : "amber", title: firstName(e.name) + " has " + fmtU(e.u) + " units due by " + loadEndLabel() + ", capacity " + e.cap, detail: Math.round(e.u / e.cap * 100) + "% of a week's capacity lands on their desk in the next 5 working days.",
      items: theirs.slice(0, 6).map(i => epChip(i, nextDue(i) ? (isLate(i) ? "late" : dayLabel(nextDue(i))) : "")),
      rec: mv && f ? "Move work that hasn't started. " + label(mv) + " is still Assigned (due " + dayLabel(nextDue(mv)) + ") and " + firstName(f.name) + " has room this week." : mv ? "Push back the deadline on " + label(mv) + " (still Assigned), or raise capacity if " + firstName(e.name) + " can take more." : "Everything due is already in progress. Agree new dates now for whatever can slip past " + loadEndLabel() + ".",
      acts: mv && f ? [giveBtn(mv, f.name)] : mv ? [epChip(mv)] : [`<button class="fact ghost" type="button" data-room="suite:${esc(e.name)}">Open ${esc(firstName(e.name))}'s booth</button>`] }); });
  /* 4. due today */
  const dues = dueToday();
  if (dues.length) F.push({ sev: dues.some(isLate) ? "red" : "amber", title: plural(dues.length, "episode") + " due today", detail: dues.map(i => label(i) + " (" + (firstName(i.editor) || "no editor") + ")").slice(0, 3).join(", ") + (dues.length > 3 ? " and " + (dues.length - 3) + " more" : "") + ".",
    items: dues.slice(0, 6).map(i => epChip(i)), rec: "Check in with each editor before midday so nothing slips to tomorrow." });
  /* 5. clients gone quiet */
  const quiet = screening().filter(i => !CORPORATE.test(i.name) && ageDays(i) > 7);
  if (quiet.length) F.push({ sev: "amber", title: plural(quiet.length, "client") + " quiet for more than a week", detail: "Longest: " + label(quiet[0]) + ", " + plural(ageDays(quiet[0]), "day") + " with no reply.",
    items: quiet.slice(0, 6).map(i => epChip(i, ageDays(i) + "d")), rec: "Send a nudge. Open the episode and use WhatsApp or email; the nudge message is already written." });
  /* 6. crunch days ahead */
  const capDay = EDITORS.reduce((a, [n]) => a + capOf(n), 0) / 5, days = workdaysAhead(10);
  const crunch = days.map(d => { const its = A.filter(i => EDIT_STAGES.includes(i.stage) && nextDue(i) === d), bk = (S.bookings || []).filter(b => b.arrives === d);
    return { d, its, bk, u: its.reduce((a, i) => a + units(i), 0) + bk.reduce((a, b) => a + b.units, 0) }; }).filter(c => c.u > capDay);
  if (crunch.length) { const c = crunch[0];
    F.push({ sev: c.d === days[0] ? "red" : "amber", title: (crunch.length === 1 ? dayLabel(c.d) + " is" : plural(crunch.length, "day") + " are") + " over team capacity", detail: dayLabel(c.d) + ": " + fmtU(c.u) + " units landing, the team handles about " + fmtU(capDay) + " a day." + (crunch.length > 1 ? " Also " + crunch.slice(1, 3).map(x => dayLabel(x.d)).join(", ") + "." : ""),
      items: c.its.slice(0, 6).map(i => epChip(i)), rec: "Spread it out: ask for one or two of these a day early, or agree a later date with the client now rather than on the day." }); }
  /* 7. new clients arriving */
  const soon = new Set(days.slice(0, 5)), nw = (S.bookings || []).filter(b => b.owner === "new" && soon.has(b.arrives) && b.units);
  if (nw.length) { const f = pickFree(sim, null, 1);
    F.push({ sev: "amber", title: plural(nw.length, "new client session") + " arriving this week", detail: nw.slice(0, 3).map(b => b.name + " (" + dayLabel(b.date) + ")").join(", ") + ", about " + fmtU(nw.reduce((a, b) => a + b.units, 0)) + " units.",
      items: [], rec: "They aren't in PP Clients Only yet. Set them up and line up an editor before the files land" + (f ? ": " + firstName(f.name) + " has the most room." : "."),
      acts: [`<button class="fact ghost" type="button" data-room="board-sessions">See the sessions</button>`] }); }
  /* on track */
  const tot = Object.values(m).reduce((a, e) => a + e.u, 0), cap = Object.values(m).reduce((a, e) => a + e.cap, 0), free = Object.values(m).filter(e => e.u < e.cap * .5).map(e => firstName(e.name));
  const ok = ["Team load: " + fmtU(tot) + " units due by " + loadEndLabel() + ", against " + cap + " units of weekly capacity (" + Math.round(tot / Math.max(1, cap) * 100) + "%)."];
  if (free.length) ok.push("Room to take more: " + free.slice(0, 5).join(", ") + ".");
  if (!crunch.length) ok.push("No day in the next two weeks goes over capacity.");
  return { flags: F.sort((a, b) => (a.sev === "red" ? 0 : 1) - (b.sev === "red" ? 0 : 1)), ok };
}
function flagsHtml() {
  const r = insights(); if (!r) return `<div class="skel"></div>`;
  const red = r.flags.filter(f => f.sev === "red").length, amb = r.flags.length - red;
  const verdict = !r.flags.length ? `<div class="fv ok"><b>All clear.</b><span>Nothing needs you right now.</span></div>`
    : `<div class="fv ${red ? "bad" : "warn"}"><b>${red ? plural(red, "thing") + " to fix today" : "Nothing urgent"}</b><span>${amb ? plural(amb, "thing") + " to handle this week" : "Everything else is on track"}</span></div>`;
  return verdict + `<div class="flags">${r.flags.map(f => `<article class="flag ${f.sev}"><p class="ft"><span class="fs">${f.sev === "red" ? "Fix today" : "This week"}</span>${esc(f.title)}</p>
      <p class="fd">${esc(f.detail)}</p>${f.items.length ? `<div class="fitems">${f.items.join("")}</div>` : ""}
      <p class="fr"><b>Do this:</b> ${esc(f.rec)}</p>${f.acts && f.acts.length ? `<div class="facts">${f.acts.join("")}</div>` : ""}</article>`).join("")}
    <article class="flag green"><p class="ft"><span class="fs">On track</span>The rest</p>${r.ok.map(x => `<p class="fd">${esc(x)}</p>`).join("")}</article></div>`;
}
/* the control-room wall screen: the same flags, one line each (SVG markup, W × H units) */
function flagsScreen(W, H) {
  const r = insights();
  let g = `<rect width="${W}" height="${H}" fill="#07101A"/>` + TX(.3, .6, .42, "FLAGS", "#EEF3FA", 'font-weight="700" letter-spacing=".1"');
  if (!r) return g + TX(.3, 1.6, .36, "Reading the board…", "#6F7C92");
  const red = r.flags.filter(f => f.sev === "red").length;
  g += TX(W - .3, .6, .34, r.flags.length ? (red ? red + " to fix today" : "nothing urgent") : "all clear", red ? "#FF6B82" : r.flags.length ? "#F6C94A" : "#3EDC97", 'font-weight="700" text-anchor="end"');
  if (!r.flags.length) return g + TX(.3, 1.8, .5, "Nothing needs you right now", "#3EDC97", 'font-weight="600"');
  r.flags.slice(0, 6).forEach((f, i) => { const y = 1.45 + i * .64, c = f.sev === "red" ? "#FF4D6A" : "#F6C94A";
    g += `<rect x=".3" y="${y - .4}" width=".16" height=".5" rx=".04" fill="${c}"/>` + TX(.65, y, .38, clip(f.title, Math.floor((W - 1) / .21)), "#EEF3FA", 'font-weight="600"'); });
  if (r.flags.length > 6) g += TM(.3, H - .2, .28, "+" + (r.flags.length - 6) + " more · click for actions", "#7FA9D1");
  return g;
}
function boardHtml() {
  if (S.bookings === null) return `<div class="skel"></div>`;
  if (S.bkErr) return `<p class="verdict bad">${esc(calErr(S.bkErr))}</p>`;
  const bks = (S.bookings || []).filter(b => b.date >= todayISO()), tag = b => b.owner === "new" ? `<span class="ntag">New client</span>` : "";
  return `<div class="plaque"><b>Booked sessions</b><span>Next two weeks, from production@ and studio@. Each lands as edit work the next working day.</span><em class="tnum">${bks.length}</em></div>
    ${bks.length ? `<div class="bks" id="sessions" aria-label="Booked sessions">${bks.map(b => `<div class="bk"><time>${dayLabel(b.date)}</time><span title="${esc(b.services)}">${esc(b.name)} ${tag(b)}<span style="color:var(--muted)"> · ${esc(b.studio)}</span></span><em>${b.units ? "≈" + fmtU(b.units) + " units" : "recording only"}</em></div>`).join("")}</div>
      <p class="hint">Units are estimated from the package: a Pro Edit is 1 unit, three reels or highlights are 1 unit.</p>` : `<p class="empty">No sessions booked in the next two weeks.</p>`}`;
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

/* ---------- strategy: the Professional Growth board (review actions + dated milestones) ---------- */
const GROWTH_BOARD = 18437788074, GROWTH_SUB = 18437788099, GROWTH_URL = "https://poddsterstudios-team.monday.com/boards/" + GROWTH_BOARD;
const GROWTH_Q = `query { boards(ids:[${GROWTH_BOARD}]) { groups { id title position } items_page(limit:200) { items { id name group { id } column_values(ids:["gstatus","due","goal","metric"]) { id text } subitems { id name column_values(ids:["status","date0"]) { id text } } } } } }`;
const G_ST = [["Not started","#8693A8"],["In progress","#F6B64A"],["Blocked","#FF4D6A"],["Done","#3EDC97"]];
const gColor = st => (G_ST.find(x => x[0] === st) || [0, "#8693A8"])[1];
S.growth = null; S.growthErr = null; S.gOpen = new Set();
const cvText = (it, id) => ((it.column_values || []).find(c => c.id === id) || {}).text || "";
const msDone = s => /^done$/i.test(s.status);
function onGrowth(ev) {
  if (ev.type === "error") { S.growthErr = ev.error; render(); return; }
  const p = ev.result.payload || {}, b = ((p.boards || (p.data && p.data.boards)) || [])[0];
  if (!b) { S.growthErr = { message: "Couldn't find the Professional Growth board." }; render(); return; }
  const groups = (b.groups || []).slice().sort((x, y) => (+x.position || 0) - (+y.position || 0));
  const items = ((b.items_page && b.items_page.items) || []).map(it => ({
    id: String(it.id), name: it.name, group: it.group && it.group.id, status: cvText(it, "gstatus") || "Not started", due: isoDate(cvText(it, "due")),
    goals: cvText(it, "goal").split(",").map(x => x.trim()).filter(Boolean), metric: cvText(it, "metric"),
    subs: (it.subitems || []).map(x => ({ id: String(x.id), name: x.name, status: cvText(x, "status"), date: isoDate(cvText(x, "date0")) })).sort((a, c) => (a.date || "9") < (c.date || "9") ? -1 : 1) }));
  S.growth = { groups, items }; S.growthErr = null; render();
}
function growthTotals() {
  const g = S.growth; if (!g) return null;
  const subs = g.items.flatMap(it => it.subs.map(x => ({ ...x, item: it }))), open = subs.filter(x => !msDone(x));
  return { total: subs.length, done: subs.length - open.length, pct: subs.length ? (subs.length - open.length) / subs.length : 0,
    late: open.filter(x => x.date && dayNum(x.date) < T()).length, next: open.filter(x => x.date).sort((a, b) => a.date < b.date ? -1 : 1)[0] || null };
}
function gRing(pct, size, w) {
  const r = 15, c = 2 * Math.PI * r;
  return `<svg width="${size}" height="${size}" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="${r}" fill="none" stroke="rgb(160 200 255 / .18)" stroke-width="${w}"/><circle cx="18" cy="18" r="${r}" fill="none" stroke="#9C8CFF" stroke-width="${w}" stroke-linecap="round" stroke-dasharray="${(pct * c).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/><text x="18" y="21.5" text-anchor="middle" fill="#EEF3FA" style="font:600 9.5px Geist,sans-serif">${Math.round(pct * 100)}%</text></svg>`;
}
function gDue(iso, done) {
  if (!iso) return { cls: "", txt: "No date" };
  if (done) return { cls: "", txt: short(iso) };
  const d = dayNum(iso) - T();
  return d < 0 ? { cls: "late", txt: short(iso) + " · " + (-d) + "d late" } : d === 0 ? { cls: "soon", txt: "Today" } : { cls: d <= 7 ? "soon" : "", txt: short(iso) + " · " + d + "d" };
}
function gCard(it) {
  const done = it.subs.filter(msDone).length, n = it.subs.length, pct = n ? done / n : (it.status === "Done" ? 1 : 0), d = gDue(it.due, it.status === "Done"), open = S.gOpen.has(it.id);
  return `<article class="sg ${d.cls === "late" ? "late" : ""}">
    <button class="sg-h" type="button" data-sgo="${esc(it.id)}" aria-expanded="${open}"><b>${esc(it.name)}</b><span class="due ${d.cls}">${esc(d.txt)}</span>
      <span class="sg-meta"><span class="spill" style="--c:${gColor(it.status)}"><i></i>${esc(it.status)}</span>${it.goals.map(x => `<span class="gchip">${esc(x)}</span>`).join("")}</span>
      <span class="sbar"><span><i style="width:${(pct * 100).toFixed(0)}%"></i></span><em>${n ? done + "/" + n : Math.round(pct * 100) + "%"}</em></span></button>
    ${open ? `<div class="sg-b">${it.metric ? `<p class="metric"><small>Success looks like</small>${esc(it.metric)}</p>` : ""}
      <div class="sg-st">${G_ST.map(([st, c]) => `<button class="mv" type="button" data-sgs="${esc(it.id)}" data-v="${esc(st)}" style="--c:${c}" ${st === it.status || S.busy ? "disabled" : ""}><i></i>${esc(st)}</button>`).join("")}</div>
      ${n ? `<div class="ms">${it.subs.map(x => { const sd = gDue(x.date, msDone(x)); return `<label class="${msDone(x) ? "done" : ""}"><input type="checkbox" data-ms="${esc(x.id)}" data-it="${esc(it.id)}" ${msDone(x) ? "checked" : ""} ${S.busy ? "disabled" : ""}><span>${esc(x.name)}</span><em class="${sd.cls}">${esc(sd.txt)}</em></label>`; }).join("")}</div>` : ""}</div>` : ""}
  </article>`;
}
function strategyHtml() {
  const head = `<div class="plaque"><b>Professional Growth</b><span>Actions from your growth review, with dated milestones</span><em><a href="${GROWTH_URL}" target="_blank" rel="noopener" style="color:var(--foam);text-decoration:none">Open in Monday</a></em></div>`;
  if (!S.growth) return head + (S.growthErr ? (m => `<div class="banner"><b>${esc(m.title)}</b><span>${esc(m.body)}</span></div>`)(errorCopy(S.growthErr)) : `<div class="skel"></div>`);
  const t = growthTotals(), g = S.growth, nx = t.next ? gDue(t.next.date) : null;
  const hero = `<div class="sg-hero">${gRing(t.pct, 64, 4.5)}<div><b>${t.done} of ${t.total} milestones done</b>
      <p>${g.items.filter(i => i.status === "Done").length} of ${g.items.length} actions complete${t.late ? `, <span class="late">${t.late} milestone${t.late === 1 ? "" : "s"} overdue</span>` : ""}</p>
      ${t.next ? `<p class="next">Next: <b style="display:inline;font-size:13px">${esc(t.next.name)}</b> <span class="${nx.cls}">${esc(nx.txt)}</span></p>` : ""}</div></div>`;
  return head + hero + g.groups.map(gr => { const items = g.items.filter(i => i.group === gr.id); if (!items.length) return "";
    return `<section class="sg-group"><h4 class="calday">${esc(gr.title.replace(/^[^·]*·\s*/, ""))} · ${items.length}</h4><div class="sg-list">${items.map(gCard).join("")}</div></section>`; }).join("")
    + `<p class="hint">Synced from Monday every 2 minutes. Ticks and status changes write straight back to the board.</p>`;
}
async function setGrowthStatus(it, v, isUndo) {
  if (!mcp || S.busy || it.status === v) return;
  const prev = it.status; it.status = v; S.busy = true; render();
  try {
    await mcp.callTool(SERVER, "change_item_column_values", { boardId: GROWTH_BOARD, itemId: Number(it.id), columnValues: JSON.stringify({ gstatus: { label: v } }) }, { cache: false });
    toast(isUndo ? "Back to " + v : it.name.replace(/^[A-Z]\d\s*·\s*/, "") + " is " + v, isUndo ? {} : { undo: () => setGrowthStatus(it, prev, true) });
    mcp.invalidate(SERVER, "all_api_read").catch(() => {});
  } catch (e) { it.status = prev; toast(writeErr(e), { bad: true }); }
  finally { S.busy = false; render(); }
}
async function toggleMilestone(itId, msId, checked) {
  const it = S.growth && S.growth.items.find(x => x.id === itId), m = it && it.subs.find(x => x.id === msId);
  if (!m || !mcp || S.busy) return;
  const prev = m.status, v = checked ? "Done" : "Working on it"; m.status = v; S.busy = true; render();
  try {
    await mcp.callTool(SERVER, "change_item_column_values", { boardId: GROWTH_SUB, itemId: Number(m.id), columnValues: JSON.stringify({ status: { label: v } }) }, { cache: false });
    const left = it.subs.filter(x => !msDone(x)).length;
    toast(checked ? (left ? "Milestone done. " + left + " to go on " + it.name.replace(/^[A-Z]\d\s*·\s*/, "") : "Every milestone done. Mark the action Done?") : "Milestone reopened",
      checked && !left && it.status !== "Done" ? { act: { label: "Mark Done", fn: () => setGrowthStatus(it, "Done") } } : {});
    mcp.invalidate(SERVER, "all_api_read").catch(() => {});
  } catch (e) { m.status = prev; toast(writeErr(e), { bad: true }); }
  finally { S.busy = false; render(); }
}
document.addEventListener("click", e => {
  const o = e.target.closest("[data-sgo]"); if (o) { e.stopImmediatePropagation(); const id = o.dataset.sgo; S.gOpen.has(id) ? S.gOpen.delete(id) : S.gOpen.add(id); renderDrawer(); return; }
  const st = e.target.closest("[data-sgs]"); if (st) { e.stopImmediatePropagation(); if (st.disabled) return; const it = S.growth && S.growth.items.find(x => x.id === st.dataset.sgs); if (it) setGrowthStatus(it, st.dataset.v); }
}, true);
document.addEventListener("change", e => { const c = e.target.closest && e.target.closest("[data-ms]"); if (c) toggleMilestone(c.dataset.it, c.dataset.ms, c.checked); });


/* the strategy wall screen in the control room (SVG markup, 11 × 5.2 units before the .8 scale) */
function strategyScreen() {
  const gt = growthTotals(), acts = S.growth ? S.growth.items.slice(0, 7) : [], pct = gt ? gt.pct : 0, C2 = 2 * Math.PI * 1.05;
  let g = `<rect x="0" y="0" width="11" height="5.2" fill="#100C1E"/>` + TX(.3, .55, .38, "STRATEGY · GROWTH PLAN", "#C9C0FF", 'font-weight="600" letter-spacing=".04"')
    + TX(10.7, .55, .32, gt ? (gt.late ? gt.late + " overdue" : "on track") : "", gt && gt.late ? "#FF6B82" : "#3EDC97", 'font-weight="600" text-anchor="end"');
  if (!S.growth) return g + TX(.3, 1.6, .38, S.growthErr ? "Couldn't read the board" : "Reading Monday…", "#6F7C92");
  g += `<circle cx="1.55" cy="2.35" r="1.05" fill="none" stroke="#2A2545" stroke-width=".26"/><circle cx="1.55" cy="2.35" r="1.05" fill="none" stroke="#9C8CFF" stroke-width=".26" stroke-dasharray="${(pct * C2).toFixed(2)} ${C2.toFixed(2)}" transform="rotate(-90 1.55 2.35)"/>`
    + TX(1.55, 2.5, .44, Math.round(pct * 100) + "%", "#EEF3FA", 'font-weight="700" text-anchor="middle"')
    + TX(.35, 3.85, .3, gt.done + "/" + gt.total + " milestones", "#C9D3E2", 'font-weight="600"')
    + (gt.next ? TX(.35, 4.35, .26, "Next " + short(gt.next.date), "#8C84C8") + TX(.35, 4.75, .24, clip(gt.next.name, 18), "#C9C0FF") : "");
  acts.forEach((a, i) => { const n = a.subs.length, d = a.subs.filter(msDone).length, f = n ? d / n : (a.status === "Done" ? 1 : 0), y = 1.2 + i * .56, dd = gDue(a.due, a.status === "Done");
    g += `<circle cx="3.45" cy="${y - .1}" r=".09" fill="${gColor(a.status)}"/>` + TX(3.65, y, .27, clip(a.name, 28), "#EEF3FA", 'font-weight="600"')
      + `<rect x="8.3" y="${y - .2}" width="1.4" height=".14" rx=".07" fill="#2A2545"/><rect x="8.3" y="${y - .2}" width="${(1.4 * f).toFixed(2)}" height=".14" rx=".07" fill="#9C8CFF"/>`
      + TX(10.7, y, .22, dd.cls === "late" ? "late" : short(a.due), dd.cls === "late" ? "#FF6B82" : "#8C95A8", 'text-anchor="end"'); });
  return g;
}
/* ---------- render + panel ---------- */
function render() { renderTop(); renderScene(); renderDrawer(); renderPanel(); }
const renderGates = () => {};
/* Clicking a room (or a booth, the console, a wall screen) opens its detail in the drawer. */
S.drawer = null;
function renderDrawer() {
  const el = $("drawer"); el.hidden = !S.drawer; if (!S.drawer) { el.innerHTML = ""; return; }
  const [kind, who] = S.drawer.split(":"), title = { green: "Green room", suite: (who || "") + "'s booth", screening: "Screening room", control: "Control room", board: "Flags & what to do", flags: "Flags & what to do", "board-sessions": "Booked sessions", necks: "Bottleneck meter", due: "Due today", done: "Done this week", cal: (who || "") + " calendar", strategy: "Strategy" }[kind];
  const body = kind === "green" ? greenHtml() : kind === "suite" ? suitesHtml(who) + `<div style="margin-top:14px">${consoleHtml().replace(/^[\s\S]*?<div class="console">/, '<div class="console">').replace(/<p class="hint">[\s\S]*$/, "")}</div>` : kind === "screening" ? screeningHtml() : kind === "control" ? flagsHtml() + `<div style="margin-top:16px">${consoleHtml()}</div>` : kind === "board" || kind === "flags" ? flagsHtml() : kind === "board-sessions" ? boardHtml() : kind === "cal" ? calHtml(who) : kind === "due" ? dueHtml() : kind === "done" ? doneHtml() : kind === "strategy" ? strategyHtml() : necksHtml();
  el.innerHTML = `<div class="d-h"><b>${esc(title)}</b><button class="ib" type="button" data-act="drawer-close" aria-label="Close" title="Close (Esc)"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg></button></div><div class="d-b ${kind === "suite" ? "one" : ""}">${body}</div>`;
  if (kind === "suite") el.querySelectorAll(".strip").forEach(n => { if (firstName(n.dataset.drop).toLowerCase() !== firstName(who).toLowerCase()) n.remove(); });
}
function openEp(id) { const it = S.items.find(i => i.id === id); if (!it) return; if (S.sel !== id) { S.draft = ""; S.corr = true; S.mention = true; } S.sel = id; renderPanel(); loadPackage(it); }
function closeEp() { S.sel = null; renderPanel(); }
function sync() { if (!mcp) return; mcp.invalidate(SERVER, "get_board_items_page").catch(() => {}); S.bookings = null; render(); loadBookings(); loadCals(); }

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
  const as = e.target.closest("[data-assign]"); if (as) { const it = S.items.find(i => i.id === as.dataset.assign); if (it) reassign(it, as.dataset.to); return; }
  const dc = e.target.closest('[data-act="drawer-close"]'); if (dc) { S.drawer = null; renderDrawer(); return; }
  const ep = e.target.closest("[data-ep]"); if (ep) { openEp(ep.dataset.ep); return; }
  if (e.target.closest("[data-gep]")) return;
  const room = e.target.closest("[data-room]"); if (room) { S.drawer = room.dataset.room; renderDrawer(); if (room.closest(".stats") && window.R3D && R3D.on) { if (/^(due|done)$/.test(room.dataset.room)) R3D.view(6); else if (room.dataset.room === "flags") R3D.view(5); } }
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
  mcp.watchTool(SERVER, "all_api_read", { query: GROWTH_Q }, onGrowth, { refetchInterval: 120000, cache: { staleTime: 60000 } });
  loadCaps(); loadBookings(); loadCals();
  setInterval(loadBookings, 15 * 60000); setInterval(loadCals, 5 * 60000);
}
start();
