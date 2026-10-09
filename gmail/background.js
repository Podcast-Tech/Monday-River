// Talks to the Monday API with AG's personal token. The content script in Gmail never sees the token.
const API = "https://api.monday.com/v2";

async function gql(query, variables) {
  const { token } = await chrome.storage.local.get("token");
  if (!token) throw Object.assign(new Error("Add your Monday token: click the River icon in the Chrome toolbar."), { code: "no_token" });
  let res;
  try {
    res = await fetch(API, { method: "POST", headers: { "Content-Type": "application/json", Authorization: token }, body: JSON.stringify({ query, variables: variables || {} }) });
  } catch (e) { throw Object.assign(new Error("Couldn't reach Monday. Check your connection."), { code: "network" }); }
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Monday rejected the token. Paste a fresh one from the River icon."), { code: "bad_token" });
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
