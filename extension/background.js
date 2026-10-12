// River for Chrome: talks to Monday with AG's token, and opens River from the toolbar icon, Alt+Shift+R, the right-click menu and the address bar ("rv").
importScripts("logic.js");
const L = self.RiverLogic;
const API = "https://api.monday.com/v2";

async function gql(query, variables) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw Object.assign(new Error("Add your Monday token: open River's settings (the gear) and paste it."), { code: "no_token" });
  let res;
  try {
    res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ query, variables: variables || {} }) });
  } catch (e) { throw Object.assign(new Error("Couldn't reach Monday. Check your connection."), { code: "network" }); }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Monday rejected the token. Paste a fresh one in River's settings."), { code: "bad_token" });
  if (res.status === 429) throw Object.assign(new Error("Monday is rate limiting. Try again in a minute."), { code: "rate" });
  const j = await res.json().catch(() => ({}));
  if (j.errors && j.errors.length) throw Object.assign(new Error(j.errors.map(e => e.message).join("; ")), { code: "api" });
  if (j.error_message) throw Object.assign(new Error(j.error_message), { code: j.error_code || "api" });
  return j.data;
}

chrome.runtime.onMessage.addListener((msg, _sender, send) => {
  if (msg && msg.type === "gql") {
    gql(msg.query, msg.variables).then(data => send({ ok: true, data }), e => send({ ok: false, error: e.message, code: e.code || "api" }));
    return true;
  }
  if (msg && msg.type === "options") { chrome.runtime.openOptionsPage(); return false; }
});

/* Open or close River in a tab. Tabs opened before the extension was installed get the panel injected; pages Chrome protects
   (chrome://, the Web Store, the new-tab page) open River as its own tab instead. */
const riverPage = q => chrome.tabs.create({ url: chrome.runtime.getURL("river.html") + (q ? "?q=" + encodeURIComponent(q) : "") });
async function toggle(tab, q) {
  if (!tab || !tab.id || !/^https?:/.test(tab.url || "")) return riverPage(q);
  try { await chrome.tabs.sendMessage(tab.id, { type: "toggle", q }); return; } catch (_) {}
  try {
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["logic.js", "content.js"] });
    await new Promise(r => setTimeout(r, 150));
    await chrome.tabs.sendMessage(tab.id, { type: "toggle", q });
  } catch (_) { riverPage(q); }
}
chrome.action.onClicked.addListener(tab => toggle(tab));
chrome.commands.onCommand.addListener(async cmd => { if (cmd === "toggle-river") { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); toggle(tab); } });

chrome.runtime.onInstalled.addListener(d => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({ id: "river-find", title: "Find “%s” in River", contexts: ["selection"] });
    chrome.contextMenus.create({ id: "river-open", title: "Open River", contexts: ["page", "action"] });
  });
  if (d.reason === "install") chrome.runtime.openOptionsPage();
});
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "river-find") toggle(tab, (info.selectionText || "").trim().slice(0, 80));
  if (info.menuItemId === "river-open") toggle(tab);
});

/* Address bar: type "rv", a space, then a client or episode. Suggestions come from your own tasks first, then everyone's. */
let mine = null, mineAt = 0;
async function myTasks() {
  if (mine && Date.now() - mineAt < 120000) return mine;
  const d = await gql(L.QUERIES.mine);
  mine = ((((d.boards || [])[0] || {}).items_page || {}).items || []).map(L.normEpisode); mineAt = Date.now();
  return mine;
}
const xml = s => String(s || "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[c]));
const suggestion = e => ({ content: e.url, description: `${xml(e.name)} <dim>· ${xml(e.stage)}${e.editor ? " · " + xml(L.firstName(e.editor)) : ""} · ${xml(L.rel(e).txt)}</dim>` });
let omniSeq = 0;
chrome.omnibox.setDefaultSuggestion({ description: "Search your Monday tasks in River" });
chrome.omnibox.onInputChanged.addListener(async (text, suggest) => {
  const seq = ++omniSeq, q = text.trim();
  try {
    let list = L.matchLocal(await myTasks(), q, "all");
    if (list.length < 5 && q.length >= 2) {
      const d = await gql(L.QUERIES.find, { q: [q] });
      const seen = new Set(list.map(e => e.id));
      list = list.concat(((((d.boards || [])[0] || {}).items_page || {}).items || []).map(L.normEpisode).filter(e => !seen.has(e.id)));
    }
    if (seq !== omniSeq) return;
    chrome.omnibox.setDefaultSuggestion({ description: list.length ? `Open River and search “${xml(q)}” (${list.length} found)` : `No tasks match “${xml(q)}”. Press Enter to search in River` });
    suggest(list.slice(0, 6).map(suggestion));
  } catch (e) { if (seq === omniSeq) chrome.omnibox.setDefaultSuggestion({ description: xml(e.message) }); }
});
chrome.omnibox.onInputEntered.addListener(async (text, disposition) => {
  const t = text.trim();
  if (/^https:\/\/[\w.-]*monday\.com\//.test(t)) {
    if (disposition === "currentTab") { const [tab] = await chrome.tabs.query({ active: true, currentWindow: true }); return chrome.tabs.update(tab.id, { url: t }); }
    return chrome.tabs.create({ url: t });
  }
  riverPage(t);
});
