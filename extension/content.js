// River for Chrome: a floating panel on every site. It searches your Monday tasks, and shows the task behind what you're looking at
// (the open Gmail thread, a Frame.io or Dropbox link from a task, or an episode named in the page title).
(() => {
  if (window.__river) return; window.__river = true;
  if (window.top !== window) return;
  const L = window.RiverLogic;
  const HOST = location.host, IS_GMAIL = HOST === "mail.google.com", IS_PAGE = location.protocol === "chrome-extension:";
  const S = {
    store: new Map(), users: new Map(L.PEOPLE),
    // what's on screen
    open: IS_GMAIL || IS_PAGE, view: "context", selId: null, from: "context", busy: false, toast: null, justOpened: false,
    // context (Gmail thread / page)
    key: null, info: null, clients: [], ctx: [], status: "idle", err: null, why: "", cache: new Map(),
    // search
    q: "", scope: "mine", filter: "open", mine: null, mineAt: 0, mineErr: null, every: [], everyQ: "", everyBusy: false, hi: 0,
    // note composer
    draft: "", corr: true, mention: true, unlock: new Set(),
    settings: { everywhere: true, hidden: [] }, pos: null
  };

  /* ---------- Monday through the background worker ---------- */
  async function gql(query, variables) {
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "gql", query, variables }); }
    catch (e) { throw Object.assign(new Error("River was updated. Reload this page to reconnect."), { code: "reload" }); }
    if (!r || !r.ok) throw Object.assign(new Error((r && r.error) || "Monday didn't answer."), { code: (r && r.code) || "api" });
    return r.data;
  }
  function keep(raws) { return raws.map(x => { const n = L.normEpisode(x), old = S.store.get(n.id); if (old) { if (!n.hasUpdates && old.hasUpdates) { n.updates = old.updates; n.hasUpdates = true; } Object.assign(old, n); return old; } S.store.set(n.id, n); return n; }); }
  const get = id => S.store.get(id) || null;
  const pageItems = d => (((d.boards || [])[0] || {}).items_page || {});

  /* ---------- your tasks (for search and link matching) ---------- */
  let mineLoading = null;
  function loadMine(force) {
    if (!force && S.mine && Date.now() - S.mineAt < 90000) return Promise.resolve(S.mine);
    if (mineLoading) return mineLoading;
    mineLoading = (async () => {
      try {
        let page = pageItems(await gql(L.QUERIES.mine)), all = page.items || [], guard = 0;
        while (page.cursor && guard++ < 4) { page = (await gql(L.QUERIES.more, { c: page.cursor })).next_items_page || {}; all = all.concat(page.items || []); }
        S.mine = keep(all); S.mineAt = Date.now(); S.mineErr = null;
      } catch (e) { S.mineErr = e; }
      mineLoading = null; render(); return S.mine;
    })();
    return mineLoading;
  }
  let everyT, everySeq = 0;
  function searchEveryone() {
    clearTimeout(everyT);
    const q = S.q.trim(); if (q.length < 2) { S.every = []; S.everyQ = ""; render(); return; }
    everyT = setTimeout(async () => {
      const seq = ++everySeq; S.everyBusy = true; render();
      try { const d = await gql(L.QUERIES.find, { q: [q] }); if (seq !== everySeq) return; S.every = keep(pageItems(d).items || []).sort((a, b) => L.urgency(a) - L.urgency(b)); S.everyQ = q; S.mineErr = null; }
      catch (e) { if (seq === everySeq) S.mineErr = e; }
      if (seq === everySeq) { S.everyBusy = false; render(); }
    }, 350);
  }
  async function loadDetail(ep) {
    if (!ep || ep.hasUpdates || ep._loading) return;
    ep._loading = true;
    try { const d = await gql(L.QUERIES.item, { ids: [ep.id] }); keep(d.items || []); await nameUsers([ep]); } catch (_) {}
    ep._loading = false; render();
  }
  async function nameUsers(eps) {
    const ids = [...new Set(eps.flatMap(e => e.updates.map(u => u.by)).filter(id => id && !S.users.has(id)))];
    if (!ids.length) return;
    try { const d = await gql(L.QUERIES.users, { ids }); (d.users || []).forEach(u => S.users.set(String(u.id), u.name)); } catch (_) {}
  }

  /* ---------- context: the open email, or the page ---------- */
  function readThread() {
    const main = document.querySelector('[role="main"]'); if (!main) return null;
    const subj = main.querySelector("h2.hP"); if (!subj) return null;
    const people = [...main.querySelectorAll("span[email]")].map(s => ({ email: s.getAttribute("email"), name: s.getAttribute("name") || s.textContent }));
    return { subject: subj.textContent.trim(), people, main };
  }
  function check() {
    if (IS_PAGE) return;
    if (IS_GMAIL) {
      const t = readThread();
      const key = t ? "m|" + t.subject + "|" + [...new Set(t.people.map(p => (p.email || "").toLowerCase()))].sort().join(",") : null;
      if (key === S.key) return;
      S.key = key; S.unlock.clear(); S.draft = "";
      if (!t) { S.info = null; S.ctx = []; S.status = "idle"; if (S.view === "context") S.selId = null; render(); return; }
      S.info = L.readEmail({ subject: t.subject, people: t.people, text: (t.main.innerText || "").slice(0, 8000) });
      if (S.view !== "search") S.view = "context";
      lookup(S.key, S.info); return;
    }
    const h1 = document.querySelector("h1"), title = document.title + " " + (h1 ? h1.textContent : "");
    const pc = L.pageContext(title, location.href, S.mine || []);
    const key = "p|" + location.href.split("#")[0] + "|" + pc.episodes.join(",") + "|" + pc.byLink.join(",");
    if (key === S.key) return;
    S.key = key;
    if (!pc.episodes.length && !pc.byLink.length) { S.info = null; S.ctx = []; S.status = "idle"; render(); return; }
    S.info = { subject: document.title, external: [], people: [], episodes: pc.episodes, byLink: pc.byLink };
    lookup(S.key, S.info);
  }
  async function lookup(key, info, force) {
    const hit = !force && S.cache.get(key);
    if (hit && Date.now() - hit.at < 120000) { S.ctx = hit.ids.map(get).filter(Boolean); S.clients = hit.clients; S.why = hit.why; S.status = S.ctx.length ? "ok" : "none"; pickCtx(); render(); return; }
    S.status = "loading"; S.err = null; S.ctx = []; S.clients = []; render();
    try {
      let clients = [];
      const emails = (info.external || []).map(p => p.email);
      if (emails.length) {
        const d = await gql(L.QUERIES.clients, { v: emails });
        clients = ((d.items_page_by_column_values || {}).items || []).map(x => ({ id: String(x.id), name: x.name, email: (((x.column_values || []).find(c => c.id === "text_mkxbach4") || {}).text || "").toLowerCase() }));
      }
      const terms = L.searchTerms(info, clients);
      const results = await Promise.all(terms.map(t => gql(L.QUERIES.find, { q: [t.q] }).then(d => pageItems(d).items || [], () => [])));
      const byId = new Map(); keep(results.flat()).forEach(e => byId.set(e.id, e));
      (info.byLink || []).forEach(id => { const e = get(id); if (e) byId.set(id, e); });
      let eps = L.rank([...byId.values()], clients, info);
      if (info.byLink && info.byLink.length) eps = eps.sort((a, b) => info.byLink.includes(b.id) - info.byLink.includes(a.id));
      if (key !== S.key) return;
      const why = info.byLink && info.byLink.length && eps[0] && info.byLink.includes(eps[0].id) ? "this page's link" : clients.length ? clients.map(c => L.stripPrefix(c.name)).join(", ") : terms.length ? terms[0].q : "";
      S.cache.set(key, { at: Date.now(), ids: eps.map(e => e.id), clients, why });
      S.ctx = eps; S.clients = clients; S.why = why; S.status = eps.length ? "ok" : "none"; S.err = null; pickCtx();
      if (!IS_GMAIL && eps.length && !S.open) { S.open = false; } // stay a pill on normal sites; the pill shows the match
    } catch (e) { if (key !== S.key) return; S.status = "error"; S.err = e; }
    render();
  }
  function pickCtx() { if (S.view === "context") { S.selId = S.ctx[0] ? S.ctx[0].id : null; if (S.selId) loadDetail(get(S.selId)); } }

  /* ---------- writes (same rules as River) ---------- */
  async function setStage(ep, lbl, undo) {
    if (S.busy || !ep || ep.stage === lbl) return;
    const prev = ep.stage, patch = lbl === "Corrections" && !undo ? L.correctionsPatch(ep) : { cv: {}, slot: null };
    const clear = undo && undo.slot ? { [undo.slot[1]]: null } : {};
    const cv = Object.assign({ status: { label: lbl } }, patch.cv, clear);
    S.busy = true; ep.stage = lbl; if (patch.slot) ep[patch.slot[0]] = patch.iso; if (undo && undo.slot) ep[undo.slot[0]] = null; render();
    try {
      await gql(L.QUERIES.setCols, { i: ep.id, v: JSON.stringify(cv) });
      toast(undo ? "Back in " + lbl + (undo.slot ? ", " + undo.slot[2] + " cleared" : "") : "Moved to " + lbl + (patch.slot ? ", " + patch.slot[2] + " set to " + L.short(patch.iso) : lbl === "Corrections" ? ", every deadline is already set" : ""),
        undo ? null : () => setStage(ep, prev, { slot: patch.slot }));
      S.cache.clear();
    } catch (e) {
      ep.stage = prev; if (patch.slot) ep[patch.slot[0]] = null;
      toast(e.code === "network" ? "Monday didn't confirm. Check the task before trying again." : e.message, null, true);
    }
    S.busy = false; render();
  }
  async function postNote(ep) {
    const text = S.draft.trim(); if (!text || S.busy) { if (!text) toast("Write the note first.", null, true); return; }
    S.busy = true; render();
    try {
      const mid = S.mention ? L.editorId(ep.editor) : null;
      await gql(L.QUERIES.note, { i: ep.id, b: esc(text).replace(/\n/g, "<br>"), m: mid ? [{ id: mid, type: "User" }] : null });
      let msg = "Note posted" + (mid ? " to " + L.firstName(ep.editor) : "");
      if (S.corr) {
        const patch = L.correctionsPatch(ep);
        await gql(L.QUERIES.setCols, { i: ep.id, v: JSON.stringify(Object.assign({ status: { label: "Corrections" } }, patch.cv)) });
        if (patch.slot) ep[patch.slot[0]] = patch.iso;
        msg += ep.stage === "Corrections" ? "" : ", moved to Corrections"; if (patch.slot) msg += ", " + patch.slot[2] + " " + L.short(patch.iso);
        ep.stage = "Corrections";
      }
      S.draft = ""; toast(msg); S.cache.clear();
      ep.hasUpdates = false; loadDetail(ep);
    } catch (e) { toast(e.code === "network" ? "Monday didn't confirm. Check the task before posting again." : e.message, null, true); }
    S.busy = false; render();
  }

  /* ---------- UI shell ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = document.createElement("div"); host.id = "poddster-river";
  host.style.cssText = IS_PAGE ? "position:fixed;inset:0;z-index:1;display:grid;place-items:center;" : "position:fixed;z-index:2147483000;right:24px;bottom:24px;";
  const root = host.attachShadow({ mode: "open" });
  (document.body || document.documentElement).appendChild(host);
  ["keydown", "keypress", "keyup"].forEach(t => host.addEventListener(t, e => e.stopPropagation()));
  root.innerHTML = `<style>${CSS()}</style><div id="w"></div>`;
  const W = root.getElementById("w");
  const hiddenHere = () => !IS_GMAIL && !IS_PAGE && (!S.settings.everywhere || S.settings.hidden.includes(HOST));
  try {
    chrome.storage.local.get(["open", "pos", "everywhere", "hidden"], v => {
      if (IS_GMAIL && v.open === false) S.open = false;
      if (v.pos && !IS_PAGE) place(v.pos);
      S.settings.everywhere = v.everywhere !== false; S.settings.hidden = Array.isArray(v.hidden) ? v.hidden : [];
      render();
    });
  } catch (_) {}
  function place(p) { S.pos = p; host.style.right = Math.max(8, Math.min(window.innerWidth - 60, p.right)) + "px"; host.style.bottom = Math.max(8, Math.min(window.innerHeight - 50, p.bottom)) + "px"; }
  function openPanel(q) {
    S.open = true; S.justOpened = true;
    if (typeof q === "string") { S.q = q; S.view = "search"; S.hi = 0; if (S.scope === "everyone") searchEveryone(); }
    else if (!S.ctx.length && S.view === "context") S.view = "search";
    loadMine(); render(); setTimeout(() => { const i = root.getElementById("q"); if (i && (typeof q === "string" || S.view === "search")) { i.focus(); i.select(); } }, 0);
  }
  function closePanel() { S.open = false; try { if (IS_GMAIL) chrome.storage.local.set({ open: false }); } catch (_) {} render(); }

  const LOGO = `<svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#FF003C"/><rect x="12" y="8" width="16" height="18" rx="8" fill="none" stroke="#fff" stroke-width="3.6"/><path d="M13.8 22v11" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>`;
  const ICON = {
    min: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
    sync: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>`,
    out: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
    find: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`,
    gear: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>`,
    back: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>`
  };
  const dot = st => `<i class="d" style="background:${L.COLOR[st] || "#A68CFF"}"></i>`;

  function render() {
    const f = root.activeElement, fid = f && f.id, ss = f && f.selectionStart, se = f && f.selectionEnd;
    draw();
    if (fid) { const n = root.getElementById(fid); if (n) { restoring = true; n.focus(); restoring = false; try { n.setSelectionRange(ss, se); } catch (_) {} } }
  }
  let restoring = false;
  function draw() {
    if (!S.open && hiddenHere()) { W.innerHTML = toastHtml(); return; }
    if (!S.open) {
      const ep = S.ctx[0], late = ep && L.isLate(ep);
      if (!ep && !IS_GMAIL) { W.innerHTML = `<button class="fab" data-a="open" title="Search Monday tasks (Alt+Shift+R)" aria-label="Open River">${LOGO}</button>${toastHtml()}`; return; }
      const label = S.status === "loading" ? "Looking up…" : ep ? `${esc(ep.client || ep.name.split(" - ")[0])} · ${esc(ep.stage)}` : S.status === "none" ? "No Monday task" : "River";
      W.innerHTML = `<button class="pill ${late ? "late" : ""}" data-a="open" title="Open River (Alt+Shift+R)">${LOGO}${ep ? dot(ep.stage) : ""}<span>${label}</span>${S.ctx.length > 1 ? `<em>${S.ctx.length}</em>` : ""}</button>${toastHtml()}`;
      return;
    }
    const enter = S.justOpened; S.justOpened = false;
    W.innerHTML = `<section class="panel${enter ? " enter" : ""}${IS_PAGE ? " page" : ""}" aria-label="River">
      <header class="hd" ${IS_PAGE ? "" : "data-drag"}>${LOGO}<div class="ttl"><b>River</b><span>${esc(subtitle())}</span></div>
        <button class="ib" data-a="sync" title="Refresh">${ICON.sync}</button><button class="ib" data-a="options" title="Settings">${ICON.gear}</button>${IS_PAGE ? "" : `<button class="ib" data-a="min" title="Minimise (Esc)">${ICON.min}</button>`}</header>
      <div class="find">${ICON.find}<input id="q" placeholder="Search your tasks: client, editor, stage…" value="${esc(S.q)}" autocomplete="off" spellcheck="false">${S.q ? `<button class="x" data-a="clear" title="Clear">×</button>` : ""}</div>
      ${S.view === "search" ? searchBar() : ""}
      <div class="bd">${S.view === "search" ? results() : S.view === "card" ? cardView() : contextView()}</div>
      ${!IS_GMAIL && !IS_PAGE ? `<footer class="ft"><button data-a="hide">Hide the River button on ${esc(HOST)}</button></footer>` : ""}
      ${toastHtml()}</section>`;
  }
  function subtitle() {
    if (S.view === "search") return S.scope === "mine" ? "Searching your tasks" : "Searching everyone's tasks";
    if (S.status === "loading") return "Looking up on Monday…";
    if (S.view === "context" && S.status === "ok" && S.why) return "Matched " + S.why;
    if (S.info && S.info.subject) return S.info.subject;
    return IS_GMAIL ? "Open an email to see its task" : "Search, or open a page about a task";
  }
  function tokenError(err) {
    const tok = ["no_token", "bad_token"].includes(err && err.code);
    return `<div class="msg bad"><b>${tok ? "Connect Monday" : "Couldn't reach Monday"}</b><p>${esc(err && err.message)}</p><div class="row">${tok ? `<button class="btn pri" data-a="options">Add Monday token</button>` : `<button class="btn" data-a="sync">Try again</button>`}</div></div>`;
  }

  /* ---------- search ---------- */
  function searchBar() {
    const c = (k, l, cur, attr) => `<button type="button" ${attr}="${k}" aria-pressed="${cur === k}">${l}</button>`;
    return `<div class="chips">${c("mine", "My tasks", S.scope, "data-scope")}${c("everyone", "Everyone", S.scope, "data-scope")}<span class="sep"></span>
      ${S.scope === "mine" ? c("open", "Open", S.filter, "data-filter") + c("late", "Late", S.filter, "data-filter") + c("done", "Done", S.filter, "data-filter") + c("all", "All", S.filter, "data-filter") : ""}</div>`;
  }
  function currentResults() {
    if (S.scope === "mine") return S.mine ? L.matchLocal(S.mine, S.q, S.filter) : null;
    return S.q.trim().length < 2 ? [] : S.every;
  }
  function results() {
    if (S.mineErr) return tokenError(S.mineErr);
    const list = currentResults();
    if (list === null || (S.scope === "everyone" && S.everyBusy && !S.every.length)) return `<div class="skel"><i></i><i></i><i style="width:70%"></i><i></i><i style="width:55%"></i></div>`;
    if (S.scope === "everyone" && S.q.trim().length < 2) return `<div class="msg"><b>Search every producer's tasks</b><p>Type at least two letters of a client or episode name.</p></div>`;
    if (!list.length) return `<div class="msg"><b>No tasks match${S.q ? ` “${esc(S.q.trim())}”` : ""}</b><p>${S.scope === "mine" ? (S.filter !== "all" ? "Try All, or search Everyone." : "Try searching Everyone.") : "Check the spelling, or try just the client's surname."}</p></div>`;
    S.hi = Math.min(S.hi, list.length - 1);
    const total = S.scope === "mine" ? S.mine.length : null, late = list.filter(L.isLate).length;
    const head = `<p class="count">${list.length}${S.scope === "mine" ? (S.filter === "open" ? " open" : S.filter === "late" ? " late" : S.filter === "done" ? " finished" : "") : ""} task${list.length === 1 ? "" : "s"}${late && S.filter !== "late" ? ` · <span class="late">${late} late</span>` : ""}${S.everyBusy ? " · searching…" : ""}</p>`;
    return head + `<div class="res" role="listbox">${list.slice(0, 80).map((e, i) => { const r = L.rel(e);
      return `<button class="rs ${i === S.hi ? "hi" : ""}" role="option" data-ep="${esc(e.id)}" data-i="${i}">${dot(e.stage)}<span class="nm">${hl(e.name)}</span>
        <span class="sub">${esc(e.stage)}${e.editor ? " · " + esc(L.firstName(e.editor)) : ""}${S.scope === "everyone" && e.producer && !/Abdullah/.test(e.producer) ? " · " + esc(L.firstName(e.producer)) + "'s" : ""}<em class="${r.cls}">${esc(r.txt)}</em></span></button>`; }).join("")}</div>` +
      (list.length > 80 ? `<p class="count">Showing 80 of ${list.length}. Type more to narrow it down.</p>` : "");
  }
  function hl(name) {
    const words = S.q.toLowerCase().split(/\s+/).filter(w => w.length > 1); let out = esc(name);
    words.forEach(w => { const re = new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/&/g, "&amp;") + ")", "ig"); out = out.replace(re, "<mark>$1</mark>"); });
    return out;
  }

  /* ---------- context and card ---------- */
  function contextView() {
    if (S.status === "error") return tokenError(S.err);
    if (S.status === "loading") return `<div class="skel"><i></i><i></i><i style="width:60%"></i></div>`;
    if (S.status === "idle" || !S.info) return `<div class="msg"><b>${IS_GMAIL ? "Open an email" : "Nothing on this page"}</b><p>${IS_GMAIL ? "River finds the Monday task from the client's email address, their name, or an episode named in the email." : "River recognises an episode named in the page title, and Frame.io or Dropbox links that belong to one of your tasks."} Or search above.</p></div>`;
    if (S.status === "none") { const tried = [...(S.info.external || []).map(p => p.email), ...(S.info.episodes || [])].slice(0, 4);
      return `<div class="msg"><b>No Monday task found</b><p>${tried.length ? "Checked " + esc(tried.join(", ")) + "." : ""} Search above to find it by name.</p></div>`; }
    const ep = get(S.selId) || S.ctx[0], others = S.ctx.filter(e => e !== ep);
    return card(ep) + (others.length ? `<div class="others"><p class="lbl">${others.length} more on Monday</p>${others.slice(0, 8).map(e => `<button class="oth" data-ep="${esc(e.id)}">${dot(e.stage)}<span>${esc(e.name)}</span><em class="${L.rel(e).cls}">${esc(e.stage)}</em></button>`).join("")}</div>` : "");
  }
  function cardView() {
    const ep = get(S.selId); if (!ep) { S.view = "search"; return results(); }
    return `<button class="back" data-a="back">${ICON.back} ${S.from === "search" ? "Back to results" : "Back"}</button>` + card(ep);
  }
  function card(ep) {
    const r = L.rel(ep), locked = ep.laura && !S.unlock.has(ep.id), mid = L.editorId(ep.editor), nxt = L.DATE_COLS.find(([k]) => !ep[k]);
    const lk = (u, l) => u ? `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>` : "";
    const row = (k, v) => `<dt>${k}</dt><dd>${v}</dd>`;
    return `<article class="ep">
      <div class="top"><span class="badge" style="--c:${L.COLOR[ep.stage] || "#A68CFF"}"><i></i>${esc(ep.stage)}</span>${ep.laura ? `<span class="chip">Laura's client</span>` : ""}${!/Abdullah/.test(ep.producer) && ep.producer ? `<span class="chip">${esc(ep.producer)}</span>` : ""}
        <a class="ib sm" href="${esc(ep.url)}" target="_blank" rel="noopener" title="Open in Monday">${ICON.out}</a></div>
      <h2><a href="${esc(ep.url)}" target="_blank" rel="noopener">${esc(ep.name)}</a></h2>
      <p class="rel ${r.cls}">${esc(r.txt)}</p>
      <dl>${row("Client", esc(ep.client || "Not linked"))}${row("Editor", esc(ep.editor || "No editor yet") + (ep.units ? ` <span class="mut">· ${ep.units} unit${ep.units === 1 ? "" : "s"}</span>` : ""))}</dl>
      <div class="dates">${L.DATE_COLS.map(([k, , nm]) => `<div class="${ep[k] ? "" : "empty"} ${ep[k] && k !== "available" && L.nextDue(ep) === ep[k] ? "due " + r.cls : ""}"><span>${nm === "Publishing" ? "Publish" : nm === "Available" ? "Avail." : nm}</span><b class="tnum">${ep[k] ? L.short(ep[k]) : "–"}</b></div>`).join("")}</div>
      ${ep.upload || ep.share || ep.dropbox ? `<div class="links">${lk(ep.share, "Frame.io review")}${lk(ep.upload, "Frame.io upload")}${lk(ep.dropbox, "Dropbox raws")}</div>` : ""}
      ${locked ? `<div class="lock"><span>This is Laura's client, so River won't change it unless you unlock it.</span><button class="btn" data-a="unlock">Unlock</button></div>` : `
      <div><p class="lbl">Move to</p><div class="moves">${L.MOVE_TO.map(s => `<button class="mv" data-stage="${esc(s)}" style="--c:${L.COLOR[s]}" ${s === ep.stage || S.busy ? "disabled" : ""}><i></i>${esc(s)}</button>`).join("")}</div></div>
      <div><p class="lbl">Note to ${esc(L.firstName(ep.editor) || "the editor")}</p>
        <div class="composer"><textarea id="note" placeholder="${IS_GMAIL ? "Paste or add the client's notes from this email…" : "Write a note, or add text you've highlighted on the page…"}">${esc(S.draft)}</textarea>
          <div class="cbar"><button class="btn sm" data-a="grab" title="Adds the text you've highlighted on the page">+ Selected text</button>
            <label title="Also fills the next empty deadline with 2 working days from today"><input type="checkbox" id="corr" ${S.corr ? "checked" : ""}> Corrections${nxt ? ", " + nxt[2] + " " + L.short(L.addWorkdays(2)) : ""}</label>
            <label><input type="checkbox" id="mention" ${mid && S.mention ? "checked" : ""} ${mid ? "" : "disabled"}> @${esc(L.firstName(ep.editor) || "editor")}</label>
            <button class="btn pri" data-a="post" ${S.busy ? "disabled" : ""}>${S.busy ? "Posting" : "Post"}</button></div></div></div>`}
      ${!ep.hasUpdates ? `<div><p class="lbl">Latest on Monday</p><div class="skel"><i style="width:80%"></i><i style="width:60%"></i></div></div>` : ep.updates.length ? `<div><p class="lbl">Latest on Monday</p><div class="ups">${ep.updates.map(u => `<div class="up"><b>${esc(S.users.get(u.by) || "Someone")}</b><small>${esc(L.ago(u.at))}</small><p>${esc(u.body.length > 260 ? u.body.slice(0, 260) + "…" : u.body)}</p></div>`).join("")}</div></div>` : ""}
    </article>`;
  }
  function toastHtml() { const t = S.toast; return t ? `<div class="toast ${t.bad ? "bad" : ""} ${S.open ? "" : "float"}" role="status"><span>${esc(t.text)}</span>${t.undo ? `<button data-a="undo">Undo</button>` : ""}</div>` : ""; }
  let tt; function toast(text, undo, bad) { S.toast = { text, undo, bad }; clearTimeout(tt); tt = setTimeout(() => { S.toast = null; render(); }, undo ? 7000 : 4000); render(); }
  function openCard(id, from) { S.selId = id; S.draft = ""; S.from = from; S.view = from === "context" ? "context" : "card"; const a = root.activeElement; if (a && a.id === "q") a.blur(); render(); loadDetail(get(id)); const bd = W.querySelector(".bd"); if (bd) bd.scrollTop = 0; }

  /* Remember the last text highlighted on the page, because clicking our button clears the selection. */
  let lastSel = "";
  document.addEventListener("selectionchange", () => { const s = String(window.getSelection() || "").trim(); if (s) lastSel = s; });

  W.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"), st = e.target.closest("[data-stage]"), o = e.target.closest("[data-ep]");
    const sc = e.target.closest("[data-scope]"), fl = e.target.closest("[data-filter]");
    if (sc) { S.scope = sc.dataset.scope; S.hi = 0; if (S.scope === "everyone") searchEveryone(); render(); root.getElementById("q") && root.getElementById("q").focus(); return; }
    if (fl) { S.filter = fl.dataset.filter; S.hi = 0; render(); return; }
    if (o) { openCard(o.dataset.ep, S.view === "search" ? "search" : S.view === "card" ? S.from : "context"); return; }
    if (st && !st.disabled) { setStage(get(S.selId), st.dataset.stage); return; }
    if (!a) return;
    const k = a.dataset.a, ep = get(S.selId);
    if (k === "open") openPanel();
    else if (k === "min") closePanel();
    else if (k === "sync") { if (S.view === "search") { loadMine(true); if (S.scope === "everyone") searchEveryone(); } else if (S.info) lookup(S.key, S.info, true); else { S.key = null; check(); } if (ep) { ep.hasUpdates = false; loadDetail(ep); } }
    else if (k === "options") { try { chrome.runtime.sendMessage({ type: "options" }); } catch (_) {} }
    else if (k === "clear") { S.q = ""; S.hi = 0; if (S.ctx.length) { S.view = "context"; S.selId = S.ctx[0].id; } render(); }
    else if (k === "back") { S.view = S.from === "search" ? "search" : "context"; render(); }
    else if (k === "hide") { S.settings.hidden = [...new Set([...S.settings.hidden, HOST])]; try { chrome.storage.local.set({ hidden: S.settings.hidden }); } catch (_) {} S.open = false; toast("Hidden on " + HOST + ". Alt+Shift+R or the toolbar icon still opens River here."); }
    else if (k === "unlock" && ep) { S.unlock.add(ep.id); render(); }
    else if (k === "post" && ep) postNote(ep);
    else if (k === "undo" && S.toast && S.toast.undo) { const f = S.toast.undo; S.toast = null; f(); }
    else if (k === "grab") { if (!lastSel) { toast("Highlight the text on the page first.", null, true); return; } S.draft = (S.draft ? S.draft.trimEnd() + "\n" : "") + lastSel; render(); const n = root.getElementById("note"); if (n) { n.focus(); n.selectionStart = n.value.length; } }
  });
  W.addEventListener("focusin", e => { if (!restoring && e.target.id === "q" && S.view !== "search") { S.view = "search"; S.hi = 0; loadMine(); render(); } });
  W.addEventListener("input", e => {
    if (e.target.id === "note") S.draft = e.target.value;
    if (e.target.id === "q") { S.q = e.target.value; S.hi = 0; S.view = "search"; if (S.scope === "everyone") searchEveryone(); render(); }
  });
  W.addEventListener("change", e => { if (e.target.id === "corr") S.corr = e.target.checked; if (e.target.id === "mention") S.mention = e.target.checked; });
  W.addEventListener("keydown", e => {
    if (e.target.id === "q") {
      const list = currentResults() || [];
      if (e.key === "ArrowDown") { e.preventDefault(); S.hi = Math.min(list.length - 1, S.hi + 1); render(); scrollHi(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); S.hi = Math.max(0, S.hi - 1); render(); scrollHi(); }
      else if (e.key === "Enter") { e.preventDefault(); if (list[S.hi]) openCard(list[S.hi].id, "search"); }
      else if (e.key === "Escape") { e.preventDefault(); if (S.q) { S.q = ""; S.hi = 0; render(); } else if (S.ctx.length) { S.view = "context"; render(); } else if (!IS_PAGE) closePanel(); }
      return;
    }
    if (e.target.id === "note" && (e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); const ep = get(S.selId); if (ep) postNote(ep); return; }
    if (e.key === "Escape") { e.preventDefault(); if (S.view === "card") { S.view = S.from === "search" ? "search" : "context"; render(); } else if (!IS_PAGE) closePanel(); }
  });
  function scrollHi() { const h = W.querySelector(".rs.hi"); if (h) h.scrollIntoView({ block: "nearest" }); }
  /* Drag the panel by its header; the spot is remembered. */
  W.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-drag]"); if (!h || e.target.closest("button")) return;
    const r0 = { right: parseFloat(host.style.right), bottom: parseFloat(host.style.bottom) }, x0 = e.clientX, y0 = e.clientY;
    const mv = ev => place({ right: r0.right - (ev.clientX - x0), bottom: r0.bottom - (ev.clientY - y0) });
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); try { chrome.storage.local.set({ pos: S.pos }); } catch (_) {} };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });

  /* Toolbar icon, Alt+Shift+R, and right-click "Find in River" all arrive here. */
  try {
    chrome.runtime.onMessage.addListener(m => {
      if (!m) return;
      if (m.type === "toggle") { if (S.open && typeof m.q !== "string") closePanel(); else openPanel(m.q); }
    });
    chrome.storage.onChanged.addListener(c => {
      if (c.everywhere) S.settings.everywhere = c.everywhere.newValue !== false;
      if (c.hidden) S.settings.hidden = c.hidden.newValue || [];
      if (c.token) { S.mine = null; S.mineErr = null; S.cache.clear(); S.key = null; check(); }
      render();
    });
  } catch (_) {}

  if (IS_GMAIL) { window.addEventListener("hashchange", () => setTimeout(check, 300)); setInterval(check, 1200); }
  else if (!IS_PAGE) { setInterval(check, 2500); }
  render(); check();
  // Load your task list in the background so search is instant and task links on this page are recognised.
  if (!hiddenHere() || IS_GMAIL || IS_PAGE) setTimeout(() => loadMine().then(() => { if (!IS_GMAIL) { S.key = null; check(); } }), IS_PAGE ? 0 : 1500);
  if (IS_PAGE) { const q = new URLSearchParams(location.search).get("q"); openPanel(q || ""); }

  function CSS() { return `
    :host{all:initial}
    *{box-sizing:border-box}
    #w{font:400 13.5px/1.45 "Geist",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#EEF3FA;-webkit-font-smoothing:antialiased}
    button,input,textarea{font:inherit;color:inherit}
    button{cursor:pointer;background:none;border:0;padding:0}
    a{color:inherit}
    :focus-visible{outline:2px solid #FF003C;outline-offset:2px;border-radius:6px}
    .tnum{font-variant-numeric:tabular-nums}
    .fab{width:42px;height:42px;border-radius:50%;display:grid;place-items:center;background:#0A0F17;border:1px solid rgb(160 200 255 / .2);box-shadow:0 10px 26px -8px rgb(0 0 0 / .55);opacity:.82}
    .fab:hover{opacity:1;background:#121A26}
    .pill{display:flex;align-items:center;gap:8px;padding:7px 14px 7px 8px;border-radius:999px;background:#0A0F17;border:1px solid rgb(160 200 255 / .18);box-shadow:0 12px 30px -10px rgb(0 0 0 / .6);max-width:340px;color:#EEF3FA}
    .pill:hover{background:#121A26}
    .d{width:8px;height:8px;border-radius:50%;flex:none;display:inline-block}
    .pill span{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pill em{font:600 11px ui-monospace,Menlo,monospace;font-style:normal;background:#1E2836;border-radius:999px;padding:1px 7px;color:#C9D3E2}
    .pill.late{border-color:rgb(255 77 106 / .6)}
    @media (prefers-reduced-motion:no-preference){.pill.late .d{animation:pulse 1.8s ease-out infinite}@keyframes pulse{50%{box-shadow:0 0 0 5px rgb(255 77 106 / .25)}}}
    .panel{width:390px;max-height:min(740px,calc(100vh - 48px));display:flex;flex-direction:column;background:#0A0F17;border:1px solid rgb(160 200 255 / .15);border-radius:18px;box-shadow:0 30px 70px -20px rgb(0 0 0 / .75),0 0 0 1px rgb(0 0 0 / .4);overflow:hidden;position:relative}
    .panel.page{width:min(560px,calc(100vw - 32px));max-height:calc(100vh - 48px)}
    @media (prefers-reduced-motion:no-preference){.panel.enter{animation:rise .18s ease-out}@keyframes rise{from{transform:translateY(8px);opacity:.6}}}
    .hd{display:flex;align-items:center;gap:8px;padding:11px 10px 11px 14px;border-bottom:1px solid rgb(160 200 255 / .08);user-select:none;background:linear-gradient(180deg,#0E1622,#0A0F17)}
    .hd[data-drag]{cursor:grab}
    .ttl{flex:1;min-width:0;display:grid}
    .ttl b{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .ttl span{font-size:12px;color:#8693A8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#8693A8;flex:none;text-decoration:none}
    .ib:hover{background:#151D2A;color:#EEF3FA}
    .ib.sm{width:24px;height:24px;margin-left:auto}
    .find{display:flex;align-items:center;gap:8px;margin:10px 12px 0;border:1px solid rgb(160 200 255 / .15);border-radius:999px;padding:7px 12px;color:#8693A8}
    .find:focus-within{border-color:rgb(255 0 60 / .6)}
    .find input{border:0;outline:0;background:transparent;width:100%;color:#EEF3FA;font-size:13.5px}
    .find input::placeholder{color:#55617A}
    .find .x{font-size:17px;line-height:1;color:#8693A8;padding:0 2px} .find .x:hover{color:#EEF3FA}
    .chips{display:flex;flex-wrap:wrap;align-items:center;gap:4px;margin:9px 12px 0}
    .chips button{border:1px solid rgb(160 200 255 / .15);border-radius:999px;padding:2px 9px;font-size:11.5px;color:#8693A8}
    .chips button[aria-pressed="true"]{background:#EEF3FA;color:#05080D;border-color:#EEF3FA;font-weight:500}
    .chips .sep{width:1px;height:14px;background:rgb(160 200 255 / .15);margin:0 2px}
    .bd{overflow-y:auto;padding:12px 14px 16px;display:grid;gap:14px;align-content:start}
    .count{margin:0;font-size:12px;color:#8693A8}
    .res{display:grid;gap:2px;margin-top:-6px}
    .rs{display:grid;grid-template-columns:10px minmax(0,1fr);gap:1px 9px;align-items:center;text-align:left;border-radius:9px;padding:7px 9px}
    .rs .d{grid-row:span 2;align-self:start;margin-top:6px}
    .rs:hover,.rs.hi{background:#151D2A}
    .rs.hi{box-shadow:inset 2px 0 0 #FF003C}
    .nm{font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .nm mark{background:rgb(255 0 60 / .25);color:#fff;border-radius:3px;padding:0 1px}
    .sub{font-size:12px;color:#8693A8;display:flex;gap:4px;white-space:nowrap;overflow:hidden}
    .sub em{font-style:normal;margin-left:auto;padding-left:8px;color:#C9D3E2}
    .back{display:inline-flex;align-items:center;gap:4px;color:#8693A8;font-size:12.5px;justify-self:start;margin-bottom:-4px} .back:hover{color:#EEF3FA}
    .msg{border:1px solid rgb(160 200 255 / .1);border-radius:12px;padding:12px 14px;display:grid;gap:4px}
    .msg b{font-weight:600} .msg p{margin:0;color:#8693A8;font-size:13px}
    .msg.bad{border-color:rgb(255 77 106 / .4);background:rgb(255 77 106 / .07)}
    .row{display:flex;gap:8px;margin-top:6px}
    .skel{display:grid;gap:8px} .skel i{display:block;height:14px;border-radius:6px;background:linear-gradient(90deg,#121A26,#1A2433,#121A26);background-size:200% 100%}
    @media (prefers-reduced-motion:no-preference){.skel i{animation:sh 1.2s linear infinite}@keyframes sh{to{background-position:-200% 0}}}
    .ep{display:grid;gap:12px}
    .top{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
    .badge{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;border-radius:999px;padding:2px 9px;border:1px solid color-mix(in srgb,var(--c) 45%,transparent);background:color-mix(in srgb,var(--c) 13%,transparent)}
    .badge i{width:7px;height:7px;border-radius:50%;background:var(--c)}
    .chip{font-size:11.5px;color:#C9D3E2;border:1px solid rgb(160 200 255 / .18);border-radius:999px;padding:1px 8px}
    h2{margin:0;font-size:17px;font-weight:600;letter-spacing:-.01em;line-height:1.3}
    h2 a{text-decoration:none} h2 a:hover{text-decoration:underline}
    .rel{margin:-6px 0 0;font-size:13px;color:#C9D3E2}
    .late{color:#FF6B82!important} .today{color:#F6B64A!important}
    dl{display:grid;grid-template-columns:60px minmax(0,1fr);gap:5px 10px;margin:0;font-size:13px}
    dt{color:#8693A8} dd{margin:0;min-width:0;overflow-wrap:anywhere}
    .mut{color:#8693A8}
    .dates{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));border:1px solid rgb(160 200 255 / .1);border-radius:10px;overflow:hidden}
    .dates div{display:grid;gap:1px;padding:6px 7px;border-left:1px solid rgb(160 200 255 / .08)}
    .dates div:first-child{border-left:0}
    .dates span{font-size:10.5px;color:#8693A8;text-transform:uppercase;letter-spacing:.04em}
    .dates b{font-weight:600;font-size:12.5px;white-space:nowrap}
    .dates .empty b{color:#55617A;font-weight:400}
    .dates .due{background:rgb(255 255 255 / .04)} .dates .due.late{background:rgb(255 77 106 / .1)} .dates .due.today{background:rgb(246 182 74 / .1)}
    .links{display:flex;flex-wrap:wrap;gap:6px}
    .lk{border:1px solid rgb(160 200 255 / .16);border-radius:8px;padding:5px 9px;font-size:12px;font-weight:500;color:#BFE3FF;text-decoration:none}
    .lk:hover{background:#151D2A}
    .lbl{margin:0 0 6px;font-size:12px;color:#8693A8;font-weight:500}
    .moves{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:5px}
    .mv{display:flex;align-items:center;gap:6px;border:1px solid rgb(160 200 255 / .15);border-radius:8px;padding:6px 8px;font-size:12px;font-weight:500;text-align:left;min-height:34px}
    .mv i{width:7px;height:7px;border-radius:50%;background:var(--c);flex:none}
    .mv:hover:not([disabled]){background:color-mix(in srgb,var(--c) 14%,transparent);border-color:color-mix(in srgb,var(--c) 50%,transparent)}
    .mv[disabled]{opacity:.35;cursor:default}
    .composer{border:1px solid rgb(160 200 255 / .15);border-radius:12px;background:rgb(255 255 255 / .02)}
    .composer:focus-within{border-color:rgb(190 225 255 / .32)}
    textarea:focus-visible{outline:none}
    textarea{display:block;width:100%;border:0;outline:0;background:transparent;resize:vertical;min-height:80px;padding:9px 11px;line-height:1.45;color:#EEF3FA}
    textarea::placeholder{color:#55617A}
    .cbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;padding:7px 7px 7px 9px;border-top:1px solid rgb(160 200 255 / .08);font-size:11.5px;color:#8693A8}
    .cbar label{display:inline-flex;align-items:center;gap:4px;white-space:nowrap}
    .cbar input{accent-color:#FF003C;margin:0}
    .btn{border:1px solid rgb(160 200 255 / .18);border-radius:8px;padding:6px 11px;font-size:12.5px;font-weight:500;color:#C9D3E2}
    .btn:hover{background:#151D2A}
    .btn.sm{padding:3px 8px;font-size:11.5px}
    .btn.pri{background:#FF003C;border-color:#FF003C;color:#fff;margin-left:auto} .btn.pri:hover{background:#E00035} .btn.pri[disabled]{opacity:.5}
    .lock{display:flex;align-items:center;gap:10px;border:1px dashed rgb(160 200 255 / .2);border-radius:10px;padding:9px 11px;font-size:12.5px;color:#8693A8}
    .ups{display:grid;gap:8px}
    .up{border-left:2px solid rgb(160 200 255 / .15);padding:1px 0 1px 10px;font-size:12.5px}
    .up b{font-weight:600} .up small{margin-left:6px;color:#55617A;font:400 11px ui-monospace,Menlo,monospace}
    .up p{margin:2px 0 0;color:#C9D3E2;white-space:pre-line;overflow-wrap:anywhere}
    .others{display:grid;gap:4px;border-top:1px solid rgb(160 200 255 / .08);padding-top:12px}
    .oth{display:grid;grid-template-columns:8px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;border-radius:8px;padding:6px 8px;font-size:12.5px}
    .oth:hover{background:#151D2A}
    .oth span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .oth em{font-style:normal;color:#8693A8;font-size:11.5px;white-space:nowrap}
    .ft{border-top:1px solid rgb(160 200 255 / .08);padding:7px 14px;text-align:center}
    .ft button{font-size:11.5px;color:#55617A} .ft button:hover{color:#C9D3E2}
    .toast{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:10px;background:#EEF3FA;color:#05080D;padding:8px 8px 8px 12px;border-radius:10px;font-size:12.5px;box-shadow:0 10px 30px -8px #000}
    .toast.float{position:fixed;left:auto;right:24px;bottom:76px;max-width:340px}
    .toast span{flex:1}
    .toast button{font-weight:600;padding:2px 8px;border-radius:6px;background:rgb(0 0 0 / .1);color:#05080D}
    .toast.bad{background:#FF4D6A;color:#fff}
  `; }
})();
