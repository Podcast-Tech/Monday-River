
/* ================= River Pocket: the phone view ================= */
S.sheet = null; S.filter = "focus"; S.stage = null; S.ups = {}; S.justOpened = false; S.inboxFilter = "all";
const ACTIVE = () => S.items.filter(i => !CLOSED.has(i.stage));
function urgency(e) {
  if (CLOSED.has(e.stage)) return 1e6 - dayNum((e.updated || "2000-01-01").slice(0, 10));
  const late = isLate(e), d = daysTo(e);
  if (e.stage === "Client Review") return late ? -500 - ageDays(e) : 300 - ageDays(e);
  if (late) return -1000 + (d || 0);
  return d === null ? 200 : d;
}
const words = () => S.q.toLowerCase().split(/\s+/).filter(Boolean);
const hay = e => (e.name + " " + e.client + " " + e.editor + " " + e.stage + (isLate(e) ? " late overdue" : "")).toLowerCase();
function visible() {
  let list = S.items;
  const f = S.q ? (["done", "all"].includes(S.filter) ? S.filter : "open") : S.filter;
  if (f === "done") list = list.filter(e => CLOSED.has(e.stage));
  else if (f !== "all") list = list.filter(e => !CLOSED.has(e.stage));
  if (f === "late") list = list.filter(isLate);
  if (f === "today") list = list.filter(e => daysTo(e) === 0);
  if (f === "cr") list = list.filter(e => e.stage === "Client Review");
  if (f === "focus" && !S.stage) list = list.filter(e => isLate(e) || (daysTo(e) !== null && daysTo(e) <= 2));
  if (S.stage) list = list.filter(e => e.stage === S.stage);
  const w = words(); if (w.length) list = list.filter(e => w.every(x => hay(e).includes(x)));
  return list.slice().sort((a, b) => urgency(a) - urgency(b));
}

