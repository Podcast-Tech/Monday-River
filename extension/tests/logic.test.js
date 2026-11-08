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
// Deadline = the last filled date column, not Draft (Mohamed Alyousuf: Draft 2 Nov, V1 10 Nov, In Review → due 10 Nov).
const ma = { stage: "In Review", name: "Mohamed Alyousuf - Session 29.10.26 (P#1)", available: "2026-10-30", draft: "2026-11-02", v1: "2026-11-10", final: null, publishing: null };
assert.strictEqual(L.nextDue(ma), "2026-11-10"); assert.strictEqual(L.nextDue(Object.assign({}, ma, { final: "2026-11-14" })), "2026-11-14");
assert.strictEqual(L.nextDue(Object.assign({}, ma, { v1: null })), "2026-11-02");
console.log("✓ Lateness counts from the last filled date column (V1 over Draft, Final over V1)");
const parked = L.normEpisode({ id: 5, name: "Parked - Session 01.11.26", column_values: [{ id: "status", text: "No Rush" }, { id: "date4", text: "2026-10-01" }] });
assert.ok(!L.tracked(parked) && L.tracked(ma), "No Rush is untracked, normal stages are tracked");
assert.ok(!L.COLS.includes("status_1"), "the Invoice column is never fetched");
console.log("✓ No Rush is untracked; the Invoice column isn't fetched");
console.log("All logic tests passed.");
