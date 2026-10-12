const $ = id => document.getElementById(id);
const say = (t, cls) => { $("st").textContent = t; $("st").className = cls || ""; };
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
function drawHidden(list) {
  $("hidden").innerHTML = list.length ? list.map(h => `<span>${esc(h)}<button data-h="${esc(h)}" title="Show River here again">×</button></span>`).join("") : `<p>None. Use "Hide the River button on…" at the bottom of the panel to hide it on a site.</p>`;
}
chrome.storage.local.get(["token", "everywhere", "hidden"], v => {
  if (v.token) { $("tok").placeholder = "Token saved. Paste a new one to replace it"; say("Connected.", "ok"); }
  $("everywhere").checked = v.everywhere !== false;
  drawHidden(v.hidden || []);
});
$("everywhere").onchange = e => chrome.storage.local.set({ everywhere: e.target.checked });
$("hidden").onclick = e => { const b = e.target.closest("[data-h]"); if (!b) return; chrome.storage.local.get("hidden", v => { const list = (v.hidden || []).filter(h => h !== b.dataset.h); chrome.storage.local.set({ hidden: list }); drawHidden(list); }); };
$("sc").onclick = e => { e.preventDefault(); chrome.tabs.create({ url: "chrome://extensions/shortcuts" }); };
$("save").onclick = async () => {
  const token = $("tok").value.trim();
  if (!token) return say("Paste your token first.", "bad");
  say("Testing…");
  try {
    const r = await fetch("https://api.monday.com/v2", { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ query: "query { me { name email } }" }) });
    const j = await r.json();
    if (!r.ok || j.errors || j.error_message || !j.data || !j.data.me) throw new Error((j.errors && j.errors[0].message) || j.error_message || "Monday rejected this token.");
    await chrome.storage.local.set({ token });
    $("tok").value = ""; say("Connected as " + j.data.me.name + ". Press Alt+Shift+R on any tab to search your tasks.", "ok");
  } catch (e) { say(e.message, "bad"); }
};
$("clear").onclick = async () => { await chrome.storage.local.remove("token"); say("Token removed."); };
