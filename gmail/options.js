const $ = id => document.getElementById(id);
const say = (t, cls) => { $("st").textContent = t; $("st").className = cls || ""; };
chrome.storage.local.get("token", v => { if (v.token) { $("tok").placeholder = "Token saved. Paste a new one to replace it"; say("Connected. Open an email in Gmail.", "ok"); } });
$("save").onclick = async () => {
  const token = $("tok").value.trim();
  if (!token) return say("Paste your token first.", "bad");
  say("Testing…");
  try {
    const r = await fetch("https://api.monday.com/v2", { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ query: "query { me { name email } }" }) });
    const j = await r.json();
    if (!r.ok || j.errors || j.error_message || !j.data || !j.data.me) throw new Error((j.errors && j.errors[0].message) || j.error_message || "Monday rejected this token.");
    await chrome.storage.local.set({ token });
    $("tok").value = ""; say("Connected as " + j.data.me.name + ". Reload Gmail and open an email.", "ok");
  } catch (e) { say(e.message, "bad"); }
};
$("clear").onclick = async () => { await chrome.storage.local.remove("token"); say("Token removed."); };
