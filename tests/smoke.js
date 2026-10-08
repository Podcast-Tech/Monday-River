// Smoke test: runs the page script against a fake DOM and a mocked monday.com connector.
// Usage: node tests/smoke.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const html = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const src = html.match(/<script>([\s\S]*?)<\/script>/)[1].replace(/start\(\);\s*$/, "");

const el = () => ({ innerHTML: "", textContent: "", hidden: false, className: "", style: {}, value: "", disabled: false,
  classList: { contains() { return false; }, toggle() {} }, addEventListener() {}, querySelector() { return null; }, focus() {},
  getBoundingClientRect() { return { left: 0, top: 0, width: 1400, height: 520, right: 0 }; },
  setPointerCapture() {}, releasePointerCapture() {}, offsetWidth: 100, offsetHeight: 40 });
const els = {};
global.document = { getElementById: id => els[id] || (els[id] = el()), querySelector: () => el(), querySelectorAll: () => [], addEventListener() {}, activeElement: null };
global.window = {}; global.setInterval = () => 0; global.setTimeout = () => 0; global.clearTimeout = () => 0;
global.localStorage = { getItem() { return null; }, setItem() {} };

const test = new Function("els", "assert", src + `
  return (async () => {
    const calls = [];
    mcp = { invalidate: async () => {}, callTool: async (server, tool, input) => {
      calls.push({ tool, input });
      if (tool === "get_board_items_page" && input.boardId === CLIENTS_BOARD) return { payload: { items: [{ id: "77", name: "AG - Test Client" }] } };
      if (tool === "create_item") return { payload: { id: "13200000001" } };
      if (tool === "get_board_activity") return { payload: { message: "Board activity retrieved", data: input.itemIds.map(id => ({ event: "update_column_value", user_id: "43400381", entity: "pulse", created_at: "17909535157344256",
        data: JSON.stringify({ pulse_id: id, column_id: "status", value: { label: { text: "In Review" } } }) })) } };
      if (tool === "list_events" && input.calendarId === "production@poddster.com") return { payload: { events: [
        { id: "e1", summary: "Brett King | Poddster Booking", status: "confirmed", htmlLink: "https://calendar.google.com/event?eid=e1",
          start: { dateTime: "2026-10-02T14:00:00+04:00" }, end: { dateTime: "2026-10-02T16:00:00+04:00" }, organizer: { displayName: "Al Barsha Studio 2" },
          description: "Order ID: 4821<br>Customer: Brett King<br>Client email: brett@example.com<br>Seats: 2<br>Setup: 2 cameras<br>Services:<br>- Video podcast 2h<br>- Full episode edit<br>Additional Services:<br>3 highlights<br>Any special requests or note?: Bring the blue backdrop" },
        { id: "e2", summary: "Someone Else | Poddster Booking", start: { dateTime: "2026-10-02T10:00:00+04:00" }, description: "Order ID: 1" }] } };
      if (tool === "list_events") return { payload: { events: [] } };
      return { payload: {} };
    } };
    const d = n => { const x = new Date(); x.setDate(x.getDate() + n); return isoOf(x); };
    const iso = n => new Date(Date.now() + n * 864e5).toISOString();
    const st = ["Queue","Assigned","In Process","In Review","Corrections","Client Review","Done"];
    S.items = Array.from({ length: 40 }, (_, k) => norm({ id: String(1000 + k), name: "Client " + k + " - Session", updated_at: iso(-(k % 10)), created_at: iso(-(k % 9)),
      column_values: { status: st[k % 7], person: "Igor Garčev", date: d(-5), date4: d((k % 12) - 5), board_relation_mkxb8cpz: [{ id: "77", name: "AG - Client " + k }] } }));
    S.loading = false; S.storedAt = Date.now();

    render();
    assert.ok(!/NaN/.test(els.river.innerHTML), "river has NaN coordinates");
    assert.strictEqual((els.river.innerHTML.match(/<g class="fish /g) || []).length, S.items.filter(i => FLOW.includes(i.stage)).length, "one dot per open episode");
    const nNames = (els.river.innerHTML.match(/<text class="fish-l/g) || []).length, nDots = S.items.filter(i => FLOW.includes(i.stage)).length;
    assert.ok(nNames >= nDots * 0.6, "most dots carry a name (" + nNames + "/" + nDots + ")");
    assert.strictEqual((els.river.innerHTML.match(/<text class="ini"/g) || []).length, nDots, "every dot has initials");
    console.log("✓ Names on", nNames, "of", nDots, "dots, initials on all");
    console.log("✓ river renders", (els.river.innerHTML.match(/<g class="fish /g) || []).length, "episodes");

    const it = S.items.find(i => i.stage === "In Review"); it.v1 = null; it.final = null;
    await setStage(it, "Corrections");
    const cv = JSON.parse(calls[calls.length - 1].input.columnValues);
    assert.strictEqual(cv.status.label, "Corrections"); assert.strictEqual(cv.date_mkx87nb3.date, addWorkdays(2));
    console.log("✓ Corrections fills next empty date (V1 =", cv.date_mkx87nb3.date + ")");

    openAdd(); await loadClients();
    Object.assign(S.form, { client: "Test Client", clientId: "77", editor: "Igor Garčev" }); S.form.name = autoName(S.form);
    await createTask();
    const ci = calls.find(c => c.tool === "create_item").input, ccv = JSON.parse(ci.columnValues);
    assert.strictEqual(ccv.date.date, todayISO()); assert.strictEqual(ccv.date4.date, addWorkdays(2)); assert.strictEqual(ccv.status.label, "Assigned");
    console.log("✓ Add task sets Available today, Draft", ccv.date4.date + ", Assigned");

    const mover = S.items.find(i => i.stage === "Assigned");
    S.drag = { id: mover.id, from: mover.stage, sx: 0, sy: 0, x: 0, y: 0, moved: true }; S.dropZone = "In Process";
    endDrag({ pointerId: 1 }, false); await new Promise(r => r());
    assert.ok(calls.some(c => c.tool === "change_item_column_values" && /In Process/.test(c.input.columnValues)), "drag moves stage");
    console.log("✓ Drag across a gate changes stage");

    // Clear the gates: most overdue first, actions reuse setStage/postNote, Undo puts the card back.
    const late = lateList();
    assert.ok(late.length >= 3, "sample has overdue episodes");
    openGates();
    assert.deepStrictEqual(S.gates.ids, late.map(i => i.id), "walks the overdue list");
    for (let k = 1; k < late.length; k++) assert.ok(overdueBy(late[k - 1]) >= overdueBy(late[k]), "most overdue first");
    assert.ok(els.gates.innerHTML.includes("0 of " + late.length + " cleared"), "progress shows 0 cleared");
    let cur = gateItem();
    if (cur.stage === "Corrections") { await gateAct("skip"); cur = gateItem(); }
    cur.v1 = null; cur.final = null; const curDraft = cur.draft;
    const before = calls.length;
    await gateAct("corr");
    const gcv = JSON.parse(calls[before].input.columnValues);
    assert.strictEqual(gcv.status.label, "Corrections"); assert.strictEqual(gcv.date_mkx87nb3.date, addWorkdays(2));
    assert.strictEqual(S.gates.cleared, 1); assert.ok(els.gates.innerHTML.includes("1 of "), "progress moves on");
    assert.notStrictEqual(gateItem().id, cur.id, "next card shown");
    console.log("✓ Gates: Corrections from a card fills V1 and advances");
    els.undo.onclick(); await new Promise(r => r()); await new Promise(r => r());
    const ucv = JSON.parse(calls[calls.length - 1].input.columnValues);
    assert.strictEqual(ucv.date_mkx87nb3, null, "Undo clears the auto date"); assert.notStrictEqual(ucv.status.label, "Corrections");
    assert.strictEqual(S.gates.cleared, 0); assert.strictEqual(gateItem().id, cur.id, "Undo brings the card back");
    assert.strictEqual(cur.draft, curDraft);
    console.log("✓ Gates: Undo clears the date and puts the card back");
    const nudgee = S.items.find(i => i.stage === "In Process" && isLate(i));
    openGates([nudgee.id]); nudgee.editor = "Igor Garčev";
    await gateAct("nudge");
    const up = calls[calls.length - 1];
    assert.strictEqual(up.tool, "create_update"); assert.ok(up.input.body.includes(esc(nudgee.name)));
    assert.deepStrictEqual(JSON.parse(up.input.mentionsList), [{ id: EDITOR_IDS.igor, type: "User" }]);
    assert.strictEqual(nudgee.stage, "In Process", "a nudge doesn't change the stage");
    assert.ok(els.gates.innerHTML.includes("Gates cleared"), "finish state");
    console.log("✓ Gates: Nudge posts a mention without changing stage, then finishes");
    openGates(late.slice(0, 2).map(i => i.id)); await gateAct("skip"); await gateAct("skip");
    assert.ok(els.gates.innerHTML.includes("Go through the 2 skipped"));
    closeGates(); assert.strictEqual(S.gates, null);
    console.log("✓ Gates: Skip leads to a finish state offering the skipped ones");

    // Drag to reassign: drop on an editor chip writes person; Queue also becomes Assigned; Undo restores the editor.
    const lastWrite = () => JSON.parse(calls.filter(c => c.tool === "change_item_column_values").pop().input.columnValues);
    const flush = async () => { for (let k = 0; k < 4; k++) await new Promise(r => r()); };
    const queued = S.items.find(i => i.stage === "Queue"); queued.editor = "";
    S.drag = { id: queued.id, from: "Queue", sx: 0, sy: 0, x: 0, y: 0, moved: true }; S.dropEditor = "Stipe Majić";
    endDrag({ pointerId: 1 }, false); await flush();
    let rcv = lastWrite();
    assert.deepStrictEqual(rcv.person, { personsAndTeams: [{ id: 61381904, kind: "person" }] }); assert.strictEqual(rcv.status.label, "Assigned");
    assert.strictEqual(queued.stage, "Assigned"); assert.strictEqual(queued.editor, "Stipe Majić");
    console.log("✓ Reassign: Queue episode dropped on Stipe gets person + Assigned");
    const rev = S.items.find(i => i.stage === "In Review"); rev.editor = "Igor Garčev";
    S.drag = { id: rev.id, from: "In Review", sx: 0, sy: 0, x: 0, y: 0, moved: true }; S.dropEditor = "Georges Saliba";
    endDrag({ pointerId: 1 }, false); await flush();
    rcv = lastWrite();
    assert.strictEqual(rcv.person.personsAndTeams[0].id, 36795459); assert.ok(!rcv.status, "past Assigned keeps its status");
    els.undo.onclick(); await flush();
    rcv = lastWrite();
    assert.deepStrictEqual(rcv.person, { personsAndTeams: [{ id: 43400381, kind: "person" }] }); assert.ok(!rcv.status);
    assert.strictEqual(rev.editor, "Igor Garčev"); assert.strictEqual(rev.stage, "In Review");
    console.log("✓ Reassign: In Review keeps its stage, Undo restores Igor");
    renderTribs();
    const load = editorLoad().get("Igor Garčev");
    assert.ok(els.tribs.innerHTML.includes(load.n + " · " + fmtU(load.u) + "u"), "chip shows count and units");
    assert.ok(els.tribs.innerHTML.includes('data-eid="88817643"'), "free editors still get a chip");
    console.log("✓ Editor chips show load (" + load.n + " · " + fmtU(load.u) + "u for Igor) and the full roster");

    // Live ripples: no ripple on first load; outside changes ripple and get an actor; our own writes are ignored.
    const raws = S.items.map(i => ({ id: i.id, name: i.name, updated_at: i.updated, created_at: i.created,
      column_values: { status: i.stage, person: i.editor, date: i.available, date4: i.draft, date_mkx87nb3: i.v1, dup__of_1st_cut_deadline: i.final, board_relation_mkxb8cpz: [{ id: "77", name: "AG - " + i.client }] } }));
    S.seeded = false; S.feed = [];
    await onBoard({ type: "result", result: { payload: { items: raws } } });
    assert.strictEqual(S.feed.length, 0, "no ripples on first load"); assert.ok(S.seeded);
    const outside = raws.find(r => r.column_values.status === "In Process" && !wroteRecently(r.id));
    const ours = raws.find(r => r.column_values.status === "Assigned" && r !== outside); markWrote(ours.id);
    outside.column_values = Object.assign({}, outside.column_values, { status: "In Review" });
    ours.column_values = Object.assign({}, ours.column_values, { status: "In Process" });
    const actCalls = calls.length;
    await onBoard({ type: "result", result: { payload: { items: raws } } }); await flush();
    assert.strictEqual(S.feed.length, 1, "one outside change"); assert.strictEqual(S.feed[0].id, outside.id);
    assert.ok(S.ripples.has(outside.id) && !S.ripples.has(ours.id), "ripple only on the outside change");
    assert.ok(new RegExp('class="ripple"').test(els.river.innerHTML), "ripple drawn on the river");
    assert.ok(calls.slice(actCalls).some(c => c.tool === "get_board_activity"));
    const ftxt = feedText(S.feed[0]);
    assert.ok(/^Igor moved .+ to In Review$/.test(ftxt), "feed names the actor: " + ftxt);
    assert.ok(els.live.innerHTML.includes(esc(ftxt)) && els.live.innerHTML.includes("just now"));
    console.log("✓ Live: '" + ftxt + "', just now; own write ignored");
    raws.push({ id: "999", name: "New One - Session", column_values: { status: "Queue" } });
    await onBoard({ type: "result", result: { payload: { items: raws } } }); await flush();
    assert.ok(S.feed[0].isNew && S.feed[0].id === "999" && /added New One - Session to Queue|arrived in Queue/.test(feedText(S.feed[0])), "new arrivals show up");
    for (let k = 0; k < 25; k++) { const r = raws[k % 5]; r.column_values = Object.assign({}, r.column_values, { date_mm02j5tr: d(k + 1) }); WROTE.delete(r.id); await onBoard({ type: "result", result: { payload: { items: raws } } }); }
    assert.strictEqual(S.feed.length, 20, "feed keeps the last 20");
    console.log("✓ Live: feed capped at 20 entries");
    const bk = norm({ id: "555", name: "Brett King - Session 02.10.26", column_values: { status: "Client Review", person: "Akssat", status_1: "Payment pending", board_relation_mkxb8cpz: [{ id: "78", name: "AG - Brett King" }] } });
    S.items.push(bk); S.adding = false; S.form = null; S.sel = bk.id; await loadPackage(bk); renderPanel();
    const ph = els.panel.innerHTML;
    assert.ok(/4821/.test(ph) && /Full episode edit/.test(ph) && /3 highlights/.test(ph) && /blue backdrop/.test(ph), "package shows booking details");
    assert.ok(!/Someone Else|>1</.test(ph.replace(/Units[\s\S]*/, "")), "other clients' bookings are ignored");
    assert.ok(!/Invoice/.test(ph), "invoice row removed");
    const lev = calls.find(c => c.tool === "list_events").input;
    assert.strictEqual(lev.startTime, "2026-10-01T00:00:00+04:00");
    console.log("✓ Package details load from the calendar booking (Order 4821), invoice hidden");
    const sh = toBooking({ id: "x", summary: "Sharon hello@sharonpakir.com | Poddster Booking", start: { dateTime: "2026-10-01T14:00:00+04:00" }, end: { dateTime: "2026-10-01T15:00:00+04:00" }, organizer: { displayName: "Al Barsha Studio 2" },
      description: 'Order ID: E8TW5S4C<br>Customer: Sharon <a href="mailto:hello@sharonpakir.com">hello@sharonpakir.com</a><br>Seats: 1<br>Setup: Nest<br>Services:<br>Recording + Live Mix<br>Additional Services:<br>Session Photos (1)<br>Teleprompter (1)<br><br> <br><span>Client requesting for Neetu<br>Will be standing</span>' });
    assert.strictEqual(sh.addons, "Session Photos (1)\\nTeleprompter (1)"); assert.ok(/Neetu/.test(sh.notes)); assert.strictEqual(sh.studio, "Al Barsha Studio 2"); assert.strictEqual(sh.time, "14:00–15:00");
    const en = toBooking({ id: "y", summary: "x | Poddster Abu Dhabi Booking", start: { dateTime: "2026-10-02T13:00:00+04:00" }, organizer: { email: "abudhabi@poddster.com" },
      description: "Order ID: W\\nServices:\\nRecording\\nAdditional Services:\\n\\nMulti-cam Recording (1)\\nTeleprompter \\n\\n\\nAny special requests or note?: ENBD Arabic" });
    assert.strictEqual(en.addons, "Multi-cam Recording (1)\\nTeleprompter"); assert.strictEqual(en.notes, "ENBD Arabic"); assert.strictEqual(en.studio, "Abu Dhabi");
    console.log("✓ Parses real booking formats (HTML and plain, trailing notes, Abu Dhabi)");
    console.log("All smoke tests passed.");
  })();
`);
test(els, assert).catch(e => { console.error("✗", e.message); process.exit(1); });
