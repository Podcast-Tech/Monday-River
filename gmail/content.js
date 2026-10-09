// River for Gmail: a floating panel that shows the Monday episode behind the email you have open.
(() => {
  if (window.__riverGmail) return; window.__riverGmail = true;
  const L = window.RiverLogic;
  const S = { key: null, info: null, clients: [], eps: [], selId: null, status: "idle", err: null, open: true, busy: false, draft: "", corr: true, mention: true,
    unlock: new Set(), q: "", searching: false, users: new Map(L.PEOPLE), toast: null, cache: new Map(), pos: null, why: "" };

  /* ---------- Monday through the background worker ---------- */
  async function gql(query, variables) {
    let r;
    try { r = await chrome.runtime.sendMessage({ type: "gql", query, variables }); }
    catch (e) { throw Object.assign(new Error("River was updated. Reload Gmail to reconnect."), { code: "reload" }); }
    if (!r || !r.ok) throw Object.assign(new Error((r && r.error) || "Monday didn't answer."), { code: (r && r.code) || "api" });
    return r.data;
  }

  /* ---------- reading the open email ---------- */
  function readThread() {
    const main = document.querySelector('[role="main"]'); if (!main) return null;
    const subj = main.querySelector("h2.hP"); if (!subj) return null;
    const people = [...main.querySelectorAll("span[email]")].map(s => ({ email: s.getAttribute("email"), name: s.getAttribute("name") || s.textContent }));
    return { subject: subj.textContent.trim(), people, main };
  }
  function check() {
    const t = readThread();
    const key = t ? t.subject + "|" + [...new Set(t.people.map(p => (p.email || "").toLowerCase()))].sort().join(",") : null;
    if (key === S.key) return;
    S.key = key; S.unlock.clear(); S.draft = "";
    if (!t) { S.status = S.q ? S.status : "idle"; S.info = null; render(); return; }
    S.q = ""; S.info = L.readEmail({ subject: t.subject, people: t.people, text: (t.main.innerText || "").slice(0, 8000) });
    lookup(S.key, S.info);
  }

  /* ---------- matching ---------- */
  async function lookup(key, info, force) {
    const hit = !force && S.cache.get(key);
    if (hit && Date.now() - hit.at < 120000) { Object.assign(S, hit.state); render(); return; }
    S.status = "loading"; S.err = null; S.eps = []; S.clients = []; S.selId = null; render();
    try {
      let clients = [];
      const emails = info.external.map(p => p.email);
      if (emails.length) {
        const d = await gql(L.QUERIES.clients, { v: emails });
        clients = ((d.items_page_by_column_values || {}).items || []).map(x => {
          const em = ((x.column_values || []).find(c => c.id === "text_mkxbach4") || {}).text || "";
          return { id: String(x.id), name: x.name, email: em.toLowerCase() };
        });
      }
      const terms = L.searchTerms(info, clients);
      const results = await Promise.all(terms.map(t => gql(L.QUERIES.episodes, { q: [t.q] }).then(d => ({ t, items: (((d.boards || [])[0] || {}).items_page || {}).items || [] }), () => ({ t, items: [] }))));
      const byId = new Map(); results.forEach(r => r.items.forEach(x => { if (!byId.has(String(x.id))) byId.set(String(x.id), L.normEpisode(x)); }));
      const eps = L.rank([...byId.values()], clients, info);
      await nameUsers(eps);
      if (key !== S.key) return;
      const state = { clients, eps, selId: eps[0] ? eps[0].id : null, status: eps.length ? "ok" : "none", err: null,
        why: clients.length ? clients.map(c => L.stripPrefix(c.name)).join(", ") : terms.length ? terms[0].why : "" };
      S.cache.set(key, { at: Date.now(), state }); Object.assign(S, state);
    } catch (e) { if (key !== S.key) return; S.status = "error"; S.err = e; }
    render();
  }
  async function search(q) {
    q = q.trim(); if (q.length < 2) return;
    S.status = "loading"; S.err = null; S.why = "search: " + q; render();
    try {
      const d = await gql(L.QUERIES.episodes, { q: [q] });
      const eps = L.rank(((((d.boards || [])[0] || {}).items_page || {}).items || []).map(L.normEpisode), [], { episodes: [] });
      await nameUsers(eps);
      S.eps = eps; S.selId = eps[0] ? eps[0].id : null; S.status = eps.length ? "ok" : "none";
    } catch (e) { S.status = "error"; S.err = e; }
    render();
  }
  async function nameUsers(eps) {
    const ids = [...new Set(eps.flatMap(e => e.updates.map(u => u.by)).filter(id => id && !S.users.has(id)))];
    if (!ids.length) return;
    try { const d = await gql(L.QUERIES.users, { ids }); (d.users || []).forEach(u => S.users.set(String(u.id), u.name)); } catch (_) {}
  }
  async function refreshOne(id) {
    const ep = S.eps.find(e => e.id === id); if (!ep) return;
    try {
      const d = await gql(L.QUERIES.episodes, { q: [ep.name] });
      const x = ((((d.boards || [])[0] || {}).items_page || {}).items || []).find(i => String(i.id) === id);
      if (x) { const n = L.normEpisode(x); await nameUsers([n]); Object.assign(ep, n); S.cache.delete(S.key); render(); }
    } catch (_) {}
  }

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
      S.cache.delete(S.key);
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
      S.draft = ""; toast(msg); S.cache.delete(S.key);
      refreshOne(ep.id);
    } catch (e) { toast(e.code === "network" ? "Monday didn't confirm. Check the task before posting again." : e.message, null, true); }
    S.busy = false; render();
  }

  /* ---------- UI ---------- */
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const host = document.createElement("div"); host.id = "poddster-river";
  host.style.cssText = "position:fixed;z-index:2147483000;right:24px;bottom:24px;";
  const root = host.attachShadow({ mode: "open" });
  document.documentElement.appendChild(host);
  ["keydown", "keypress", "keyup"].forEach(t => host.addEventListener(t, e => e.stopPropagation()));
  root.innerHTML = `<style>${CSS()}</style><div id="w"></div>`;
  const W = root.getElementById("w");
  try { chrome.storage.local.get(["open", "pos"], v => { if (v.open === false) S.open = false; if (v.pos) place(v.pos); render(); }); } catch (_) {}
  function place(p) { S.pos = p; host.style.right = Math.max(8, Math.min(window.innerWidth - 80, p.right)) + "px"; host.style.bottom = Math.max(8, Math.min(window.innerHeight - 60, p.bottom)) + "px"; }

  const LOGO = `<svg viewBox="0 0 40 40" width="22" height="22" aria-hidden="true"><rect width="40" height="40" rx="10" fill="#FF003C"/><rect x="12" y="8" width="16" height="18" rx="8" fill="none" stroke="#fff" stroke-width="3.6"/><path d="M13.8 22v11" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/></svg>`;
  const ICON = {
    min: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/></svg>`,
    sync: `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5"/></svg>`,
    out: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>`,
    find: `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>`
  };
  const sel = () => S.eps.find(e => e.id === S.selId) || null;

  function render() {
    const f = root.activeElement, fid = f && f.id, ss = f && f.selectionStart, se = f && f.selectionEnd;
    draw();
    if (fid) { const n = root.getElementById(fid); if (n) { n.focus(); try { n.setSelectionRange(ss, se); } catch (_) {} } }
  }
  function draw() {
    const ep = sel();
    if (!S.open) {
      const dot = ep ? `<i style="background:${L.COLOR[ep.stage] || "#A68CFF"}"></i>` : "";
      const label = S.status === "loading" ? "Looking up…" : ep ? `${esc(ep.client || ep.name.split(" - ")[0])} · ${esc(ep.stage)}` : S.status === "none" ? "No Monday task" : "River";
      W.innerHTML = `<button class="pill ${ep && L.isLate(ep) ? "late" : ""}" data-a="open" title="Open River">${LOGO}${dot}<span>${label}</span>${S.eps.length > 1 ? `<em>${S.eps.length}</em>` : ""}</button>${toastHtml()}`;
      return;
    }
    const enter = S.justOpened; S.justOpened = false;
    W.innerHTML = `<section class="panel${enter ? " enter" : ""}" aria-label="River for Gmail">
      <header class="hd" data-drag>${LOGO}<div class="ttl"><b>River</b><span>${esc(context())}</span></div>
        <button class="ib" data-a="sync" title="Look up again">${ICON.sync}</button><button class="ib" data-a="min" title="Minimise">${ICON.min}</button></header>
      <div class="find">${ICON.find}<input id="q" placeholder="Find any episode on Monday" value="${esc(S.q)}" autocomplete="off"></div>
      <div class="bd">${body(ep)}</div>${toastHtml()}</section>`;
  }
  function context() {
    if (S.status === "loading") return "Looking up on Monday…";
    if (S.why && S.status === "ok") return "Matched " + S.why;
    if (S.info && S.info.subject) return S.info.subject;
    return "Open an email to see its task";
  }
  function body(ep) {
    if (S.status === "error") {
      const tokenish = ["no_token", "bad_token"].includes(S.err && S.err.code);
      return `<div class="msg bad"><b>${tokenish ? "Connect Monday" : "Couldn't load the task"}</b><p>${esc(S.err && S.err.message)}</p>
        <div class="row">${tokenish ? `<button class="btn pri" data-a="options">Add Monday token</button>` : `<button class="btn" data-a="sync">Try again</button>`}</div></div>`;
    }
    if (S.status === "loading") return `<div class="skel"><i></i><i></i><i style="width:60%"></i></div>`;
    if (S.status === "idle") return `<div class="msg"><b>Open an email</b><p>River finds the Monday episode from the client's email address, their name, or an episode named in the email. You can also search above.</p></div>`;
    if (S.status === "none") {
      const tried = S.info ? [...S.info.external.map(p => p.email), ...S.info.episodes].slice(0, 4) : [];
      return `<div class="msg"><b>No Monday task for this email</b><p>${tried.length ? "Checked " + esc(tried.join(", ")) + "." : "No client address in this thread."} Search above to find it by name.</p></div>`;
    }
    const others = S.eps.filter(e => e !== ep);
    return card(ep) + (others.length ? `<div class="others"><p class="lbl">${others.length} more on Monday</p>${others.slice(0, 8).map(e => { const r = L.rel(e);
      return `<button class="oth" data-ep="${esc(e.id)}"><i style="background:${L.COLOR[e.stage] || "#A68CFF"}"></i><span>${esc(e.name)}</span><em class="${r.cls}">${esc(e.stage)}</em></button>`; }).join("")}</div>` : "");
  }
  function card(ep) {
    const r = L.rel(ep), locked = ep.laura && !S.unlock.has(ep.id), mid = L.editorId(ep.editor), nxt = L.DATE_COLS.find(([k]) => !ep[k]);
    const lk = (u, l) => u ? `<a class="lk" href="${esc(u)}" target="_blank" rel="noopener">${l}</a>` : "";
    const row = (k, v, cls) => `<dt>${k}</dt><dd class="${cls || ""}">${v}</dd>`;
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
        <div class="composer"><textarea id="note" placeholder="Paste or add the client's notes from this email…">${esc(S.draft)}</textarea>
          <div class="cbar"><button class="btn sm" data-a="grab" title="Adds the text you've highlighted in the email">+ Selected text</button>
            <label title="Also fills the next empty deadline with 2 working days from today"><input type="checkbox" id="corr" ${S.corr ? "checked" : ""}> Corrections${nxt ? ", " + nxt[2] + " " + L.short(L.addWorkdays(2)) : ""}</label>
            <label><input type="checkbox" id="mention" ${mid && S.mention ? "checked" : ""} ${mid ? "" : "disabled"}> @${esc(L.firstName(ep.editor) || "editor")}</label>
            <button class="btn pri" data-a="post" ${S.busy ? "disabled" : ""}>${S.busy ? "Posting" : "Post"}</button></div></div></div>`}
      ${ep.updates.length ? `<div><p class="lbl">Latest on Monday</p><div class="ups">${ep.updates.map(u => `<div class="up"><b>${esc(S.users.get(u.by) || "Someone")}</b><small>${esc(L.ago(u.at))}</small><p>${esc(u.body.length > 260 ? u.body.slice(0, 260) + "…" : u.body)}</p></div>`).join("")}</div></div>` : ""}
    </article>`;
  }
  function toastHtml() { const t = S.toast; return t ? `<div class="toast ${t.bad ? "bad" : ""}" role="status"><span>${esc(t.text)}</span>${t.undo ? `<button data-a="undo">Undo</button>` : ""}</div>` : ""; }
  let tt; function toast(text, undo, bad) { S.toast = { text, undo, bad }; clearTimeout(tt); tt = setTimeout(() => { S.toast = null; render(); }, undo ? 7000 : 4000); render(); }

  /* Remember the last text highlighted in the email, because clicking our button clears the page selection. */
  let lastSel = "";
  document.addEventListener("selectionchange", () => { const s = String(window.getSelection() || "").trim(); if (s) lastSel = s; });

  W.addEventListener("click", e => {
    const a = e.target.closest("[data-a]"), st = e.target.closest("[data-stage]"), o = e.target.closest("[data-ep]");
    if (o) { S.selId = o.dataset.ep; S.draft = ""; render(); W.querySelector(".bd") && (W.querySelector(".bd").scrollTop = 0); return; }
    if (st && !st.disabled) { setStage(sel(), st.dataset.stage); return; }
    if (!a) return;
    const k = a.dataset.a, ep = sel();
    if (k === "open" || k === "min") { S.open = k === "open"; S.justOpened = S.open; try { chrome.storage.local.set({ open: S.open }); } catch (_) {} render(); }
    else if (k === "sync") { if (S.q) search(S.q); else if (S.info) lookup(S.key, S.info, true); else check(); }
    else if (k === "options") { try { chrome.runtime.sendMessage({ type: "options" }); } catch (_) {} }
    else if (k === "unlock" && ep) { S.unlock.add(ep.id); render(); }
    else if (k === "post" && ep) postNote(ep);
    else if (k === "undo" && S.toast && S.toast.undo) { const f = S.toast.undo; S.toast = null; f(); }
    else if (k === "grab") { if (!lastSel) { toast("Highlight the client's notes in the email first.", null, true); return; } S.draft = (S.draft ? S.draft.trimEnd() + "\n" : "") + lastSel; render(); const n = W.querySelector("#note"); if (n) { n.focus(); n.selectionStart = n.value.length; } }
  });
  W.addEventListener("input", e => { if (e.target.id === "note") S.draft = e.target.value; if (e.target.id === "q") S.q = e.target.value; });
  W.addEventListener("change", e => { if (e.target.id === "corr") S.corr = e.target.checked; if (e.target.id === "mention") S.mention = e.target.checked; });
  W.addEventListener("keydown", e => {
    if (e.target.id === "q" && e.key === "Enter") { e.preventDefault(); search(S.q); }
    if (e.target.id === "q" && e.key === "Escape") { S.q = ""; S.key = null; check(); }
    if (e.target.id === "note" && (e.metaKey || e.ctrlKey) && e.key === "Enter") { e.preventDefault(); const ep = sel(); if (ep) postNote(ep); }
  });
  /* Drag the panel by its header; the spot is remembered. */
  W.addEventListener("pointerdown", e => {
    const h = e.target.closest("[data-drag]"); if (!h || e.target.closest("button")) return;
    const r0 = { right: parseFloat(host.style.right), bottom: parseFloat(host.style.bottom) }, x0 = e.clientX, y0 = e.clientY;
    const mv = ev => place({ right: r0.right - (ev.clientX - x0), bottom: r0.bottom - (ev.clientY - y0) });
    const up = () => { window.removeEventListener("pointermove", mv); window.removeEventListener("pointerup", up); try { chrome.storage.local.set({ pos: S.pos }); } catch (_) {} };
    window.addEventListener("pointermove", mv); window.addEventListener("pointerup", up);
  });

  window.addEventListener("hashchange", () => setTimeout(check, 300));
  setInterval(check, 1200);
  render(); check();

  function CSS() { return `
    :host{all:initial}
    *{box-sizing:border-box}
    #w{font:400 13.5px/1.45 "Geist",Inter,ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#EEF3FA;-webkit-font-smoothing:antialiased}
    button,input,textarea{font:inherit;color:inherit}
    button{cursor:pointer;background:none;border:0;padding:0}
    a{color:inherit}
    :focus-visible{outline:2px solid #FF003C;outline-offset:2px;border-radius:6px}
    .tnum{font-variant-numeric:tabular-nums}
    .pill{display:flex;align-items:center;gap:8px;padding:7px 14px 7px 8px;border-radius:999px;background:#0A0F17;border:1px solid rgb(160 200 255 / .18);box-shadow:0 12px 30px -10px rgb(0 0 0 / .6);max-width:340px;color:#EEF3FA}
    .pill:hover{background:#121A26}
    .pill i{width:8px;height:8px;border-radius:50%;flex:none}
    .pill span{font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .pill em{font:600 11px ui-monospace,Menlo,monospace;font-style:normal;background:#1E2836;border-radius:999px;padding:1px 7px;color:#C9D3E2}
    .pill.late{border-color:rgb(255 77 106 / .6)}
    @media (prefers-reduced-motion:no-preference){.pill.late i{animation:pulse 1.8s ease-out infinite}@keyframes pulse{50%{box-shadow:0 0 0 5px rgb(255 77 106 / .25)}}}
    .panel{width:380px;max-height:min(720px,calc(100vh - 48px));display:flex;flex-direction:column;background:#0A0F17;border:1px solid rgb(160 200 255 / .15);border-radius:18px;box-shadow:0 30px 70px -20px rgb(0 0 0 / .75),0 0 0 1px rgb(0 0 0 / .4);overflow:hidden;position:relative}
    @media (prefers-reduced-motion:no-preference){.panel.enter{animation:rise .18s ease-out}@keyframes rise{from{transform:translateY(8px);opacity:.6}}}
    .hd{display:flex;align-items:center;gap:10px;padding:11px 10px 11px 14px;border-bottom:1px solid rgb(160 200 255 / .08);cursor:grab;user-select:none;background:linear-gradient(180deg,#0E1622,#0A0F17)}
    .ttl{flex:1;min-width:0;display:grid}
    .ttl b{font-size:14px;font-weight:600;letter-spacing:-.01em}
    .ttl span{font-size:12px;color:#8693A8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .ib{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;color:#8693A8;flex:none;text-decoration:none}
    .ib:hover{background:#151D2A;color:#EEF3FA}
    .ib.sm{width:24px;height:24px;margin-left:auto}
    .find{display:flex;align-items:center;gap:8px;margin:10px 12px 0;border:1px solid rgb(160 200 255 / .15);border-radius:999px;padding:6px 12px;color:#8693A8}
    .find input{border:0;outline:0;background:transparent;width:100%;color:#EEF3FA;font-size:13px}
    .find input::placeholder{color:#55617A}
    .bd{overflow-y:auto;padding:12px 14px 16px;display:grid;gap:14px;align-content:start}
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
    .oth i{width:7px;height:7px;border-radius:50%}
    .oth span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
    .oth em{font-style:normal;color:#8693A8;font-size:11.5px;white-space:nowrap}
    .toast{position:absolute;left:12px;right:12px;bottom:12px;display:flex;align-items:center;gap:10px;background:#EEF3FA;color:#05080D;padding:8px 8px 8px 12px;border-radius:10px;font-size:12.5px;box-shadow:0 10px 30px -8px #000}
    .pill + .toast{position:fixed;left:auto;right:24px;bottom:72px;max-width:340px}
    .toast span{flex:1}
    .toast button{font-weight:600;padding:2px 8px;border-radius:6px;background:rgb(0 0 0 / .1);color:#05080D}
    .toast.bad{background:#FF4D6A;color:#fff}
  `; }
})();
