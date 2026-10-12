const assert = require("assert"), L = require("../logic.js"), F = require("./fixtures.js");
const info = L.readEmail({ subject: "Re: Brett King - Session 02.10.26 edit feedback", text: "Hi Abdullah, a few notes on the episode…",
  people: [{ email: "Brett@Provoke.fm", name: "Brett King" }, { email: "abdullah@poddster.com", name: "Abdullah Ghanem" }, { email: "production@poddster.com", name: "Production" }, { email: "no-reply@frame.io", name: "Frame.io" }] });
assert.deepStrictEqual(info.external.map(p => p.email), ["brett@provoke.fm"], "only the client's address counts");
assert.deepStrictEqual(info.episodes, ["Brett King - Session 02.10.26"], "episode named in the subject");
console.log("✓ reads the email: client address, skips Poddster/Frame.io, finds the episode name");

const clients = F.clients.items_page_by_column_values.items.map(x => ({ id: x.id, name: x.name, email: "brett@provoke.fm" }));
const terms = L.searchTerms(info, clients);
assert.deepStrictEqual(terms.map(t => t.q), ["Brett King - Session 02.10.26", "Brett King"]);
const eps = L.rank(F.episodes.boards[0].items_page.items.map(L.normEpisode), clients, info);
assert.strictEqual(eps[0].name, "Brett King - Session 02.10.26", "linked + named episode ranks above the guest appearance");
assert.strictEqual(eps[0].client, "Brett King"); assert.strictEqual(eps[0].share, "https://f.io/dqnFbeSa"); assert.strictEqual(eps[0].dropbox, "https://www.dropbox.com/scl/fo/vjmme/x");
console.log("✓ ranks Brett King - Session 02.10.26 first, Suvo's episode with Brett as guest second");

const noClient = L.searchTerms(L.readEmail({ subject: "Quick question", people: [{ email: "jane@acme.com", name: "Jane Doe" }] }), []);
assert.deepStrictEqual(noClient.map(t => t.q), ["Jane Doe"], "falls back to the sender's name");
const internal = L.readEmail({ subject: "Igor commented on Laila Khan - Session 28.09.26 (Highlights)", people: [{ email: "notifications@frame.io" }] });
assert.deepStrictEqual(internal.external, []); assert.deepStrictEqual(internal.episodes, ["Laila Khan - Session 28.09.26"]);
console.log("✓ falls back to sender name; Frame.io mails match by the episode named in the subject");

const ep = Object.assign({}, eps[0], { stage: "In Review", v1: null, final: null });
const p = L.correctionsPatch(ep); assert.strictEqual(p.slot[2], "V1"); assert.strictEqual(p.cv.date_mkx87nb3.date, L.addWorkdays(2));
assert.strictEqual(L.addWorkdays(2, "2026-10-08T10:00:00"), "2026-10-12", "Thu + 2 working days skips the weekend");
const laura = L.normEpisode({ id: 1, name: "X - Session", column_values: [{ id: "board_relation_mkxb8cpz", display_value: "BL - Someone", linked_item_ids: ["2"] }] });
assert.ok(laura.laura, "Laura's clients are flagged");
console.log("✓ Corrections fills the next empty date (V1), weekend skipped, Laura's clients flagged");
console.log("All logic tests passed.");