/* ---------- render ---------- */
function render() { renderSync(); renderRiverStrip(); renderPress(); renderChips(); renderList(); renderBell(); renderSheet(); }
const renderPanel = () => renderSheet(), renderGates = () => {}, renderForm = () => renderSheet(), renderInbox = () => renderSheet();
function renderSync() {
  const dot = $("sync"); dot.className = "sync";
  $("sub").textContent = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  if (S.error && !S.items.length) { dot.className = "sync off"; dot.title = "Not connected"; return; }
  if (!S.storedAt) return;
  const stale = Date.now() - S.storedAt > 5 * 60000; dot.className = "sync " + (stale ? "stale" : "on");
  dot.title = (stale ? "Stale, synced " : "Synced ") + new Date(S.storedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function renderRiverStrip() {
  const el = $("river");
  if (!S.items.length) { el.innerHTML = ""; return; }
  const doneWk = S.items.filter(i => i.stage === "Done" && i.updated && Date.now() - Date.parse(i.updated) < 7 * 864e5).length;
  el.innerHTML = `<div class="strip" role="group" aria-label="Filter by stage">${FLOW.map(st => { const g = S.items.filter(i => i.stage === st), late = g.filter(isLate).length;
      return `<button class="seg" type="button" data-stage="${esc(st)}" style="--n:${(1 + Math.sqrt(g.length)).toFixed(2)};--c:${colorOf(st)}" aria-pressed="${S.stage === st}" aria-label="${esc(st)}: ${g.length}${late ? ", " + late + " late" : ""}"><b class="tnum">${g.length}</b><i>${esc(SHORT[st])}</i>${late ? `<em>${late}</em>` : ""}</button>`; }).join("")}
    <div class="seg sea" aria-label="${doneWk} reached Done this week"><b class="tnum">${doneWk}</b><i>Done</i></div></div>
    <div class="legend"><span>Start</span><span>${S.stage ? `Showing ${esc(S.stage)} · <button type="button" data-stage="" style="color:var(--foam)">show all</button>` : "Tap a stage to filter"}</span><span>Done this week</span></div>`;
}
const SHORT = { "Queue": "Queue", "Assigned": "Assign", "In Process": "Edit", "In Review": "Review", "Corrections": "Fixes", "Client Review": "Client" };
function renderPress() {
  const el = $("press"); if (!S.items.length) { el.innerHTML = ""; return; }
  const a = ACTIVE(), late = a.filter(isLate).length, today = a.filter(e => daysTo(e) === 0).length, cr = a.filter(e => e.stage === "Client Review").length;
  const c = (k, n, l, cls) => `<button class="pc ${cls}" type="button" data-filter="${k}" aria-pressed="${S.filter === k && !S.stage}"><b class="tnum">${n}</b><span>${l}</span></button>`;
  el.innerHTML = c("late", late, "Late", "late") + c("today", today, "Due today", "today") + c("cr", cr, "With clients", "cr");
}
function renderChips() {
  const opts = [["focus", "Needs you"], ["open", "All open"], ["late", "Late"], ["today", "Due today"], ["cr", "Client Review"], ["done", "Done"], ["all", "Everything"]];
  $("chips").innerHTML = opts.map(([k, l]) => `<button type="button" data-filter="${k}" aria-pressed="${S.filter === k}">${l}</button>`).join("");
  $("qx").hidden = !S.q;
}
function rowHtml(e) {
  const r = rel(e), late = isLate(e);
  return `<button class="row ${late ? "late" : ""}" type="button" data-id="${esc(e.id)}"><span class="av" style="--c:${colorOf(e.stage)}">${esc(initials(label(e)))}</span>
    <span style="min-width:0"><span class="nm">${hl(e.name)}</span><span class="meta"><span>${esc(e.stage)}${e.editor ? " · " + esc(firstName(e.editor)) : ""}</span><em class="${r.cls === "late" ? "late-t" : r.cls === "today" ? "today-t" : ""}">${esc(r.txt)}</em></span></span></button>`;
}
function hl(name) { let out = esc(name); words().filter(w => w.length > 1).forEach(w => { out = out.replace(new RegExp("(" + esc(w).replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); }); return out; }
function renderList() {
  const el = $("list");
  if (S.error && !S.items.length) { const m = errorCopy(S.error); el.innerHTML = `<div class="banner"><b>${esc(m.title)}</b><span>${esc(m.body)}</span></div>`; return; }
  if (!S.items.length) { el.innerHTML = `<div class="skel"><i></i><i></i><i></i><i></i></div>`; return; }
  const list = visible();
  if (!list.length) {
    el.innerHTML = `<div class="empty"><b>${S.q ? `Nothing matches “${esc(S.q)}”` : S.filter === "focus" ? "Nothing is pressing" : "No tasks here"}</b>${S.q ? "Try fewer words, or Everything." : S.filter === "focus" ? "No task is late or due in the next two days." : "Try another filter."}</div>`; return;
  }
  if (S.filter === "focus" && !S.q && !S.stage) {
    const groups = [["Late", list.filter(isLate)], ["Due today", list.filter(e => !isLate(e) && daysTo(e) === 0)], ["Next two days", list.filter(e => !isLate(e) && daysTo(e) > 0)]];
    el.innerHTML = `<div style="display:grid;gap:14px">${groups.filter(g => g[1].length).map(([t, g]) => `<div class="group"><h3>${t}<em>${g.length}</em></h3>${g.map(rowHtml).join("")}</div>`).join("")}</div>`;
    return;
  }
  el.innerHTML = `<div class="group"><h3>${S.q ? "Results" : S.stage || "Tasks"}<em>${list.length}</em></h3>${list.slice(0, 120).map(rowHtml).join("")}${list.length > 120 ? `<p class="empty">Showing 120 of ${list.length}. Search to narrow it down.</p>` : ""}</div>`;
}

/* ---------- sheets: task, inbox, add ---------- */
function openTask(id) { const it = S.items.find(i => i.id === id); if (!it) return; if (S.sel !== id) { S.draft = ""; S.corr = true; S.mention = true; S.unlock = false; } S.sel = id; S.sheet = "task"; S.justOpened = true; renderSheet(); loadPackage(it); loadUpdates(it); }
function closeSheet() { S.sheet = null; S.sel = null; S.adding = false; S.form = null; S.nfReply = null; renderSheet(); }
async function loadUpdates(it, force) {
  if (!mcp || (!force && S.ups[it.id] && S.ups[it.id].state === "ok")) return;
  S.ups[it.id] = { state: "loading", list: (S.ups[it.id] || {}).list || [] };
  try {
    const r = await mcp.callTool(SERVER, "get_updates", { objectType: "Item", objectId: String(it.id), limit: 4 }, force ? { cache: false } : { cache: { staleTime: 60000 } });
    const p = r.payload || {}; S.ups[it.id] = { state: "ok", list: (p.updates || []).map(u => ({ id: u.id, body: u.text_body || "", at: Date.parse(u.created_at), by: (u.creator && u.creator.name) || "Someone" })) };
  } catch (e) { S.ups[it.id] = { state: "error", err: e, list: [] }; }
  if (S.sel === it.id) renderSheet();
}
const BACK = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>`;
const OUT = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`;
function renderSheet() {
  const el = $("sheet");
  if (S.sheet === "task" && !S.items.find(i => i.id === S.sel)) S.sheet = null;
  if (S.sheet === "add" && !S.form) S.sheet = null;
  el.hidden = !S.sheet; document.body.style.overflow = S.sheet ? "hidden" : "";
  if (!S.sheet) { el.innerHTML = ""; el.className = "sheet"; return; }
  const keep = el.querySelector(".sh-b"), top = keep ? keep.scrollTop : 0;
  const f = document.activeElement, fid = f && el.contains(f) ? f.id : null, ss = f && f.selectionStart, se = f && f.selectionEnd;
  el.className = "sheet" + (S.justOpened ? " enter" : ""); S.justOpened = false;
  el.innerHTML = S.sheet === "task" ? taskSheet() : S.sheet === "inbox" ? inboxSheet() : addSheet();
  const b = el.querySelector(".sh-b"); if (b && keep) b.scrollTop = top;
  if (fid) { const n = document.getElementById(fid); if (n) { n.focus({ preventScroll: true }); try { n.setSelectionRange(ss, se); } catch (_) {} } }
}
function head(title, right) { return `<div class="sh-h"><button class="back" type="button" data-act="close">${BACK}Back</button><span>${esc(title)}</span>${right || `<span style="flex:0 0 40px"></span>`}</div>`; }
function taskSheet() {
  const it = S.items.find(i => i.id === S.sel), r = rel(it), canMention = !!EDITOR_IDS[firstName(it.editor).toLowerCase()];
  const laura = /^BL\s*-/i.test(it.clientRaw || ""), locked = laura && !S.unlock, nxt = nextEmptyDate(it);
  const lk = (u, l) => u ? `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>` : "";
  const ups = S.ups[it.id] || { state: "loading", list: [] };
  const nfs = S.notifs.filter(n => n.itemId === it.id && n.kind !== "auto").slice(0, 3);
  return head(it.client || "Episode", `<a href="${esc(it.url)}" target="_blank" rel="noopener" aria-label="Open in Monday" title="Open in Monday">${OUT}</a>`) + `<div class="sh-b"><div class="sh-in">
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center"><span class="badge" style="--c:${colorOf(it.stage)}"><i></i>${esc(it.stage)}</span>${laura ? `<span class="chip">Laura's client</span>` : ""}</div>
    <h2>${esc(it.name)}</h2>
    <p class="rel ${r.cls === "late" ? "late-t" : r.cls === "today" ? "today-t" : ""}">${esc(r.txt)}</p>
    <dl class="props"><dt>Client</dt><dd>${esc(it.client || "Not linked")}</dd><dt>Editor</dt><dd>${esc(it.editor || "No editor yet")}</dd>${it.units ? `<dt>Units</dt><dd class="tnum">${it.units}</dd>` : ""}</dl>
    <div class="dates">${DATE_COLS.map(([k, , nm]) => `<div class="${it[k] ? "" : "empty-d"} ${it[k] && k !== "available" && nextDue(it) === it[k] ? "due " + r.cls : ""}"><span>${nm === "Publishing" ? "Publish" : nm === "Available" ? "Avail." : nm}</span><b class="tnum">${it[k] ? short(it[k]) : "–"}</b></div>`).join("")}</div>
    ${it.upload || it.share || it.dropbox ? `<div class="links">${lk(it.share, "Frame.io review")}${lk(it.upload, "Frame.io upload")}${lk(it.dropbox, "Dropbox raws")}</div>` : ""}
    ${locked ? `<div class="lock"><span>This is Laura's client, so River won't change it unless you unlock it.</span><button class="btn" type="button" data-act="unlock">Unlock</button></div>` : `
    <div><p class="lbl">Move to</p><div class="moves">${MOVE_TO.map(s => `<button class="mv ${s === it.stage ? "cur" : ""}" type="button" data-move="${esc(s)}" style="--c:${colorOf(s)}" ${s === it.stage || S.busy ? "disabled" : ""}><i></i>${esc(s)}</button>`).join("")}</div></div>
    <div><p class="lbl">Note to ${esc(firstName(it.editor) || "the editor")}</p>
      <div class="composer"><textarea id="note" placeholder="C#1 Cut start “…” 12:04, Cut end “…” 12:31" aria-label="Note to the editor">${esc(S.draft)}</textarea>
        <div class="c-bar"><label><input type="checkbox" id="corr" ${S.corr ? "checked" : ""}> Corrections${nxt ? ", " + nxt[2] + " " + short(addWorkdays(2)) : ""}</label>
          <label><input type="checkbox" id="mention" ${canMention && S.mention ? "checked" : ""} ${canMention ? "" : "disabled"}> @${esc(firstName(it.editor) || "editor")}</label>
          <button class="post" type="button" data-act="post" ${S.busy ? "disabled" : ""}>${S.busy ? "Posting" : "Post"}</button></div></div></div>`}
    ${renderPackage(it).replace(/data-act="pkg-retry"/g, 'data-act="pkg-retry" type="button"')}
    <div><p class="lbl"><span>Latest on Monday</span><button type="button" data-act="ups">Refresh</button></p>
      ${ups.state === "loading" && !ups.list.length ? `<div class="skel"><i style="height:44px"></i></div>` : ups.state === "error" ? `<p class="empty">Couldn't load the notes. ${esc(writeErr(ups.err))}</p>` : ups.list.length ? `<div class="ups">${ups.list.map(u => `<div class="up"><b>${esc(u.by)}</b><small>${nago(u.at)}</small><p>${esc(u.body.length > 400 ? u.body.slice(0, 400) + "…" : u.body)}</p></div>`).join("")}</div>` : `<p class="empty">No notes on this task yet.</p>`}
      ${nfs.length ? `<p class="lbl" style="margin-top:14px">Mentions you</p><div class="ups">${nfs.map(n => `<div class="up"><b>${esc(firstName(n.who))}</b><small>${nago(n.t)}</small><p>${esc(n.body.slice(0, 220))}</p></div>`).join("")}</div>` : ""}</div>
  </div></div>`;
}
function inboxSheet() {
  const list = S.notifs.filter(n => S.inboxFilter === "all" || n.kind === S.inboxFilter);
  const body = S.nfErr && !S.notifs.length ? (m => `<div class="banner"><b>${esc(m.title)}</b><span>${esc(m.body)}</span></div>`)(errorCopy(S.nfErr))
    : !S.nfSeeded && !S.notifs.length ? `<div class="skel"><i></i><i></i><i></i></div>`
    : !list.length ? `<p class="empty">Nothing here in your latest 50.</p>` : list.slice(0, 40).map(nfCard).join("");
  return head("Monday notifications") + `<div class="sh-b"><div class="sh-in">
    <div class="chips" style="margin-inline:-16px">${[["all", "All"], ...NF_KIND].map(([k, l]) => `<button type="button" data-nff="${k}" aria-pressed="${S.inboxFilter === k}">${l} <span class="tnum" style="opacity:.6">${k === "all" ? S.notifs.length : S.notifs.filter(n => n.kind === k).length}</span></button>`).join("")}</div>
    <div style="display:grid;gap:8px">${body}</div>
    <p class="empty" style="border:0;padding:0">Reading these here doesn't mark them read in Monday.</p></div></div>`;
}
function nfCard(n) {
  const ep = n.itemId ? S.items.find(i => i.id === n.itemId) : null, fresh = !n.read && n.t > S.nfPrevSeen, open = S.nfReply && S.nfReply.id === n.id;
  const av = n.kind === "auto" ? `<span class="av auto" aria-hidden="true">⚙</span>` : `<span class="av" style="--c:${avColor(n.who)}" aria-hidden="true">${esc(initials(n.who))}</span>`;
  const link = ep ? `<button class="ep" type="button" data-id="${esc(ep.id)}">${esc(shortItem(n.itemName))}</button>` : n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener">${esc(n.itemName ? shortItem(n.itemName) : n.boardName)}</a>` : "";
  return `<div class="nf ${fresh ? "new" : ""}">${av}<div style="min-width:0"><div class="nf-top"><b>${esc(n.kind === "auto" ? "Automation" : n.who)}</b><span>${esc(n.action)}</span><small>${nago(n.t)}</small></div>
    ${n.body ? `<p>${esc(n.body)}</p>` : ""}<div class="nf-ep">${link}${n.kind !== "auto" && n.updateId && n.itemId && !open ? `<button class="rp" type="button" data-nfr="${esc(n.id)}">Reply</button>` : ""}</div>
    ${open ? `<div class="composer"><textarea id="nf-text" placeholder="Reply to ${esc(firstName(n.who))}" aria-label="Reply">${esc(S.nfReply.text)}</textarea><div class="c-bar">${n.edId ? `<label><input type="checkbox" id="nf-mention" ${S.nfReply.mention ? "checked" : ""}> @${esc(firstName(n.who))}</label>` : ""}<button class="btn" type="button" data-act="nf-cancel">Cancel</button><button class="post" type="button" data-act="nf-send" ${S.nfReply.busy ? "disabled" : ""}>${S.nfReply.busy ? "Sending" : "Send"}</button></div></div>` : ""}</div></div>`;
}
function addSheet() {
  const f = S.form, ed = EDITORS.find(e => e[0] === f.editor), q = f.client.trim().toLowerCase();
  const picks = !f.clientId && q.length > 1 && S.clients ? S.clients.filter(c => c.name.toLowerCase().includes(q)).slice(0, 5) : [];
  return head("New task") + `<div class="sh-b"><div class="sh-in"><h2>Add a task</h2><div class="form">
    <label class="fld">Client<input id="f-client" value="${esc(f.client)}" placeholder="${S.clients ? "Start typing a client" : "Loading clients…"}" autocomplete="off"></label>
    ${picks.length ? `<div class="picks">${picks.map(c => `<button type="button" data-pick="${esc(c.id)}">${esc(c.name)}<small>${c.mine ? "Your client" : "Laura's client"}</small></button>`).join("")}</div>` : ""}
    <div class="fld">Type<div class="kinds">${KINDS.map(([k]) => `<button type="button" data-kind="${k}" aria-pressed="${f.kind === k}">${k}</button>`).join("")}</div></div>
    <div class="row2"><label class="fld">Session date<input id="f-date" type="date" value="${esc(f.date)}"></label><label class="fld">Units<input id="f-units" type="number" inputmode="decimal" min="0" step="0.33" value="${esc(f.units)}" placeholder="1"></label></div>
    <label class="fld">Task name<input id="f-name" value="${esc(f.name)}"></label>
    <label class="fld">Editor<select id="f-editor"><option value="">No editor yet (stays in Queue)</option>${EDITORS.map(([n]) => `<option ${f.editor === n ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
    <div class="sum"><span>Producer <b>you</b>${f.clientId ? `, linked to <b>${esc(f.client)}</b>` : f.client ? `, <span class="late-t">not on PP Clients Only, so it won't be linked</span>` : ""}</span>
      <span>Available <b>${short(todayISO())}</b>, Draft <b>${short(addWorkdays(2))}</b> (two working days)</span><span>Status <b>${ed ? "Assigned to " + esc(firstName(ed[0])) : "Queue"}</b></span></div>
    <button class="post" type="button" data-act="create" style="margin:0;min-height:52px" ${f.busy || !f.name.trim() ? "disabled" : ""}>${f.busy ? "Adding…" : "Add task"}</button></div></div></div>`;
}
function openAddSheet() { S.adding = true; S.form = { client: "", clientId: null, kind: "Episode", date: todayISO(), name: "", custom: false, editor: "", units: "", busy: false }; S.form.name = autoName(S.form); S.sheet = "add"; S.justOpened = true; renderSheet(); loadClients(); }
function openInbox() { S.sheet = "inbox"; S.justOpened = true; S.nfPrevSeen = S.nfSeen; S.nfSeen = Date.now(); try { localStorage.setItem("river.notifSeen", String(S.nfSeen)); } catch (_) {} renderBell(); renderSheet(); }
async function sendReply() {
  const r = S.nfReply; if (!r || r.busy || !mcp) return;
  const n = S.notifs.find(x => x.id === r.id), text = (r.text || "").trim();
  if (!n) return; if (!text) { toast("Write the reply first.", { bad: true }); return; }
  r.busy = true; renderSheet();
  try {
    const input = { itemId: Number(n.itemId), parentId: Number(n.updateId), body: esc(text).replace(/\n/g, "<br>") };
    if (r.mention && n.edId) input.mentionsList = JSON.stringify([{ id: String(n.edId), type: "User" }]);
    markWrote(n.itemId); await mcp.callTool(SERVER, "create_update", input, { cache: false });
    S.nfReply = null; toast("Reply sent to " + firstName(n.who));
  } catch (e) { r.busy = false; toast(e && (e.code === "server_unavailable" || e.code === "upstream_error") ? "Monday didn't confirm the reply. Check the thread before sending again." : writeErr(e), { bad: true }); }
  renderSheet();
}
function onNotifs(ev) {
  if (ev.type === "error") { S.nfErr = ev.error; renderBell(); if (S.sheet === "inbox") renderSheet(); return; }
  const p = ev.result.payload || {}, raw = p.notifications || (p.data && p.data.notifications) || [];
  const next = raw.map(normNotif).sort((a, b) => b.t - a.t), known = new Set(S.notifs.map(n => n.id));
  const fresh = S.nfSeeded ? next.filter(n => !known.has(n.id) && !n.read && n.kind !== "auto") : [];
  S.notifs = next; S.nfErr = null;
  if (!(ev.result.cache && ev.result.cache.revalidating)) S.nfSeeded = true;
  if (fresh.length) { const f = fresh[0]; toast(fresh.length > 1 ? fresh.length + " new on Monday" : firstName(f.who) + " " + (f.kind === "mention" ? "mentioned you" : "posted") + (f.itemName ? " on " + shortItem(f.itemName) : ""), { act: { label: "View", fn: openInbox } }); }
  renderBell(); if (S.sheet === "inbox" || S.sheet === "task") renderSheet();
}
function renderBell() { const b = $("bell-n"); const n = S.notifs.filter(isNew).length; b.hidden = !n; b.textContent = n > 99 ? "99+" : n; $("bell").setAttribute("aria-label", n ? n + " new Monday notifications" : "Monday notifications"); }

/* ---------- events ---------- */
document.addEventListener("click", e => {
  const t = e.target;
  const stg = t.closest("[data-stage]"); if (stg && !t.closest("#sheet")) { S.stage = stg.dataset.stage && S.stage !== stg.dataset.stage ? stg.dataset.stage : null; if (S.stage && S.filter === "focus") S.filter = "open"; render(); return; }
  const fl = t.closest("[data-filter]"); if (fl) { S.filter = fl.dataset.filter; S.stage = null; render(); return; }
  const row = t.closest("[data-id]"); if (row) { openTask(row.dataset.id); return; }
  const mv = t.closest("[data-move]"); if (mv && !mv.disabled) { setStage(S.items.find(i => i.id === S.sel), mv.dataset.move); return; }
  const nff = t.closest("[data-nff]"); if (nff) { S.inboxFilter = nff.dataset.nff; renderSheet(); return; }
  const nfr = t.closest("[data-nfr]"); if (nfr) { const n = S.notifs.find(x => x.id === nfr.dataset.nfr); S.nfReply = { id: nfr.dataset.nfr, text: "", mention: !!(n && n.edId), busy: false }; renderSheet(); setTimeout(() => { const x = $("nf-text"); if (x) x.focus(); }, 0); return; }
  const kind = t.closest("[data-kind]"); if (kind && S.form) { S.form.kind = kind.dataset.kind; if (!S.form.custom) S.form.name = autoName(S.form); renderSheet(); return; }
  const pick = t.closest("[data-pick]"); if (pick && S.form) { const c = S.clients.find(x => x.id === pick.dataset.pick); S.form.client = c.name; S.form.clientId = c.id; if (!S.form.custom) S.form.name = autoName(S.form); renderSheet(); return; }
  const a = t.closest("[data-act]"); if (!a) return;
  const it = S.items.find(i => i.id === S.sel), k = a.dataset.act;
  if (k === "close") closeSheet();
  else if (k === "post") postNote();
  else if (k === "unlock") { S.unlock = true; renderSheet(); }
  else if (k === "pkg-retry" && it) loadPackage(it, true);
  else if (k === "ups" && it) { loadUpdates(it, true); renderSheet(); }
  else if (k === "nf-cancel") { S.nfReply = null; renderSheet(); }
  else if (k === "nf-send") sendReply();
  else if (k === "create") createTask().then(() => { if (!S.form) S.sheet = null; render(); });
});
document.addEventListener("input", e => {
  const id = e.target.id;
  if (id === "q") { S.q = e.target.value.trim(); renderChips(); renderList(); return; }
  if (id === "note") { S.draft = e.target.value; return; }
  if (id === "nf-text" && S.nfReply) { S.nfReply.text = e.target.value; return; }
  if (!S.form) return;
  const f = S.form;
  if (id === "f-name") { f.name = e.target.value; f.custom = true; const b = document.querySelector('[data-act="create"]'); if (b) b.disabled = !f.name.trim(); return; }
  if (id === "f-units") { f.units = e.target.value; return; }
  if (id === "f-editor") { f.editor = e.target.value; renderSheet(); return; }
  if (id === "f-client") { f.client = e.target.value; const c = (S.clients || []).find(x => x.name.toLowerCase() === f.client.trim().toLowerCase()); f.clientId = c ? c.id : null; }
  if (id === "f-date") f.date = e.target.value;
  if (!f.custom) f.name = autoName(Object.assign({}, f, { client: f.client.trim() }));
  renderSheet();
});
document.addEventListener("change", e => {
  if (e.target.id === "corr") S.corr = e.target.checked;
  if (e.target.id === "mention") S.mention = e.target.checked;
  if (e.target.id === "nf-mention" && S.nfReply) S.nfReply.mention = e.target.checked;
  if (e.target.id === "f-editor" && S.form) { S.form.editor = e.target.value; renderSheet(); }
});
document.addEventListener("keydown", e => {
  if (e.key === "Escape" && S.sheet) { e.preventDefault(); closeSheet(); }
  if (e.target.id === "note" && (e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); postNote(); }
});
$("qx").addEventListener("click", () => { S.q = ""; $("q").value = ""; renderChips(); renderList(); $("q").focus(); });
$("bell").addEventListener("click", openInbox);
$("add").addEventListener("click", openAddSheet);
$("refresh").addEventListener("click", () => { if (!mcp) return; mcp.invalidate(SERVER, "get_board_items_page").catch(() => {}); mcp.invalidate(SERVER, "all_api_read").catch(() => {}); toast("Syncing with Monday"); });

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
  const keepLocal = new Map(S.items.map(i => [i.id, i]));
  S.items = raw.map(r => { const n = norm(r); n.clientRaw = (r.column_values && Array.isArray(r.column_values.board_relation_mkxb8cpz) && r.column_values.board_relation_mkxb8cpz[0] && r.column_values.board_relation_mkxb8cpz[0].name) || ""; const o = keepLocal.get(n.id); if (o && o._autoDate) n._autoDate = o._autoDate; return n; });
  S.storedAt = ev.result.cache ? ev.result.cache.storedAt : Date.now(); S.error = null; S.loading = !!(ev.result.cache && ev.result.cache.revalidating);
  if (S.pendingOpen && S.items.some(i => i.id === S.pendingOpen)) { const id = S.pendingOpen; S.pendingOpen = null; render(); openTask(id); return; }
  render();
}
async function start() {
  setInterval(renderSync, 30000);
  render();
  try { mcp = window.claude && window.claude.use ? await window.claude.use("mcp") : null; } catch (e) { mcp = null; }
  if (!mcp) { S.loading = false; S.error = { code: "no_mcp" }; render(); return; }
  mcp.watchTool(SERVER, "get_board_items_page", INPUT, onBoard, { refetchInterval: 45000, cache: { staleTime: 30000 } });
  mcp.watchTool(SERVER, "all_api_read", { query: NOTIF_Q }, onNotifs, { refetchInterval: 60000, cache: { staleTime: 30000 } });
}
start();
